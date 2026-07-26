import { useEffect, useState } from 'react';
import { getMetrics, getHealth, type HealthModule } from '../../api/admin';

interface MetricEntry {
  name: string;
  count: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
}

function statusColor(st: string) {
  if (st === 'closed' || st === 'up' || st === 'ok') return { fg: '#207F53', bg: '#E3F3EB', dot: '#3B9B6E' };
  if (st === 'half-open' || st === 'degraded') return { fg: '#C4691F', bg: '#FBEEE2', dot: '#E0782A' };
  return { fg: '#B4362C', bg: '#FBE6E3', dot: '#D5443B' };
}

function statusText(st: string) {
  const map: Record<string, string> = {
    closed: 'Fermé', 'half-open': 'Semi-ouvert', open: 'Ouvert',
    up: 'Opérationnel', degraded: 'Dégradé', down: 'Hors service',
  };
  return map[st] ?? st;
}

export function AdminMetrics() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [modules, setModules] = useState<Record<string, HealthModule>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMetrics(), getHealth()])
      .then(([metricsRes, healthRes]) => {
        if (cancelled) return;

        // Transform metrics dict → sorted array
        const entries: MetricEntry[] = Object.values(metricsRes as Record<string, MetricEntry>)
          .sort((a, b) => b.p95_ms - a.p95_ms);
        setMetrics(entries);

        setModules(healthRes.modules ?? {});
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les métriques.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="font-serif font-normal text-[clamp(25px,6vw,32px)] mb-1.5">Métriques</h1>
      <p className="text-sm text-text-muted mb-6">Latences, appels et circuit breakers.</p>

      {loading && <p className="text-sm text-text-muted">Chargement…</p>}
      {error && <p className="text-sm text-[#D5443B]">{error}</p>}

      {!loading && !error && (
        <>
          {/* Latency table */}
          {metrics.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden mb-5">
              <div
                className="hide-sm"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 80px 80px 80px 80px',
                  gap: '12px',
                  padding: '13px 20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '.4px',
                  color: '#A5A0BC',
                  background: '#FBFBFE',
                  borderBottom: '1px solid #F0EEF8',
                }}
              >
                <span>Module</span>
                <span style={{ textAlign: 'right' }}>Appels</span>
                <span style={{ textAlign: 'right' }}>p50</span>
                <span style={{ textAlign: 'right' }}>p95</span>
                <span style={{ textAlign: 'right' }}>p99</span>
                <span style={{ textAlign: 'right' }}>max</span>
              </div>
              {metrics.map((m) => (
                <div
                  key={m.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 80px 80px 80px 80px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderTop: '1px solid #F0EEF8',
                  }}
                >
                  <span className="font-semibold text-sm">{m.name}</span>
                  <span className="font-mono text-[12.5px] text-right text-text-muted">{m.count.toLocaleString('fr-FR')}</span>
                  <span className="font-mono text-[12.5px] text-right text-text-dark">{Math.round(m.p50_ms)}</span>
                  <span className="font-mono text-[12.5px] text-right text-text-dark">{Math.round(m.p95_ms)}</span>
                  <span className="font-mono text-[12.5px] text-right text-text-dark">{Math.round(m.p99_ms)}</span>
                  <span className="font-mono text-[12.5px] text-right text-text-secondary">{Math.round(m.max_ms)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Circuit Breakers / Health modules */}
          {Object.keys(modules).length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-[22px]">
              <h2 className="text-[15px] font-semibold mb-4">État des modules</h2>
              <div className="flex flex-col gap-2.5">
                {Object.values(modules).map((mod) => {
                  const c = statusColor(mod.availability);
                  return (
                    <div key={mod.name} className="flex items-center gap-3">
                      <span
                        className="w-[9px] h-[9px] rounded-full shrink-0"
                        style={{ background: c.dot }}
                      />
                      <span className="font-mono text-[13px] flex-1">{mod.name}</span>
                      <span
                        className="px-2.5 py-[2px] rounded-full text-[11.5px] font-bold"
                        style={{ color: c.fg, background: c.bg }}
                      >
                        {statusText(mod.availability)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {metrics.length === 0 && Object.keys(modules).length === 0 && (
            <p className="text-sm text-text-muted">Aucune donnée disponible.</p>
          )}
        </>
      )}
    </div>
  );
}
