import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { streamMessage } from '../api/chat';
import type { Attachment, SuggestedAction, ChatContext } from '../api/chat';
import {
  selectLeague as _selectLeague,
  selectFixture as _selectFixture,
  selectTeam as _selectTeam,
  selectPlayer as _selectPlayer,
  clearLevel as _clearLevel,
  EMPTY_CONTEXT_STATE,
  type ContextState,
  type ContextLabels,
  type Level,
} from '../lib/contextRules';

export type { ContextState, ContextLabels, Level };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
  suggested_actions?: SuggestedAction[];
  degraded?: boolean;
  streaming?: boolean;
  freshness?: string | null;
  /** Snapshot of context at the time this user message was sent */
  contextSnapshot?: ContextState;
}

const CONTEXT_KEYS: (keyof ChatContext)[] = [
  'country', 'zone', 'league_id', 'season', 'fixture_id', 'team_id', 'player_id',
];

function extractContextState(raw: Record<string, unknown>): ContextState {
  const ctx: Record<string, unknown> = {};
  for (const k of CONTEXT_KEYS) {
    if (raw[k] !== undefined) ctx[k] = raw[k];
  }
  const context = ctx as ChatContext;
  const labels: ContextLabels = {};

  // Reconstruct fixture labels from location.state _fixture_* keys
  if (context.fixture_id && raw._fixture_home) {
    labels.fixture = {
      id: context.fixture_id,
      home: raw._fixture_home as string,
      away: (raw._fixture_away as string) ?? '',
      homeId: raw._fixture_home_id as number | undefined,
      awayId: raw._fixture_away_id as number | undefined,
      homeLogo: raw._fixture_home_logo as string | undefined,
      awayLogo: raw._fixture_away_logo as string | undefined,
    };
  }

  return { context, labels };
}

export function useChat() {
  const { token } = useAuth();
  const location = useLocation();
  const rawState = (location.state ?? {}) as Record<string, unknown>;
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [contextState, setContextState] = useState<ContextState>(
    () => extractContextState(rawState),
  );
  const abortRef = useRef<AbortController | null>(null);

  const ctx = contextState.context;
  const hasContext = Object.keys(ctx).length > 0;

  const send = useCallback((text: string) => {
    if (!text.trim() || !token || sending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text.trim(),
      contextSnapshot: hasContext ? { ...contextState } : undefined,
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
      hasContext ? ctx : undefined,
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
                  freshness: event.freshness,
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
  }, [token, sending, ctx, hasContext, contextState]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSending(false);
    setContextState({ ...EMPTY_CONTEXT_STATE });
  }, []);

  const selectLeague = useCallback(
    (league: { id: number; name: string; logo?: string; country?: string }) => {
      setContextState(prev => _selectLeague(prev, league));
    }, [],
  );

  const selectFixture = useCallback(
    (fixture: {
      id: number; home: string; away: string;
      homeId?: number; awayId?: number;
      homeLogo?: string; awayLogo?: string;
      date?: string; status?: string; round?: string;
    }) => {
      setContextState(prev => _selectFixture(prev, fixture));
    }, [],
  );

  const selectTeam = useCallback(
    (team: { id: number; name: string; logo?: string }) => {
      setContextState(prev => _selectTeam(prev, team));
    }, [],
  );

  const selectPlayer = useCallback(
    (player: { id: number; name: string; photo?: string; number?: number }) => {
      setContextState(prev => _selectPlayer(prev, player));
    }, [],
  );

  const clearContextLevel = useCallback(
    (level: Exclude<Level, 'none'>) => {
      setContextState(prev => _clearLevel(prev, level));
    }, [],
  );

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    if (typeof action.payload.text === 'string') {
      send(action.payload.text);
    }
  }, [send]);

  return {
    messages,
    sending,
    contextState,
    setContextState,
    selectLeague,
    selectFixture,
    selectTeam,
    selectPlayer,
    clearContextLevel,
    send,
    clear,
    handleSuggestedAction,
  };
}
