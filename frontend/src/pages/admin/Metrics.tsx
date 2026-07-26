const metricsData = [
  { label: 'API-Football', p50: 210, p95: 820, p99: 1600, spark: [3, 4, 5, 8, 6, 9, 7] },
  { label: 'LLM Flash', p50: 180, p95: 340, p99: 520, spark: [4, 4, 5, 4, 6, 5, 5] },
  { label: 'LLM Pro', p50: 900, p95: 1900, p99: 2600, spark: [6, 7, 6, 8, 7, 9, 8] },
  { label: 'Storage', p50: 12, p95: 34, p99: 60, spark: [2, 2, 3, 2, 2, 3, 2] },
  { label: 'Ingestion', p50: 40, p95: 90, p99: 140, spark: [3, 4, 3, 4, 3, 4, 4] },
];

const breakers = [
  { name: 'apifootball', state: 'half-open' as const },
  { name: 'llm', state: 'closed' as const },
  { name: 'liveengine', state: 'open' as const },
  { name: 'storage', state: 'closed' as const },
];

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

function sparkPoints(spark: number[]): string {
  const max = Math.max(...spark);
  return spark.map((v, i) => `${(i / (spark.length - 1)) * 100},${28 - (v / max) * 24}`).join(' ');
}

export function AdminMetrics() {
  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="font-serif font-normal text-[clamp(25px,6vw,32px)] mb-1.5">Métriques</h1>
      <p className="text-sm text-text-muted mb-6">Latences, tokens LLM, circuit breakers.</p>

      {/* Latency table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden mb-5">
        <div
          className="hide-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px 80px 110px',
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
          <span style={{ textAlign: 'right' }}>p50</span>
          <span style={{ textAlign: 'right' }}>p95</span>
          <span style={{ textAlign: 'right' }}>p99</span>
          <span style={{ textAlign: 'right' }}>7 j</span>
        </div>
        {metricsData.map((m) => (
          <div
            key={m.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 80px 110px',
              gap: '12px',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #F0EEF8',
            }}
          >
            <span className="font-semibold text-sm">{m.label}</span>
            <span className="font-mono text-[12.5px] text-right text-text-dark">{m.p50}</span>
            <span className="font-mono text-[12.5px] text-right text-text-dark">{m.p95}</span>
            <span className="font-mono text-[12.5px] text-right text-text-dark">{m.p99}</span>
            <span className="text-right">
              <svg width="100" height="28" viewBox="0 0 100 28" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <polyline
                  points={sparkPoints(m.spark)}
                  fill="none"
                  stroke="#5B4FD6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        ))}
      </div>

      {/* Tokens + Circuit Breakers */}
      <div className="grid-2">
        {/* Tokens LLM */}
        <div className="bg-white border border-border rounded-2xl p-[22px]">
          <h2 className="text-[15px] font-semibold mb-4">Tokens LLM (aujourd'hui)</h2>

          <div className="mb-4">
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="font-semibold">Gemini Flash</span>
              <span className="font-mono text-text-secondary">4,8 M</span>
            </div>
            <div className="h-2 rounded-full bg-border-inner overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '78%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="font-semibold">Gemini Pro</span>
              <span className="font-mono text-text-secondary">1,3 M</span>
            </div>
            <div className="h-2 rounded-full bg-border-inner overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '22%', background: '#9C90F5' }} />
            </div>
          </div>

          <p className="text-xs text-text-muted mt-4">
            342 fallbacks servis · Pro réservé aux analyses avancées
          </p>
        </div>

        {/* Circuit Breakers */}
        <div className="bg-white border border-border rounded-2xl p-[22px]">
          <h2 className="text-[15px] font-semibold mb-4">Circuit breakers</h2>
          <div className="flex flex-col gap-2.5">
            {breakers.map((b) => {
              const c = statusColor(b.state);
              return (
                <div key={b.name} className="flex items-center gap-3">
                  <span
                    className="w-[9px] h-[9px] rounded-full shrink-0"
                    style={{ background: c.dot }}
                  />
                  <span className="font-mono text-[13px] flex-1">{b.name}</span>
                  <span
                    className="px-2.5 py-[2px] rounded-full text-[11.5px] font-bold"
                    style={{ color: c.fg, background: c.bg }}
                  >
                    {statusText(b.state)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
