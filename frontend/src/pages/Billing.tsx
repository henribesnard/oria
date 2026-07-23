import { useState, useEffect } from 'react';
import { getSubscription, getUsage, startCheckout, openPortal } from '../api/billing';
import type { Subscription, UsageSnapshot } from '../api/billing';

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-semibold text-text-dark">{label}</span>
        <span className={`text-xs font-mono ${isHigh ? 'text-warning-text' : 'text-text-muted'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Billing() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSubscription().catch(() => null),
      getUsage().catch(() => null),
    ]).then(([s, u]) => {
      if (s) setSub(s);
      if (u) setUsage(u);
      setLoading(false);
    });
  }, []);

  const handleUpgrade = async () => {
    try {
      const { checkout_url } = await startCheckout();
      window.open(checkout_url, '_blank');
    } catch {
      /* ignore */
    }
  };

  const handlePortal = async () => {
    try {
      const { portal_url } = await openPortal();
      window.open(portal_url, '_blank');
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">
          O
        </div>
      </div>
    );
  }

  const isPremium = sub?.tier === 'premium';

  return (
    <div className="max-w-[560px] mx-auto px-7 py-10">
      <h1 className="text-xl font-bold text-text-strong mb-1">Abonnement</h1>
      <p className="text-sm text-text-muted mb-8">
        G&eacute;rez votre plan et votre facturation
      </p>

      {/* Current plan card */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-text-strong">
              {isPremium ? 'Plan Premium' : 'Plan gratuit'}
            </p>
            <p className="text-sm text-text-muted">
              {isPremium
                ? 'Acc\u00e8s complet \u00e0 toutes les fonctionnalit\u00e9s'
                : 'Fonctionnalit\u00e9s de base'}
            </p>
          </div>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              isPremium
                ? 'text-primary bg-purple-surface'
                : 'text-success-text bg-success-surface'
            }`}
          >
            {sub?.status === 'active' ? 'Actif' : (sub?.status ?? 'Actif')}
          </span>
        </div>

        {/* Period info for premium */}
        {isPremium && sub?.current_period_end && (
          <p className="text-xs text-text-muted mb-4">
            Renouvellement le{' '}
            {new Date(sub.current_period_end * 1000).toLocaleDateString('fr-FR')}
          </p>
        )}

        <div className="flex gap-3">
          {!isPremium && (
            <button
              onClick={handleUpgrade}
              className="h-10 px-6 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors"
            >
              Passer &agrave; Premium
            </button>
          )}
          {isPremium && (
            <button
              onClick={handlePortal}
              className="h-10 px-6 border border-border text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-hover transition-colors"
            >
              G&eacute;rer l&apos;abonnement
            </button>
          )}
        </div>
      </div>

      {/* Usage card */}
      {usage && (
        <div className="bg-surface-card rounded-2xl border border-border p-6">
          <h2 className="text-sm font-bold text-text-strong mb-4">Utilisation du jour</h2>
          <div className="flex flex-col gap-4">
            <UsageBar label="Messages" used={usage.messages_today} limit={usage.messages_limit} />
            <UsageBar label="Sessions live" used={usage.live_today} limit={usage.live_limit} />
            <UsageBar label="Alertes" used={usage.alerts_today} limit={usage.alerts_limit} />
            <UsageBar
              label="Analyses approfondies"
              used={usage.deep_analysis_today}
              limit={usage.deep_analysis_limit}
            />
          </div>
          <p className="text-[11px] text-text-faint mt-4">
            Les compteurs se r&eacute;initialisent chaque jour &agrave; minuit UTC.
          </p>
        </div>
      )}
    </div>
  );
}
