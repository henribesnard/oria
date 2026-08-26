import { api } from './client';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

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
}

// ── Threads ───────────────────────────────────────────────────────────

export interface ThreadSummary {
  id: string;
  title: string;
  context: ChatContext;
  last_message: string;
  updated_at: number;
}

export interface ThreadDetail {
  id: string;
  user_id: string;
  title: string;
  context: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface ThreadMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

export async function listThreads(): Promise<ThreadSummary[]> {
  return api.get<ThreadSummary[]>('/chat/threads');
}

export async function createThread(
  title: string = '',
  context?: ChatContext,
): Promise<ThreadDetail> {
  return api.post<ThreadDetail>('/chat/threads', { title, context: context ?? {} });
}

export async function getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  return api.get<ThreadMessage[]>(`/chat/threads/${threadId}/messages`);
}

export async function deleteThread(threadId: string): Promise<void> {
  await api.del(`/chat/threads/${threadId}`);
}

// ── Chat ──────────────────────────────────────────────────────────────

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
  threadId?: string,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text,
      context: context ?? {},
      thread_id: threadId ?? null,
    }),
    signal: controller.signal,
    // @ts-expect-error -- React Native streaming option
    reactNative: { textStreaming: true },
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(`Erreur ${res.status}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        // Fallback: read full body at once
        const body = await res.text();
        for (const line of body.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            if (event.type === 'done') onDone(event);
            else if (event.type === 'chunk' && event.content) onChunk(event.content);
          } catch { /* skip */ }
        }
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
