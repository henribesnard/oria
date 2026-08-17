import { useState, useEffect, useRef, useMemo } from 'react';
import { listLeagues, listTeams, listFixtures, getSquad } from '../../api/catalog';
import type { League, Team, Fixture, Player } from '../../api/catalog';
import {
  deepestLevel,
  snapWindow,
  currentSeason,
  LIVE, FINISHED, UPCOMING,
  type ContextState,
  type Level,
} from '../../lib/contextRules';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  contextState: ContextState;
  onSelectLeague: (l: { id: number; name: string; logo?: string; country?: string }) => void;
  onSelectFixture: (f: {
    id: number; home: string; away: string;
    homeId?: number; awayId?: number;
    homeLogo?: string; awayLogo?: string;
    date?: string; status?: string; round?: string;
  }) => void;
  onSelectTeam: (t: { id: number; name: string; logo?: string }) => void;
  onSelectPlayer: (p: { id: number; name: string; photo?: string; number?: number }) => void;
  onClearLevel: (level: Exclude<Level, 'none'>) => void;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

type StatusFilter = 'all' | 'upcoming' | 'live' | 'finished';

function matchStatus(status: string | undefined): StatusFilter {
  if (!status) return 'upcoming';
  const s = status.toUpperCase();
  if (LIVE.includes(s)) return 'live';
  if (FINISHED.includes(s)) return 'finished';
  if (UPCOMING.includes(s)) return 'upcoming';
  return 'upcoming';
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
}

/* ------------------------------------------------------------------ */
/*  Country chips                                                      */
/* ------------------------------------------------------------------ */

const MAJOR_COUNTRIES = ['France', 'England', 'Spain', 'Germany', 'Italy', 'Portugal', 'Netherlands'];

function CountryBar({
  countries,
  flags,
  selected,
  onSelect,
}: {
  countries: string[];
  flags: Map<string, string>;
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const sorted = useMemo(() => {
    const major = countries.filter(c => MAJOR_COUNTRIES.includes(c));
    const rest = countries.filter(c => !MAJOR_COUNTRIES.includes(c)).sort();
    return [...major, ...rest];
  }, [countries]);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1.5 px-3" style={{ scrollbarWidth: 'none' }}>
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
          selected === null
            ? 'bg-primary text-white'
            : 'bg-surface-alt text-text-muted hover:bg-surface-hover'
        }`}
      >
        Tous
      </button>
      {sorted.map(c => (
        <button
          key={c}
          onClick={() => onSelect(c === selected ? null : c)}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            c === selected
              ? 'bg-primary text-white'
              : 'bg-surface-alt text-text-muted hover:bg-surface-hover'
          }`}
        >
          {flags.get(c) && (
            <img src={flags.get(c)} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
          )}
          {c}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position labels                                                    */
/* ------------------------------------------------------------------ */

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0, Defender: 1, Midfielder: 2, Attacker: 3,
};
const POSITION_FR: Record<string, string> = {
  Goalkeeper: 'Gardiens', Defender: 'Défenseurs', Midfielder: 'Milieux', Attacker: 'Attaquants',
};

/* ------------------------------------------------------------------ */
/*  ContextSelector (ContextPicker)                                    */
/* ------------------------------------------------------------------ */

export function ContextSelector({
  contextState,
  onSelectLeague,
  onSelectFixture,
  onSelectTeam,
  onSelectPlayer,
  onClearLevel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [forcedLevel, setForcedLevel] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Data caches
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [loadingSquad, setLoadingSquad] = useState(false);

  // Filters
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [leagueSearch, setLeagueSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [tab, setTab] = useState<'fixtures' | 'teams'>('fixtures');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { context, labels } = contextState;

  // Auto-determine which panel level to show
  const panelLevel = forcedLevel ?? (() => {
    if (!context.league_id) return 1;
    if (context.team_id && !context.player_id) return 3;
    if (context.player_id) return 3;
    return 2;
  })();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setForcedLevel(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load leagues on first open
  useEffect(() => {
    if (!open || leagues.length > 0) return;
    let cancelled = false;
    setLoadingLeagues(true);
    listLeagues()
      .then(data => { if (!cancelled) setLeagues(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingLeagues(false); });
    return () => { cancelled = true; };
  }, [open, leagues.length]);

  // Load teams when league selected
  useEffect(() => {
    if (!context.league_id) { setTeams([]); return; }
    let cancelled = false;
    setLoadingTeams(true);
    listTeams(context.league_id, context.season)
      .then(data => { if (!cancelled) setTeams(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTeams(false); });
    return () => { cancelled = true; };
  }, [context.league_id, context.season]);

  // Load fixtures when league selected
  useEffect(() => {
    if (!context.league_id) { setFixtures([]); return; }
    let cancelled = false;
    setLoadingFixtures(true);
    const season = context.season ?? currentSeason();
    const { from, to } = snapWindow(undefined, 10, 10);
    listFixtures({ leagueId: context.league_id, season, dateFrom: from, dateTo: to })
      .then(data => { if (!cancelled) setFixtures(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingFixtures(false); });
    return () => { cancelled = true; };
  }, [context.league_id, context.season]);

  // Load squad when team selected
  useEffect(() => {
    if (!context.team_id) { setSquad([]); return; }
    let cancelled = false;
    setLoadingSquad(true);
    getSquad(context.team_id)
      .then(data => { if (!cancelled) setSquad(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSquad(false); });
    return () => { cancelled = true; };
  }, [context.team_id]);

  // Derived data
  const countries = useMemo(() => {
    return [...new Set(leagues.map(l => l.country).filter(Boolean))];
  }, [leagues]);

  const countryFlags = useMemo(() => {
    const map = new Map<string, string>();
    leagues.forEach(l => { if (l.country_flag) map.set(l.country, l.country_flag); });
    return map;
  }, [leagues]);

  const filteredLeagues = useMemo(() => {
    let items = leagues;
    if (countryFilter) items = items.filter(l => l.country === countryFilter);
    if (leagueSearch) {
      const s = leagueSearch.toLowerCase();
      items = items.filter(l => l.name.toLowerCase().includes(s) || l.country.toLowerCase().includes(s));
    }
    return items;
  }, [leagues, countryFilter, leagueSearch]);

  const filteredFixtures = useMemo(() => {
    let items = fixtures;
    if (context.team_id) {
      items = items.filter(f => f.home_id === context.team_id || f.away_id === context.team_id);
    }
    if (statusFilter !== 'all') {
      items = items.filter(f => matchStatus(f.status) === statusFilter);
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [fixtures, context.team_id, statusFilter]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return teams;
    const s = teamSearch.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(s));
  }, [teams, teamSearch]);

  const groupedSquad = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    for (const p of squad) {
      const pos = p.position ?? 'Unknown';
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(p);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (POSITION_ORDER[a] ?? 9) - (POSITION_ORDER[b] ?? 9),
    );
  }, [squad]);

  // Group fixtures by day
  const fixturesByDay = useMemo(() => {
    const groups: [string, Fixture[]][] = [];
    let lastDay = '';
    for (const f of filteredFixtures) {
      const day = f.date?.slice(0, 10) ?? '';
      if (day !== lastDay) {
        groups.push([day, []]);
        lastDay = day;
      }
      groups[groups.length - 1][1].push(f);
    }
    return groups;
  }, [filteredFixtures]);

  /* ---------------------------------------------------------------- */
  /*  Breadcrumb                                                       */
  /* ---------------------------------------------------------------- */

  function Breadcrumb() {
    const crumbs: { label: string; logo?: string; onClick?: () => void; level: Exclude<Level, 'none'> }[] = [];

    if (labels.league) {
      crumbs.push({
        label: labels.league.name, logo: labels.league.logo,
        onClick: () => { setForcedLevel(1); },
        level: 'league',
      });
    }
    if (labels.fixture) {
      crumbs.push({
        label: `${labels.fixture.home} – ${labels.fixture.away}`,
        onClick: () => { setForcedLevel(2); setTab('fixtures'); },
        level: 'fixture',
      });
    }
    if (labels.team) {
      crumbs.push({
        label: labels.team.name, logo: labels.team.logo,
        onClick: () => { setForcedLevel(2); setTab('teams'); },
        level: 'team',
      });
    }
    if (labels.player) {
      crumbs.push({
        label: labels.player.name,
        onClick: () => { setForcedLevel(3); },
        level: 'player',
      });
    }

    if (crumbs.length === 0) return null;

    return (
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-1.5 text-[11px] font-semibold text-text-muted overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => { setForcedLevel(1); }}
          className="shrink-0 hover:text-primary transition-colors"
        >
          Ligue
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            <span className="text-text-faint">&rsaquo;</span>
            <button
              onClick={c.onClick}
              className="hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {c.logo && <img src={c.logo} alt="" className="w-3.5 h-3.5 object-contain" />}
              <span className="max-w-[120px] truncate">{c.label}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClearLevel(c.level); setForcedLevel(null); }}
              className="text-text-faint hover:text-primary transition-colors"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Panel content                                                    */
  /* ---------------------------------------------------------------- */

  function PanelContent() {
    // Level 1: Leagues
    if (panelLevel === 1) {
      return (
        <div className="flex flex-col">
          <CountryBar
            countries={countries}
            flags={countryFlags}
            selected={countryFilter}
            onSelect={setCountryFilter}
          />
          {leagues.length > 6 && (
            <div className="px-3 pt-1 pb-1">
              <input
                type="text"
                value={leagueSearch}
                onChange={e => setLeagueSearch(e.target.value)}
                placeholder="Rechercher une ligue..."
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-alt text-xs placeholder:text-text-faint focus:outline-none focus:border-primary-soft"
              />
            </div>
          )}
          <div className="overflow-y-auto max-h-[320px] p-1.5">
            {loadingLeagues ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">Chargement...</div>
            ) : filteredLeagues.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">Aucune ligue</div>
            ) : (
              filteredLeagues.map(l => (
                <button
                  key={l.id}
                  onClick={() => {
                    onSelectLeague({ id: l.id, name: l.name, logo: l.logo, country: l.country });
                    setForcedLevel(2);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[12.5px] font-semibold hover:bg-surface-hover transition-colors ${
                    context.league_id === l.id ? 'text-primary' : 'text-text-strong'
                  }`}
                >
                  {l.logo && <img src={l.logo} alt="" className="w-[18px] h-[18px] object-contain shrink-0" />}
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-[11px] text-text-muted font-normal">{l.country}</span>
                  {context.league_id === l.id && <span className="text-primary font-bold">&#10003;</span>}
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    // Level 2: Tabs (Fixtures | Teams)
    if (panelLevel === 2) {
      return (
        <div className="flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border-light px-3">
            <button
              onClick={() => setTab('fixtures')}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                tab === 'fixtures'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-strong'
              }`}
            >
              Affiches
            </button>
            <button
              onClick={() => setTab('teams')}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                tab === 'teams'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-strong'
              }`}
            >
              Équipes
            </button>
          </div>

          {tab === 'fixtures' ? (
            <div className="flex flex-col">
              {/* Status chips */}
              <div className="flex gap-1.5 px-3 pt-2 pb-1">
                {(['all', 'upcoming', 'live', 'finished'] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      statusFilter === s
                        ? 'bg-primary text-white'
                        : 'bg-surface-alt text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {s === 'all' ? 'Tous' : s === 'upcoming' ? 'À venir' : s === 'live' ? 'En cours' : 'Terminés'}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto max-h-[300px] p-1.5">
                {loadingFixtures ? (
                  <div className="px-3 py-4 text-xs text-text-muted text-center">Chargement...</div>
                ) : fixturesByDay.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-text-muted text-center">Aucun match dans cette période</div>
                ) : (
                  fixturesByDay.map(([day, dayFixtures]) => (
                    <div key={day}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-text-faint uppercase tracking-wider">
                        {fmtDate(day)}
                      </div>
                      {dayFixtures.map(f => {
                        const isLive = matchStatus(f.status) === 'live';
                        const isDone = matchStatus(f.status) === 'finished';
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              onSelectFixture({
                                id: f.id, home: f.home_team, away: f.away_team,
                                homeId: f.home_id, awayId: f.away_id,
                                homeLogo: f.home_logo, awayLogo: f.away_logo,
                                date: f.date, status: f.status, round: f.round,
                              });
                              setForcedLevel(null);
                              setOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] hover:bg-surface-hover transition-colors ${
                              context.fixture_id === f.id ? 'bg-purple-surface' : ''
                            }`}
                          >
                            {isLive && <span className="w-[5px] h-[5px] rounded-full bg-warning animate-[oria-pulse_1.5s_infinite] shrink-0" />}
                            {f.home_logo && <img src={f.home_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                            <span className="font-semibold text-text-strong truncate">{f.home_team}</span>
                            {(isDone || isLive) ? (
                              <span className="font-mono font-bold text-text-strong shrink-0">
                                {f.score_home ?? 0} - {f.score_away ?? 0}
                              </span>
                            ) : (
                              <span className="text-text-faint shrink-0">&ndash;</span>
                            )}
                            <span className="font-semibold text-text-strong truncate">{f.away_team}</span>
                            {f.away_logo && <img src={f.away_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                            {f.round && (
                              <span className="ml-auto text-[10px] text-text-faint truncate max-w-[80px]">
                                {f.round.replace('Regular Season - ', 'J')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="px-3 pt-2 pb-1">
                <input
                  type="text"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Rechercher une équipe..."
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-alt text-xs placeholder:text-text-faint focus:outline-none focus:border-primary-soft"
                />
              </div>
              <div className="overflow-y-auto max-h-[300px] p-1.5">
                {loadingTeams ? (
                  <div className="px-3 py-4 text-xs text-text-muted text-center">Chargement...</div>
                ) : filteredTeams.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-text-muted text-center">Aucune équipe</div>
                ) : (
                  filteredTeams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTeam({ id: t.id, name: t.name, logo: t.logo });
                        setForcedLevel(3);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[12.5px] font-semibold hover:bg-surface-hover transition-colors ${
                        context.team_id === t.id ? 'text-primary' : 'text-text-strong'
                      }`}
                    >
                      {t.logo && <img src={t.logo} alt="" className="w-[18px] h-[18px] object-contain shrink-0" />}
                      <span className="flex-1 truncate">{t.name}</span>
                      {context.team_id === t.id && <span className="text-primary font-bold">&#10003;</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Level 3: Players
    if (panelLevel === 3 && context.team_id) {
      return (
        <div className="overflow-y-auto max-h-[360px] p-1.5">
          {loadingSquad ? (
            <div className="px-3 py-4 text-xs text-text-muted text-center">Chargement...</div>
          ) : groupedSquad.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-muted text-center">Aucun joueur</div>
          ) : (
            groupedSquad.map(([position, players]) => (
              <div key={position}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-text-faint uppercase tracking-wider">
                  {POSITION_FR[position] ?? position}
                </div>
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPlayer({ id: p.id, name: p.name, photo: p.photo, number: p.number });
                      setOpen(false);
                      setForcedLevel(null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[12.5px] font-semibold hover:bg-surface-hover transition-colors ${
                      context.player_id === p.id ? 'text-primary' : 'text-text-strong'
                    }`}
                  >
                    {p.number != null && (
                      <span className="w-6 text-center text-[11px] text-text-muted font-mono shrink-0">{p.number}</span>
                    )}
                    {p.photo && <img src={p.photo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />}
                    <span className="flex-1 truncate">{p.name}</span>
                    {context.player_id === p.id && <span className="text-primary font-bold">&#10003;</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      );
    }

    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Chip display                                                     */
  /* ---------------------------------------------------------------- */

  const chipParts: { label: string; logo?: string; level: Exclude<Level, 'none'> }[] = [];
  if (labels.league) chipParts.push({ label: labels.league.name, logo: labels.league.logo, level: 'league' });
  if (labels.fixture) chipParts.push({ label: `${labels.fixture.home} \u2013 ${labels.fixture.away}`, level: 'fixture' });
  if (labels.team) chipParts.push({ label: labels.team.name, logo: labels.team.logo, level: 'team' });
  if (labels.player) chipParts.push({ label: labels.player.name, level: 'player' });

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Contexte</span>

        {chipParts.map(chip => (
          <span
            key={chip.level}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-xl border text-[12.5px] font-semibold cursor-pointer transition-colors"
            style={{ borderColor: '#C9C3EC', background: '#EEEDFA', color: '#4A3FC0' }}
            onClick={() => {
              setOpen(true);
              if (chip.level === 'league') setForcedLevel(1);
              else if (chip.level === 'fixture' || chip.level === 'team') setForcedLevel(2);
              else if (chip.level === 'player') setForcedLevel(3);
            }}
          >
            {chip.logo && <img src={chip.logo} alt="" className="w-4 h-4 object-contain" />}
            <span className="max-w-[160px] truncate">{chip.label}</span>
            <span
              onClick={e => { e.stopPropagation(); onClearLevel(chip.level); }}
              className="text-primary-muted hover:text-primary cursor-pointer ml-0.5"
            >
              &times;
            </span>
          </span>
        ))}

        <button
          onClick={() => { setOpen(!open); setForcedLevel(null); }}
          className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-border-light text-[12.5px] font-semibold text-text-muted hover:bg-surface-hover transition-colors"
        >
          {chipParts.length === 0 ? 'Sélectionner...' : '+'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Popover panel */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-30 w-[420px] max-h-[60vh] bg-white border border-border rounded-xl shadow-lg overflow-hidden flex flex-col"
          style={{ boxShadow: '0 14px 36px -10px rgba(38,32,74,.24)' }}
        >
          <Breadcrumb />
          <PanelContent />
        </div>
      )}
    </div>
  );
}
