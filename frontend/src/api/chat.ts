import { api } from './client';

export interface ChatContext {
  country?: string;
  zone?: string;
  league_id?: number;
  season?: number;
  fixture_id?: number;
  team_id?: number;
  player_id?: number;
}

export interface Attachment {
  kind: 'fixture_card' | 'table' | 'link' | 'image';
  data: Record<string, unknown>;
}

export interface SuggestedAction {
  label: string;
  payload: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  attachments: Attachment[];
  suggested_actions: SuggestedAction[];
  degraded: boolean;
  freshness: string | null;
}

export interface SSEEvent {
  type: 'chunk' | 'done' | 'quota' | 'error';
  content?: string;
  text?: string;
  message?: string;
  attachments?: Attachment[];
  suggested_actions?: SuggestedAction[];
  degraded?: boolean;
  freshness?: string | null;
}

/** Blocking chat — single request/response */
export async function sendMessage(text: string, context?: ChatContext): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', { text, context: context ?? {} });
}

/** SSE streaming chat — returns an AbortController to cancel the stream */
export function streamMessage(
  text: string,
  context: ChatContext | undefined,
  token: string,
  onChunk: (content: string) => void,
  onDone: (event: SSEEvent) => void,
  onError: (message: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ text, context: context ?? {} }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(`Erreur ${res.status}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError('Streaming non disponible');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            if (event.type === 'chunk' && event.content) {
              onChunk(event.content);
            } else if (event.type === 'done') {
              onDone(event);
            } else if (event.type === 'quota') {
              onError(event.message ?? 'Quota dépassé');
            } else if (event.type === 'error') {
              onError(event.message ?? 'Erreur');
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        onError('Connexion perdue');
      }
    });

  return controller;
}
