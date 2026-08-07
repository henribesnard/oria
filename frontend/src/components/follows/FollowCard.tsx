import { useState } from 'react';
import type { Follow } from '../../api/follows';

interface Props {
  follow: Follow;
  onUnfollow: (entityType: string, entityId: number) => void;
}

const typeLabels: Record<string, string> = {
  league: 'Ligue',
  team: '\u00c9quipe',
  player: 'Joueur',
};

const typeIcons: Record<string, string> = {
  league: '\u{1F3C6}',
  team: '\u26BD',
  player: '\u{1F464}',
};

function LogoOrEmoji({ logoUrl, entityType }: { logoUrl?: string; entityType: string }) {
  const [error, setError] = useState(false);
  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl} alt=""
        onError={() => setError(true)}
        style={{ width: 24, height: 24, objectFit: 'contain' }}
      />
    );
  }
  return <span className="text-lg">{typeIcons[entityType] ?? '\u{1F4CC}'}</span>;
}

export function FollowCard({ follow, onUnfollow }: Props) {
  return (
    <div className="flex items-center justify-between bg-surface-card border border-border rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-surface flex items-center justify-center shrink-0">
          <LogoOrEmoji logoUrl={follow.logo_url} entityType={follow.entity_type} />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-strong">{follow.entity_name || `#${follow.entity_id}`}</p>
          <p className="text-xs text-text-muted">{typeLabels[follow.entity_type] ?? follow.entity_type}</p>
        </div>
      </div>
      <button
        onClick={() => onUnfollow(follow.entity_type, follow.entity_id)}
        className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-danger-surface hover:text-danger-text hover:border-danger transition-colors"
      >
        Retirer
      </button>
    </div>
  );
}
