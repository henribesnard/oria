import { useState, useEffect } from 'react';
import { getTraces, getTraceDetail } from '../../api/admin';
import type { TraceEntry, TraceDetail } from '../../api/admin';

export function AdminTraces() {
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraceDetail | null>(null);

  useEffect(() => {
    getTraces(50).then(setTraces).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleTrace = async (traceId: string) => {
    if (expanded === traceId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(traceId);
    try {
      const d = await getTraceDetail(traceId);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  };

  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="text-xl font-bold text-text-strong mb-1">Traces</h1>
      <p className="text-sm text-text-muted mb-8">Historique des requetes et reponses du systeme</p>

      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_120px_100px] gap-4 px-5 py-3 border-b border-border-inner text-xs font-semibold text-text-muted uppercase tracking-wide">
          <span>Trace ID</span>
          <span>Duree</span>
          <span>Spans</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">O</div>
          </div>
        ) : traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-semibold text-text-dark mb-1">Aucune trace</p>
            <p className="text-sm text-text-muted max-w-[280px]">
              Les traces des conversations apparaitront ici une fois le systeme connecte.
            </p>
          </div>
        ) : (
          <div>
            {traces.map(t => (
              <div key={t.trace_id}>
                <button
                  onClick={() => void toggleTrace(t.trace_id)}
                  className="w-full grid grid-cols-[1fr_120px_100px] gap-4 px-5 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border-inner"
                >
                  <span className="text-sm font-mono text-text-dark truncate">{t.trace_id}</span>
                  <span className="text-sm font-mono text-text-secondary">{t.total_duration_ms}ms</span>
                  <span className="text-sm text-text-muted">{t.span_count}</span>
                </button>
                {expanded === t.trace_id && detail && (
                  <div className="px-5 py-4 bg-surface-alt border-b border-border-inner">
                    <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(detail.spans, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
