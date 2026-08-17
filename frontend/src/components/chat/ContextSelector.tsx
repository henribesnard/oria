import { useState, useEffect, useMemo, Fragment } from 'react';
import { listLeagues, listTeams, listFixtures, getSquad } from '../../api/catalog';
import type { League, Team, Fixture, Player } from '../../api/catalog';
import {
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
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  initialForcedLevel?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

type StatusFilter = 'all' | 'upcoming' | 'live' | 'finished';
type PeriodFilter = 'all' | 'today' | '7days';

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

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/* ------------------------------------------------------------------ */
/*  Country data                                                       */
/* ------------------------------------------------------------------ */

const MAJOR_COUNTRIES = ['France', 'England', 'Spain', 'Germany', 'Italy', 'Portugal', 'Netherlands'];

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
/*  Tiles                                                              */
/* ------------------------------------------------------------------ */

function LogoTile({ src, size = 32, rounded = 9 }: { src?: string; size?: number; rounded?: number }) {
  return (
    <span
      className="relative bg-white border border-[#EEEDF6] overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: rounded }}
    >
      {src ? (
        <img src={src} alt="" className="w-[70%] h-[70%] object-contain" />
      ) : (
        <span className="text-text-faint text-xs">⚽</span>
      )}
    </span>
  );
}

function PlayerTile({ src, size = 32 }: { src?: string; size?: number }) {
  return (
    <span
      className="relative bg-surface-muted border border-border-inner overflow-hidden flex items-center justify-center shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="#C9C3EC" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill="#C9C3EC" />
        </svg>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Search bar                                                         */
/* ------------------------------------------------------------------ */

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex-none px-4 pt-3 pb-1">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-[11px] bg-surface-light border border-border">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="11" cy="11" r="7" stroke="#B4AFCA" strokeWidth="2" />
          <path d="M20 20l-3.2-3.2" stroke="#B4AFCA" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none min-w-0"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="w-[18px] h-[18px] rounded-full bg-border text-text-muted text-[11px] flex items-center justify-center shrink-0 hover:bg-border-light"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ContextSelector (floating panel)                                   */
/* ------------------------------------------------------------------ */

export function ContextSelector({
  contextState,
  onSelectLeague,
  onSelectFixture,
  onSelectTeam,
  onSelectPlayer,
  onClearLevel,
  open,
  onClose,
  onConfirm,
  initialForcedLevel,
}: Props) {
  const [forcedLevel, setForcedLevel] = useState<number | null>(null);

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
  const [playerSearch, setPlayerSearch] = useState('');
  const [tab, setTab] = useState<'fixtures' | 'teams'>('fixtures');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [showAllCountries, setShowAllCountries] = useState(false);

  const { context, labels } = contextState;

  // Sync forcedLevel from parent
  useEffect(() => {
    if (open && initialForcedLevel != null) {
      setForcedLevel(initialForcedLevel);
    }
  }, [open, initialForcedLevel]);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setShowAllCountries(false);
      setPlayerSearch('');
    }
  }, [open]);

  // Auto-determine which panel level to show
  const panelLevel = forcedLevel ?? (() => {
    if (!context.league_id) return 1;
    if (context.team_id && !context.player_id) return 3;
    if (context.player_id) return 3;
    return 2;
  })();

  // ---- Data loading ----

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

  // ---- Derived data ----

  const countries = useMemo(() => {
    return [...new Set(leagues.map(l => l.country).filter(Boolean))];
  }, [leagues]);

  const countryFlags = useMemo(() => {
    const map = new Map<string, string>();
    leagues.forEach(l => { if (l.country_flag) map.set(l.country, l.country_flag); });
    return map;
  }, [leagues]);

  const sortedCountries = useMemo(() => {
    const major = countries.filter(c => MAJOR_COUNTRIES.includes(c));
    const rest = countries.filter(c => !MAJOR_COUNTRIES.includes(c)).sort();
    return [...major, ...rest];
  }, [countries]);

  const leaguesByCountry = useMemo(() => {
    const map = new Map<string, League[]>();
    for (const l of leagues) {
      const c = l.country || 'Autre';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(l);
    }
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
    if (periodFilter === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      items = items.filter(f => f.date?.slice(0, 10) === today);
    } else if (periodFilter === '7days') {
      const now = new Date();
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);
      items = items.filter(f => {
        const d = new Date(f.date);
        return d >= now && d <= weekLater;
      });
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [fixtures, context.team_id, statusFilter, periodFilter]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return teams;
    const s = teamSearch.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(s));
  }, [teams, teamSearch]);

  const groupedSquad = useMemo(() => {
    let items = squad;
    if (playerSearch) {
      const s = playerSearch.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(s));
    }
    const groups: Record<string, Player[]> = {};
    for (const p of items) {
      const pos = p.position ?? 'Unknown';
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(p);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (POSITION_ORDER[a] ?? 9) - (POSITION_ORDER[b] ?? 9),
    );
  }, [squad, playerSearch]);

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

  // ---- Search value derived from level ----

  const searchValue = panelLevel === 1 ? leagueSearch
    : panelLevel === 2 && tab === 'teams' ? teamSearch
    : panelLevel === 3 ? playerSearch
    : '';

  const searchPlaceholder = panelLevel === 1 ? 'Rechercher une ligue ou un pays…'
    : panelLevel === 2 && tab === 'fixtures' ? 'Rechercher une affiche…'
    : panelLevel === 2 && tab === 'teams' ? 'Rechercher une équipe…'
    : panelLevel === 3 ? 'Rechercher un joueur…'
    : 'Rechercher…';

  const handleSearchChange = (v: string) => {
    if (panelLevel === 1) setLeagueSearch(v);
    else if (panelLevel === 2 && tab === 'teams') setTeamSearch(v);
    else if (panelLevel === 3) setPlayerSearch(v);
  };

  const showSearch = panelLevel === 1 || (panelLevel === 2 && tab === 'teams') || panelLevel === 3;

  // ---- Breadcrumb data ----

  const crumbs: { label: string; logo?: string; onClick: () => void; level: Exclude<Level, 'none'> }[] = [];
  if (labels.league) {
    crumbs.push({
      label: labels.league.name, logo: labels.league.logo,
      onClick: () => { setForcedLevel(1); setShowAllCountries(false); },
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

  // ---- Panel title ----

  const panelTitle = showAllCountries ? 'Pays ou zone'
    : panelLevel === 1 ? 'Choisis une compétition'
    : panelLevel === 2 ? 'Affine : affiche ou équipe'
    : 'Choisis un joueur';

  // ---- Escape key handler ----

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // ---- Render ----

  if (!open) return null;

  return (
    <div
      className="absolute left-0 right-0 bg-white border border-border-light overflow-hidden flex flex-col"
      style={{
        bottom: 'calc(100% + 10px)',
        borderRadius: 18,
        boxShadow: '0 24px 60px -14px rgba(38,32,74,.32)',
        maxHeight: 'min(66vh, 520px)',
        animation: 'oria-panel-in .18s ease both',
        zIndex: 50,
      }}
    >
      {/* ---- Header ---- */}
      <div className="flex-none px-4 pt-3.5 pb-3 border-b border-border-inner">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-text-strong">{panelTitle}</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-[26px] h-[26px] rounded-lg bg-surface-muted text-text-muted flex items-center justify-center text-[15px] hover:bg-purple-surface hover:text-primary-hover transition-colors"
          >
            &times;
          </button>
        </div>
        {crumbs.length > 0 && (
          <div className="flex items-center flex-wrap gap-[5px] mt-2.5">
            {crumbs.map((c, i) => (
              <Fragment key={c.level}>
                <span
                  className="inline-flex items-center gap-[3px] py-[3px] pl-[9px] pr-1 rounded-full"
                  style={{ background: '#EEEDFA', border: '1px solid #DED9FA' }}
                >
                  {c.logo && (
                    <img src={c.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                  )}
                  <button
                    onClick={c.onClick}
                    className="text-[11.5px] font-bold whitespace-nowrap"
                    style={{ color: '#4A3FC0' }}
                  >
                    {c.label}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearLevel(c.level); setForcedLevel(null); }}
                    className="w-[15px] h-[15px] rounded-full text-[11px] flex items-center justify-center hover:bg-purple-border transition-colors"
                    style={{ color: '#4A3FC0' }}
                  >
                    &times;
                  </button>
                </span>
                {i < crumbs.length - 1 && (
                  <span className="text-xs" style={{ color: '#C6C1DC' }}>&rsaquo;</span>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ---- Search ---- */}
      {showSearch && !showAllCountries && (
        <SearchBar
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
        />
      )}

      {/* ---- Country chips (Level 1 only) ---- */}
      {panelLevel === 1 && !showAllCountries && (
        <div className="flex-none flex items-center gap-1.5 overflow-x-auto px-4 pt-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setCountryFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-colors ${
              countryFilter === null
                ? 'bg-purple-surface border-purple-hover text-primary-hover'
                : 'bg-white border-border text-text-muted hover:bg-surface-hover'
            }`}
          >
            Tous
          </button>
          {sortedCountries.slice(0, 5).map(c => (
            <button
              key={c}
              onClick={() => setCountryFilter(c === countryFilter ? null : c)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-colors ${
                c === countryFilter
                  ? 'bg-purple-surface border-purple-hover text-primary-hover'
                  : 'bg-white border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              {countryFlags.get(c) && (
                <img src={countryFlags.get(c)} alt="" className="w-4 h-3 rounded-[2px] object-cover" />
              )}
              {c}
            </button>
          ))}
          {sortedCountries.length > 5 && (
            <button
              onClick={() => setShowAllCountries(true)}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border border-dashed transition-colors hover:bg-surface-hover"
              style={{ borderColor: '#C9C3EC', color: '#5B4FD6' }}
            >
              Tous les pays &rsaquo;
            </button>
          )}
        </div>
      )}

      {/* ---- Countries search (sub-view) ---- */}
      {panelLevel === 1 && showAllCountries && (
        <SearchBar
          value={leagueSearch}
          onChange={setLeagueSearch}
          placeholder="Rechercher un pays…"
        />
      )}

      {/* ---- Segmented tabs (Level 2 only) ---- */}
      {panelLevel === 2 && (
        <div className="flex-none px-4 pt-3 pb-1 space-y-2">
          <div className="flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: '#EFEDF7' }}>
            <button
              onClick={() => setTab('fixtures')}
              className={`flex-1 py-2 rounded-[9px] text-[13px] font-semibold transition-all ${
                tab === 'fixtures'
                  ? 'bg-white text-text-strong shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Une affiche
            </button>
            <button
              onClick={() => setTab('teams')}
              className={`flex-1 py-2 rounded-[9px] text-[13px] font-semibold transition-all ${
                tab === 'teams'
                  ? 'bg-white text-text-strong shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Une &eacute;quipe
            </button>
          </div>

          {tab === 'fixtures' && (
            <>
              {/* Status chips */}
              <div className="flex items-center gap-1.5">
                {(['all', 'upcoming', 'live', 'finished'] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      statusFilter === s
                        ? 'bg-purple-surface border-purple-hover text-primary-hover'
                        : 'bg-white border-border text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {s === 'live' && (
                      <span className="w-[5px] h-[5px] rounded-full bg-warning animate-[oria-pulse_1.5s_infinite]" />
                    )}
                    {s === 'all' ? 'Tous' : s === 'upcoming' ? 'À venir' : s === 'live' ? 'En direct' : 'Terminés'}
                  </button>
                ))}
              </div>
              {/* Period chips */}
              <div className="flex items-center gap-1.5">
                {(['all', 'today', '7days'] as PeriodFilter[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      periodFilter === p
                        ? 'bg-purple-surface border-purple-hover text-primary-hover'
                        : 'bg-white border-border text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {p === 'all' ? 'Tout' : p === 'today' ? "Aujourd'hui" : '7 jours'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- Search for teams tab ---- */}
      {panelLevel === 2 && tab === 'teams' && (
        <SearchBar
          value={teamSearch}
          onChange={setTeamSearch}
          placeholder="Rechercher une équipe…"
        />
      )}

      {/* ---- Body (scrollable) ---- */}
      <div className="oria-thin flex-1 overflow-y-auto min-h-[100px]">
        {/* Countries sub-view */}
        {panelLevel === 1 && showAllCountries && (
          <div className="py-1 px-2.5">
            {(leagueSearch
              ? sortedCountries.filter(c => c.toLowerCase().includes(leagueSearch.toLowerCase()))
              : sortedCountries
            ).map(c => (
              <button
                key={c}
                onClick={() => {
                  setCountryFilter(c);
                  setShowAllCountries(false);
                  setLeagueSearch('');
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[11px] hover:bg-surface-hover transition-colors"
              >
                {countryFlags.get(c) ? (
                  <img src={countryFlags.get(c)} alt="" className="w-5 h-4 rounded-[3px] object-cover shrink-0" />
                ) : (
                  <span className="w-5 h-4 rounded-[3px] bg-surface-muted flex items-center justify-center shrink-0 text-[10px] font-bold text-text-disabled">
                    {c.charAt(0)}
                  </span>
                )}
                <span className="flex-1 text-[13px] font-semibold text-text-strong text-left">{c}</span>
                <span className="text-[11px] text-text-disabled">
                  {leaguesByCountry.get(c)?.map(l => l.name).join(', ')}
                </span>
                <span className="text-text-faint text-[15px] shrink-0">&rsaquo;</span>
              </button>
            ))}
            {leagueSearch && sortedCountries.filter(c => c.toLowerCase().includes(leagueSearch.toLowerCase())).length === 0 && (
              <div className="py-6 text-center">
                <p className="text-[13px] text-text-muted">Aucun pays trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Leagues list */}
        {panelLevel === 1 && !showAllCountries && (
          <div className="py-1 px-2.5">
            {loadingLeagues ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-text-muted mt-2">Chargement…</p>
              </div>
            ) : filteredLeagues.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[13px] font-semibold text-text-secondary">Aucune ligue</p>
                <p className="text-[12px] text-text-disabled mt-1">Essaie un autre filtre ou pays.</p>
              </div>
            ) : (
              filteredLeagues.map(l => (
                <button
                  key={l.id}
                  onClick={() => {
                    onSelectLeague({ id: l.id, name: l.name, logo: l.logo, country: l.country });
                    setForcedLevel(2);
                  }}
                  className={`w-full flex items-center gap-[11px] rounded-[11px] hover:bg-surface-hover transition-colors ${
                    context.league_id === l.id ? 'bg-purple-surface' : ''
                  }`}
                  style={{ padding: '9px 12px' }}
                >
                  <LogoTile src={l.logo} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[13px] font-semibold text-text-strong truncate">{l.name}</div>
                    <div className="text-[11px] text-text-muted">{l.country}</div>
                  </div>
                  <span className="text-text-faint text-[15px] shrink-0">&rsaquo;</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Fixtures list */}
        {panelLevel === 2 && tab === 'fixtures' && (
          <div className="py-1 px-2.5">
            {loadingFixtures ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-text-muted mt-2">Chargement…</p>
              </div>
            ) : fixturesByDay.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <div className="w-[38px] h-[38px] rounded-[11px] bg-surface-muted flex items-center justify-center mx-auto mb-2.5 text-lg">
                  &#9917;
                </div>
                <p className="text-[13px] font-semibold text-text-secondary">Aucun match dans cette période</p>
                <p className="text-[12px] text-text-disabled mt-1">Élargis le filtre ou change de période.</p>
              </div>
            ) : (
              fixturesByDay.map(([day, dayFixtures]) => (
                <div key={day}>
                  <p className="text-[10.5px] font-extrabold tracking-[.7px] uppercase text-text-disabled mx-2.5 mt-2 mb-1">
                    {fmtDate(day)}
                  </p>
                  {dayFixtures.map(f => {
                    const isLive = matchStatus(f.status) === 'live';
                    const isDone = matchStatus(f.status) === 'finished';
                    const hasScore = isDone || isLive;
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
                          onClose();
                        }}
                        className={`w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors ${
                          context.fixture_id === f.id ? 'bg-purple-surface' : ''
                        }`}
                      >
                        <div className="w-full flex items-center gap-2.5">
                          {/* Home */}
                          <span className="flex-1 flex items-center gap-2 justify-end min-w-0">
                            <span className="text-[13px] font-semibold text-text-strong text-right truncate">
                              {f.home_team}
                            </span>
                            <LogoTile src={f.home_logo} size={22} rounded={6} />
                          </span>
                          {/* Score */}
                          <span className="flex-none min-w-[52px] text-center">
                            {hasScore ? (
                              <span className="font-mono text-[15px] font-bold text-text-strong">
                                {f.score_home ?? 0}&thinsp;&ndash;&thinsp;{f.score_away ?? 0}
                              </span>
                            ) : (
                              <span className="text-[12px] text-text-muted">{fmtTime(f.date)}</span>
                            )}
                          </span>
                          {/* Away */}
                          <span className="flex-1 flex items-center gap-2 min-w-0">
                            <LogoTile src={f.away_logo} size={22} rounded={6} />
                            <span className="text-[13px] font-semibold text-text-strong truncate">
                              {f.away_team}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
                          {f.round && (
                            <>
                              <span className="font-bold text-text-disabled">
                                {f.round.replace('Regular Season - ', 'J')}
                              </span>
                              <span>&middot;</span>
                            </>
                          )}
                          {isLive && (
                            <>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-[5px] h-[5px] rounded-full bg-warning animate-[oria-pulse_1.5s_infinite]" />
                                <span className="font-bold" style={{ color: '#C4691F' }}>
                                  {f.elapsed}&apos;
                                </span>
                              </span>
                              <span>&middot;</span>
                            </>
                          )}
                          <span>{fmtDate(f.date)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Teams list */}
        {panelLevel === 2 && tab === 'teams' && (
          <div className="py-1 px-2.5">
            {loadingTeams ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-text-muted mt-2">Chargement…</p>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[13px] font-semibold text-text-secondary">Aucune équipe</p>
              </div>
            ) : (
              filteredTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTeam({ id: t.id, name: t.name, logo: t.logo });
                    setForcedLevel(3);
                  }}
                  className={`w-full flex items-center gap-[11px] rounded-[11px] hover:bg-surface-hover transition-colors ${
                    context.team_id === t.id ? 'bg-purple-surface' : ''
                  }`}
                  style={{ padding: '9px 12px' }}
                >
                  <LogoTile src={t.logo} />
                  <span className="flex-1 text-[13px] font-semibold text-text-strong text-left truncate">{t.name}</span>
                  <span className="text-text-faint text-[15px] shrink-0">&rsaquo;</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Players list */}
        {panelLevel === 3 && context.team_id && (
          <div className="py-1 px-2.5">
            {loadingSquad ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-text-muted mt-2">Chargement…</p>
              </div>
            ) : groupedSquad.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-[13px] font-semibold text-text-secondary">Effectif indisponible</p>
                <p className="text-[12px] text-text-disabled mt-1">Pose ta question au niveau équipe.</p>
              </div>
            ) : (
              groupedSquad.map(([position, players]) => (
                <div key={position}>
                  <p className="text-[10.5px] font-extrabold tracking-[.7px] uppercase text-text-disabled mx-2.5 mt-2.5 mb-1">
                    {POSITION_FR[position] ?? position}
                  </p>
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPlayer({ id: p.id, name: p.name, photo: p.photo, number: p.number });
                        onClose();
                        setForcedLevel(null);
                      }}
                      className={`w-full flex items-center gap-[11px] rounded-[11px] hover:bg-surface-hover transition-colors ${
                        context.player_id === p.id ? 'bg-purple-surface' : ''
                      }`}
                      style={{ padding: '9px 12px' }}
                    >
                      {p.number != null && (
                        <span className="w-6 text-center font-mono text-xs font-bold text-text-disabled shrink-0">
                          {p.number}
                        </span>
                      )}
                      <PlayerTile src={p.photo} />
                      <span className="flex-1 text-[13px] font-semibold text-text-strong text-left truncate">{p.name}</span>
                      <span className="text-text-faint text-[15px] shrink-0">&rsaquo;</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="flex-none flex items-center justify-between gap-3 px-4 py-3 border-t border-border-inner bg-surface-alt">
        <span className="text-[11.5px] text-text-disabled leading-snug">
          {showAllCountries
            ? 'Sélection dépendante · instantané depuis le cache'
            : "Arrête-toi à n\u2019importe quel niveau."}
        </span>
        {showAllCountries ? (
          <button
            onClick={() => { setShowAllCountries(false); setLeagueSearch(''); }}
            className="px-[18px] py-2 rounded-[10px] bg-primary hover:bg-primary-hover text-white text-[13px] font-bold transition-colors shrink-0"
          >
            Terminé
          </button>
        ) : (
          <button
            onClick={onConfirm}
            className="px-[18px] py-2 rounded-[10px] bg-primary hover:bg-primary-hover text-white text-[13px] font-bold transition-colors shrink-0"
          >
            Poser ma question
          </button>
        )}
      </div>
    </div>
  );
}
