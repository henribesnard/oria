import type { Fixture } from '../../api/catalog';

interface Props {
  fixture: Fixture;
}

export function FixtureCard({ fixture }: Props) {
  const dateStr = fixture.date ? new Date(fixture.date).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '';

  const isLive = fixture.status === 'LIVE' || fixture.status === '1H' || fixture.status === '2H' || fixture.status === 'HT';
  const isFinished = fixture.status === 'FT' || fixture.status === 'AET' || fixture.status === 'PEN';

  return (
    <div className="bg-surface-card border border-border rounded-xl p-4">
      {/* League & date */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {fixture.league_name ?? 'Match'}
        </span>
        {isLive && (
          <span className="px-2 py-0.5 rounded-md bg-success-surface text-success-text text-[11px] font-bold">
            LIVE
          </span>
        )}
        {isFinished && (
          <span className="px-2 py-0.5 rounded-md bg-surface-muted text-text-muted text-[11px] font-bold">
            Termin\u00e9
          </span>
        )}
      </div>

      {/* Teams & score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-right pr-4">
          <p className="text-sm font-semibold text-text-strong">{fixture.home_team}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fixture.score_home != null && fixture.score_away != null ? (
            <span className="font-mono text-lg font-bold text-text-strong">
              {fixture.score_home} - {fixture.score_away}
            </span>
          ) : (
            <span className="text-xs text-text-muted font-semibold">{dateStr || 'vs'}</span>
          )}
        </div>
        <div className="flex-1 pl-4">
          <p className="text-sm font-semibold text-text-strong">{fixture.away_team}</p>
        </div>
      </div>

      {/* Date if not scored */}
      {fixture.score_home == null && dateStr && (
        <p className="text-[11px] text-text-muted text-center mt-2">{dateStr}</p>
      )}
    </div>
  );
}
