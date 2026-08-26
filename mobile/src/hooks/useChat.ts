import { useState, useCallback, useRef, useEffect } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from './useAuth';
import { streamMessage, getThreadMessages } from '../api/chat';
import type { Attachment, SuggestedAction, ChatContext, ThreadMessage } from '../api/chat';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
  suggested_actions?: SuggestedAction[];
  degraded?: boolean;
  streaming?: boolean;
}

export function useChat(initialContext?: ChatContext, threadId?: string) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>(initialContext ?? {});
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load thread messages when threadId changes
  useEffect(() => {
    if (!currentThreadId || !token) {
      setHistoryLoaded(true);
      return;
    }
    let cancelled = false;
    setHistoryLoaded(false);

    getThreadMessages(currentThreadId)
      .then((turns: ThreadMessage[]) => {
        if (cancelled) return;
        const loaded: Message[] = turns.map(t => ({
          id: String(t.id),
          role: t.role,
          text: t.text,
        }));
        setMessages(loaded);
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setHistoryLoaded(true);
      });

    return () => { cancelled = true; };
  }, [currentThreadId, token]);

  const switchThread = useCallback((newThreadId: string | undefined, newContext?: ChatContext) => {
    abortRef.current?.abort();
    setSending(false);
    setMessages([]);
    setHistoryLoaded(false);
    setCurrentThreadId(newThreadId);
    if (newContext) setContext(newContext);
  }, []);

  const send = useCallback((text: string, threadIdOverride?: string) => {
    if (!text.trim() || !token || sending) return;

    const userMsg: Message = {
      id: randomUUID(),
      role: 'user',
      text: text.trim(),
    };

    const assistantId = randomUUID();
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
      threadIdOverride ?? currentThreadId,
    );
  }, [token, sending, context, currentThreadId]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSending(false);
    setContext({});
    setCurrentThreadId(undefined);
  }, []);

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    if (typeof action.payload.text === 'string') {
      send(action.payload.text);
    }
  }, [send]);

  return {
    messages,
    sending,
    context,
    setContext,
    send,
    clear,
    handleSuggestedAction,
    threadId: currentThreadId,
    setThreadId: setCurrentThreadId,
    switchThread,
    historyLoaded,
  };
}
