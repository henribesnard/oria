import { useState, useEffect, useCallback } from 'react';
import { listFollows, unfollow } from '../api/follows';
import type { Follow } from '../api/follows';
import { FollowCard } from '../components/follows/FollowCard';

export function Follows() {
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listFollows();
      setFollows(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnfollow = async (entityType: string, entityId: number) => {
    await unfollow(entityType, entityId);
    setFollows(prev => prev.filter(f => !(f.entity_type === entityType && f.entity_id === entityId)));
  };

  const teams = follows.filter(f => f.entity_type === 'team');
  const leagues = follows.filter(f => f.entity_type === 'league');
  const players = follows.filter(f => f.entity_type === 'player');

  return (
    <div className="max-w-[720px] mx-auto px-7 py-10">
      <h1 className="text-xl font-bold text-text-strong mb-1">Mes suivis</h1>
      <p className="text-sm text-text-muted mb-8">
        Joueurs et \u00e9quipes que vous suivez
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">O</div>
        </div>
      ) : follows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mb-4">
            <span className="text-xl text-text-disabled">{'\u2B50'}</span>
          </div>
          <p className="text-sm font-semibold text-text-dark mb-1">Aucun suivi</p>
          <p className="text-sm text-text-muted max-w-[280px]">
            Demandez \u00e0 Oria de suivre un joueur ou une \u00e9quipe pour recevoir des mises \u00e0 jour.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[
            { title: '\u00c9quipes', items: teams },
            { title: 'Ligues', items: leagues },
            { title: 'Joueurs', items: players },
          ].filter(s => s.items.length > 0).map(section => (
            <div key={section.title}>
              <h2 className="text-sm font-bold text-text-dark mb-3">{section.title}</h2>
              <div className="flex flex-col gap-2">
                {section.items.map(f => (
                  <FollowCard key={`${f.entity_type}-${f.entity_id}`} follow={f} onUnfollow={handleUnfollow} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
