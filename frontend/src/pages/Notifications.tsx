import { useNotifications } from '../hooks/useNotifications';

const typeIcons: Record<string, string> = {
  goal: '\u26BD',
  match_start: '\u{1F3C1}',
  match_end: '\u{1F3C6}',
  lineup: '\u{1F4CB}',
  prematch: '\u23F0',
  result: '\u{1F4CA}',
  info: '\u{1F514}',
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function Notifications() {
  const { notifications, connected, unreadCount, markRead, markAllRead, clear } =
    useNotifications();

  return (
    <div className="max-w-[720px] mx-auto px-7 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-text-strong mb-1">Notifications</h1>
          <p className="text-sm text-text-muted">
            Vos alertes et mises à jour
            {connected && (
              <span className="inline-flex items-center gap-1 ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success-text">connecté</span>
              </span>
            )}
          </p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Tout lire
              </button>
            )}
            <button
              onClick={clear}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Effacer
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mb-4">
            <span className="text-xl text-text-disabled">{'\u{1F514}'}</span>
          </div>
          <p className="text-sm font-semibold text-text-dark mb-1">Aucune notification</p>
          <p className="text-sm text-text-muted max-w-[280px]">
            Les alertes de vos joueurs et équipes suivis apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                n.read
                  ? 'bg-surface-card border-border'
                  : 'bg-purple-surface border-purple-border'
              } hover:bg-surface-hover`}
            >
              <div className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-base">{typeIcons[n.type] ?? '\u{1F514}'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-text-strong truncate">
                    {n.title}
                  </p>
                  <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                    {timeAgo(n.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{n.body}</p>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
