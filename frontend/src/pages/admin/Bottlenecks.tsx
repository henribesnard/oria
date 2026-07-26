const bottlenecks = [
  { action: 'apifootball.fixtures.next', share: 38, p95: '820 ms', calls: '2.4k', err: 2.1 },
  { action: 'llm.gemini.pro.analyze', share: 22, p95: '1 900 ms', calls: '420', err: 0.4 },
  { action: 'apifootball.odds.get', share: 14, p95: '610 ms', calls: '980', err: 5.8 },
  { action: 'storage.standings.read', share: 9, p95: '120 ms', calls: '6.1k', err: 0.0 },
  { action: 'llm.gemini.flash.compose', share: 8, p95: '340 ms', calls: '5.2k', err: 0.2 },
  { action: 'ingestion.normalize', share: 5, p95: '90 ms', calls: '6.1k', err: 0.1 },
];

function errColor(err: number) {
  if (err >= 5) return '#D5443B';
  if (err >= 1) return '#E0782A';
  return '#3B9B6E';
}

export function AdminBottlenecks() {
  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="font-serif font-normal text-[clamp(25px,6vw,32px)] mb-1.5">
        Goulots d'étranglement
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Actions triées par part du temps total. Repère vite où ça coince.
      </p>

      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div
          className="hide-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 90px 80px 90px',
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
          <span>Part du temps</span>
          <span style={{ textAlign: 'right' }}>p95</span>
          <span style={{ textAlign: 'right' }}>Appels</span>
          <span style={{ textAlign: 'right' }}>Erreurs</span>
        </div>

        {/* Rows */}
        {bottlenecks.map((b) => (
          <div
            key={b.action}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 90px 80px 90px',
              gap: '12px',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #F0EEF8',
            }}
          >
            <span className="font-mono text-[12.5px] text-text-strong">{b.action}</span>
            <span className="flex items-center gap-2">
              <span className="flex-1 h-[7px] rounded-full bg-border-inner overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${b.share}%` }}
                />
              </span>
              <span className="font-mono text-xs text-text-secondary">{b.share}%</span>
            </span>
            <span className="font-mono text-[12.5px] text-right text-text-dark">{b.p95}</span>
            <span className="font-mono text-[12.5px] text-right text-text-muted">{b.calls}</span>
            <span
              className="font-mono text-[12.5px] text-right font-semibold"
              style={{ color: errColor(b.err) }}
            >
              {b.err.toFixed(1)} %
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
