import { useState, useCallback, useRef } from 'react';
import { randomUUID } from 'expo-crypto';
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

export function useChat(initialContext?: ChatContext) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>(initialContext ?? {});
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback((text: string) => {
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
    );
  }, [token, sending, context]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSending(false);
    setContext({});
  }, []);

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    if (typeof action.payload.text === 'string') {
      send(action.payload.text);
    }
  }, [send]);

  return { messages, sending, context, setContext, send, clear, handleSuggestedAction };
}
