import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

/**
 * Hook that connects to the SSE notification stream and accumulates notifications.
 */
export function useNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const connect = async () => {
      try {
        const res = await fetch('/api/live/notifications/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setConnected(false);
          return;
        }

        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (data.type === 'heartbeat') continue;

              const notif: Notification = {
                id: (data.id as string) ?? crypto.randomUUID(),
                type: (data.type as string) ?? 'info',
                title: (data.title as string) ?? '',
                body: (data.body as string) ?? (data.message as string) ?? '',
                timestamp: (data.timestamp as number) ?? Date.now(),
                read: false,
              };
              setNotifications(prev => [notif, ...prev]);
            } catch {
              // ignore malformed
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setConnected(false);
        }
      }
    };

    void connect();

    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [token]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, connected, unreadCount, markRead, markAllRead, clear };
}
