import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { streamMessage } from '../api/chat';
import type { Attachment, SuggestedAction, ChatContext } from '../api/chat';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
  suggested_actions?: SuggestedAction[];
  degraded?: boolean;
  streaming?: boolean;
}

export interface FixtureInfo {
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
}

const CONTEXT_KEYS: (keyof ChatContext)[] = [
  'country', 'zone', 'league_id', 'season', 'fixture_id', 'team_id', 'player_id',
];

function extractContext(raw: Record<string, unknown>): ChatContext {
  const ctx: Record<string, unknown> = {};
  for (const k of CONTEXT_KEYS) {
    if (raw[k] !== undefined) ctx[k] = raw[k];
  }
  return ctx as ChatContext;
}

function extractFixtureInfo(raw: Record<string, unknown>): FixtureInfo | null {
  if (!raw._fixture_home) return null;
  return {
    home: raw._fixture_home as string,
    away: raw._fixture_away as string,
    homeLogo: raw._fixture_home_logo as string | undefined,
    awayLogo: raw._fixture_away_logo as string | undefined,
  };
}

export function useChat() {
  const { token } = useAuth();
  const location = useLocation();
  const rawState = (location.state ?? {}) as Record<string, unknown>;
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>(() => extractContext(rawState));
  const [fixtureInfo, setFixtureInfo] = useState<FixtureInfo | null>(() => extractFixtureInfo(rawState));
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback((text: string) => {
    if (!text.trim() || !token || sending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text.trim(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      text: '',
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setSending(true);

    abortRef.current = streamMessage(
      text.trim(),
      Object.keys(context).length > 0 ? context : undefined,
      token,
      // onChunk
      (content) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, text: m.text + content } : m,
          ),
        );
      },
      // onDone
      (event) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  text: event.text ?? m.text,
                  attachments: event.attachments,
                  suggested_actions: event.suggested_actions,
                  degraded: event.degraded,
                  streaming: false,
                }
              : m,
          ),
        );
        setSending(false);
      },
      // onError
      (message) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, text: message, streaming: false, degraded: true }
              : m,
          ),
        );
        setSending(false);
      },
    );
  }, [token, sending, context]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSending(false);
    setContext({});
    setFixtureInfo(null);
  }, []);

  const clearFixture = useCallback(() => {
    setFixtureInfo(null);
    setContext(prev => {
      const { fixture_id: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    if (typeof action.payload.text === 'string') {
      send(action.payload.text);
    }
  }, [send]);

  return { messages, sending, context, setContext, send, clear, clearFixture, fixtureInfo, handleSuggestedAction };
}
