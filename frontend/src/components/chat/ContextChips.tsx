import type { ChatContext } from '../../api/chat';

interface Props {
  context: ChatContext;
  onClear: (key: keyof ChatContext) => void;
}

const labels: Record<string, string> = {
  country: 'Pays',
  zone: 'Zone',
  league_id: 'Ligue',
  season: 'Saison',
  fixture_id: 'Match',
  team_id: 'Équipe',
  player_id: 'Joueur',
};

export function ContextChips({ context, onClear }: Props) {
  const entries = Object.entries(context).filter(([, v]) => v != null);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-7 pt-3">
      <div className="max-w-[680px] mx-auto flex flex-wrap gap-2 w-full">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-surface text-primary text-xs font-semibold"
          >
            {labels[key] ?? key}: {String(value)}
            <button
              onClick={() => onClear(key as keyof ChatContext)}
              className="text-primary-muted hover:text-primary transition-colors"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
