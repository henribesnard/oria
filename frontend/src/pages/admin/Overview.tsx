import { useState, useEffect } from 'react';
import { getHealth, getQuota, listUsers } from '../../api/admin';
import type { HealthModule } from '../../api/admin';

export function AdminOverview() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [modules, setModules] = useState<Record<string, HealthModule>>({});
  const [quota, setQuota] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const errs: string[] = [];
    Promise.all([
      listUsers(0, 1).then(r => setUserCount(r.total)).catch(() => { errs.push('users'); }),
      getHealth().then(r => setModules(r.modules ?? {})).catch(() => { errs.push('health'); }),
      getQuota().then(setQuota).catch(() => { errs.push('quota'); }),
    ]).then(() => {
      setErrors(errs);
      setLoading(false);
    });
  }, []);

  const availabilityColor = (av: string) => {
    switch (av?.toUpperCase()) {
      case 'UP': return 'text-success-text bg-success-surface';
      case 'DOWN': return 'text-danger-text bg-danger-surface';
      case 'DEGRADED': return 'text-warning-text bg-warning-surface';
      default: return 'text-text-muted bg-surface-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">O</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="text-xl font-bold text-text-strong mb-1">Vue d'ensemble</h1>
      <p className="text-sm text-text-muted mb-8">Tableau de bord administration</p>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Utilisateurs</p>
          <p className="text-2xl font-bold text-text-strong">{userCount ?? '--'}</p>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Modules</p>
          <p className="text-2xl font-bold text-text-strong">{Object.keys(modules).length}</p>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Quota API</p>
          <p className="text-2xl font-bold text-text-strong">
            {quota && typeof quota.budget_pct === 'number' ? `${Math.round(Number(quota.budget_pct))}%` : '--'}
          </p>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-warning-surface border border-warning/20 rounded-xl text-sm text-warning-text">
          Certains endpoints admin necessitent un token specifique. Les donnees partielles sont affichees.
        </div>
      )}

      {/* Health modules grid */}
      {Object.keys(modules).length > 0 && (
        <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-sm font-bold text-text-strong mb-4">Sante des modules</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(modules).map(([name, mod]) => (
              <div key={name} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-alt border border-border-inner">
                <span className="text-sm font-semibold text-text-dark">{name}</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${availabilityColor(mod.availability)}`}>
                  {mod.availability}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
