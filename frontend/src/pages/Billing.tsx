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
      <h1
        className="font-serif text-text-strong mb-1"
        style={{ fontSize: 'clamp(26px, 6vw, 34px)' }}
      >
        Abonnement & facturation
      </h1>
      <p className="text-sm text-text-muted mb-8">
        Gère ton plan et ta facturation
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
                ? 'Accès complet à toutes les fonctionnalités'
                : 'Fonctionnalités de base'}
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
              Passer à Premium
            </button>
          )}
          {isPremium && (
            <button
              onClick={handlePortal}
              className="h-10 px-6 border border-border text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-hover transition-colors"
            >
              Gérer l'abonnement
            </button>
          )}
        </div>
      </div>

      {/* Payment method card */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <h2 className="text-sm font-bold text-text-strong mb-4">Moyen de paiement</h2>
        {isPremium && sub?.stripe_customer_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 rounded-md bg-gradient-to-r from-[#1A1F71] to-[#2D5BBE] flex items-center justify-center">
                <span className="text-[9px] text-white font-bold tracking-wider">VISA</span>
              </div>
              <span className="text-sm font-mono text-text-dark">•••• •••• •••• 4242</span>
            </div>
            <button
              onClick={handlePortal}
              className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Modifier
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Aucun moyen de paiement enregistré</p>
        )}
      </div>

      {/* Invoice history */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <h2 className="text-sm font-bold text-text-strong mb-4">Historique des factures</h2>
        {isPremium && sub?.current_period_start ? (
          <div className="border border-border-inner rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">Montant</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border-inner">
                  <td className="px-4 py-3 text-text-dark font-medium">
                    {new Date(sub.current_period_start * 1000).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-dark">7,99 €</td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 rounded-md bg-success-surface text-success-text text-xs font-semibold">
                      Payé
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Aucune facture pour le moment</p>
        )}
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
            Les compteurs se réinitialisent chaque jour à minuit UTC.
          </p>
        </div>
      )}
    </div>
  );
}
