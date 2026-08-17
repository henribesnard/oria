import type { ContextState, Level } from '../../lib/contextRules';

interface Props {
  contextState: ContextState;
  onClear: (level: Exclude<Level, 'none'>) => void;
}

export function ContextChips({ contextState, onClear }: Props) {
  const { labels } = contextState;
  const chips: { label: string; logo?: string; level: Exclude<Level, 'none'> }[] = [];

  if (labels.league) chips.push({ label: labels.league.name, logo: labels.league.logo, level: 'league' });
  if (labels.fixture) chips.push({ label: `${labels.fixture.home} – ${labels.fixture.away}`, level: 'fixture' });
  if (labels.team) chips.push({ label: labels.team.name, logo: labels.team.logo, level: 'team' });
  if (labels.player) chips.push({ label: labels.player.name, level: 'player' });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-7 pt-3">
      <div className="max-w-[680px] mx-auto flex flex-wrap gap-2 w-full">
        {chips.map(chip => (
          <span
            key={chip.level}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-surface text-primary text-xs font-semibold"
          >
            {chip.logo && (
              <img src={chip.logo} alt="" className="w-3.5 h-3.5 object-contain" />
            )}
            {chip.label}
            <button
              onClick={() => onClear(chip.level)}
              className="text-primary-muted hover:text-primary transition-colors"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
