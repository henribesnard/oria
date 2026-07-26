import { useState, useEffect, useCallback } from 'react';
import { listFollows, unfollow } from '../api/follows';
import type { Follow } from '../api/follows';

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

  const leagues = follows.filter(f => f.entity_type === 'league');
  const teams = follows.filter(f => f.entity_type === 'team');
  const players = follows.filter(f => f.entity_type === 'player');

  const sections = [
    { key: 'league', title: 'Ligues', items: leagues },
    { key: 'team', title: '\u00c9quipes', items: teams },
    { key: 'player', title: 'Joueurs', items: players },
  ];

  return (
    <div className="max-w-[820px] mx-auto px-7 py-10">
      <h1
        className="font-serif text-text-strong mb-1"
        style={{ fontSize: 'clamp(26px, 6vw, 34px)' }}
      >
        Mes suivis
      </h1>
      <p className="text-sm text-text-muted mb-8">
        Personnalise tes r&eacute;ponses et tes alertes.
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
            Demandez &agrave; Oria de suivre un joueur ou une &eacute;quipe pour recevoir des mises &agrave; jour.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map(section => (
            <div
              key={section.key}
              className="bg-white border border-border rounded-2xl p-6"
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold text-text-strong">
                  {section.title}
                </h2>
                <button className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
                  + Ajouter
                </button>
              </div>

              {/* Follow chips */}
              {section.items.length === 0 ? (
                <p className="text-sm text-text-muted">Aucun suivi dans cette cat&eacute;gorie.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {section.items.map(f => (
                    <span
                      key={`${f.entity_type}-${f.entity_id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-surface border border-purple-border text-primary-hover text-sm font-medium rounded-full"
                    >
                      {f.entity_name}
                      <button
                        onClick={() => handleUnfollow(f.entity_type, f.entity_id)}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors text-primary-hover"
                        aria-label={`Retirer ${f.entity_name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
