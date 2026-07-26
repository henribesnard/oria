import { useEffect, useState } from 'react';
import { getBottlenecks } from '../../api/admin';

interface Bottleneck {
  name: string;
  duration_ms: number;
  trace_id: string;
  detected_at: string;
}

function fmtDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function durationColor(ms: number) {
  if (ms >= 2000) return '#D5443B';
  if (ms >= 800) return '#E0782A';
  return '#3B9B6E';
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function AdminBottlenecks() {
  const [data, setData] = useState<Bottleneck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBottlenecks()
      .then((res) => {
        if (!cancelled) setData(res as unknown as Bottleneck[]);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les goulots.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const maxDuration = data.length ? Math.max(...data.map((b) => b.duration_ms)) : 1;

  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="font-serif font-normal text-[clamp(25px,6vw,32px)] mb-1.5">
        Goulots d&apos;étranglement
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Actions triées par durée. Repère vite où ça coince.
      </p>

      {loading && <p className="text-sm text-text-muted">Chargement…</p>}
      {error && <p className="text-sm text-[#D5443B]">{error}</p>}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-text-muted">Aucun goulot détecté.</p>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div
            className="hide-sm"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 110px 130px',
              gap: '12px',
              padding: '13px 20px',
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '.4px',
              textTransform: 'uppercase' as const,
              color: '#A5A0BC',
              background: '#FBFBFE',
              borderBottom: '1px solid #F0EEF8',
            }}
          >
            <span>Action</span>
            <span>Durée</span>
            <span style={{ textAlign: 'right' }}>Trace</span>
            <span style={{ textAlign: 'right' }}>Détecté le</span>
          </div>

          {/* Rows */}
          {data.map((b, i) => (
            <div
              key={b.trace_id || i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px 110px 130px',
                gap: '12px',
                alignItems: 'center',
                padding: '14px 20px',
                borderTop: '1px solid #F0EEF8',
              }}
            >
              <span className="font-mono text-[12.5px] text-text-strong">{b.name}</span>
              <span className="flex items-center gap-2">
                <span className="flex-1 h-[7px] rounded-full bg-border-inner overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(5, (b.duration_ms / maxDuration) * 100)}%`,
                      background: durationColor(b.duration_ms),
                    }}
                  />
                </span>
                <span
                  className="font-mono text-xs font-semibold whitespace-nowrap"
                  style={{ color: durationColor(b.duration_ms) }}
                >
                  {fmtDuration(b.duration_ms)}
                </span>
              </span>
              <span className="font-mono text-[11px] text-right text-text-muted truncate" title={b.trace_id}>
                {b.trace_id ? b.trace_id.slice(0, 8) : '—'}
              </span>
              <span className="font-mono text-[12px] text-right text-text-secondary">
                {b.detected_at ? fmtDate(b.detected_at) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
