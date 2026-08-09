import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OriaLogo from '../components/OriaLogo';
import { listFixtures, listLiveFixtures, listLeagues } from '../api/catalog';
import type { Fixture, League } from '../api/catalog';
import { ZONES, MAJOR_LEAGUE_IDS, getZoneForCountry } from '../utils/leagueFilters';

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
/* ------------------------------------------------------------------ */

type TabKey = 'live' | 'ft' | 'pre';

function fixtureTab(status?: string): TabKey {
  if (!status) return 'pre';
  const s = status.toUpperCase();
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(s)) return 'live';
  if (['FT', 'AET', 'PEN', 'WO', 'AWD', 'CANC', 'ABD'].includes(s)) return 'ft';
  return 'pre';
}

function statusLabel(tab: TabKey) {
  if (tab === 'live') return 'En direct';
  if (tab === 'ft') return 'Terminé';
  return 'À venir';
}

function statusStyle(tab: TabKey): { fg: string; bg: string } {
  if (tab === 'live') return { fg: '#C4691F', bg: '#FBEEE2' };
  if (tab === 'ft') return { fg: '#86829A', bg: '#F3F2F9' };
  return { fg: '#4A3FC0', bg: '#EEEDFA' };
}

function scoreColor(tab: TabKey) {
  if (tab === 'live') return '#C4691F';
  return '#191526';
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'live', label: 'En direct' },
  { key: 'ft', label: 'Terminés' },
  { key: 'pre', label: 'À venir' },
];

/* ------------------------------------------------------------------ */
/*  Logo helper                                                        */
/* ------------------------------------------------------------------ */

function TeamLogo({ src, alt, size = 24 }: { src?: string; alt: string; size?: number }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <span style={{
        width: size, height: size, borderRadius: size > 30 ? 12 : 6, background: '#F3F2F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size > 30 ? 14 : 9, fontWeight: 700, color: '#86829A',
        fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0,
      }}>{alt.slice(0, 3).toUpperCase()}</span>
    );
  }
  return (
    <img
      src={src} alt={alt}
      onError={() => setError(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function LeagueFilter({
  value,
  onChange,
  leagues,
}: {
  value: string;
  onChange: (v: string) => void;
  leagues: League[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="hide-sm" style={{ fontSize: 12, color: '#86829A', fontWeight: 600 }}>Ligue</span>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, color: '#3F3B54',
          padding: '8px 12px', border: '1px solid #E1DEF0', borderRadius: 10,
          background: '#fff', cursor: 'pointer', minWidth: 170, fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>{value || 'Toutes les ligues'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" stroke="#86829A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 21,
          width: 260, maxHeight: 280, overflowY: 'auto',
          background: '#fff', border: '1px solid #E4E1F0', borderRadius: 12,
          boxShadow: '0 18px 44px -14px rgba(38,32,74,.28)', padding: 6,
        }}>
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', border: 'none', borderRadius: 9, cursor: 'pointer',
              textAlign: 'left', fontSize: 13.5, fontWeight: 600,
              color: '#3F3B54', background: value === '' ? '#F5F4FC' : 'transparent',
              fontFamily: 'inherit',
            }}
          >
            Toutes les ligues
            {value === '' && <span style={{ color: '#5B4FD6', fontWeight: 700, flex: 'none', marginLeft: 'auto' }}>✓</span>}
          </button>
          {leagues.map((l) => (
            <button
              key={l.id}
              onClick={() => { onChange(l.name); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', border: 'none', borderRadius: 9, cursor: 'pointer',
                textAlign: 'left', fontSize: 13.5, fontWeight: 600,
                color: '#3F3B54', background: value === l.name ? '#F5F4FC' : 'transparent',
                fontFamily: 'inherit',
              }}
            >
              {l.logo && <img src={l.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
              {l.name}
              {value === l.name && <span style={{ color: '#5B4FD6', fontWeight: 700, flex: 'none', marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----- Scoreboard match card ----- */
function BoardCard({ fixture, onClick }: { fixture: Fixture; onClick: () => void }) {
  const tab = fixtureTab(fixture.status);
  const ss = statusStyle(tab);
  const sc = scoreColor(tab);
  const clock = tab === 'live' && fixture.elapsed ? `${fixture.elapsed}'` : undefined;

  return (
    <button
      onClick={onClick}
      style={{
        scrollSnapAlign: 'start', flex: 'none', width: 238,
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 14, border: '1px solid #E9E7F2', borderRadius: 14,
        background: '#fff', cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', transition: 'border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9C3EC'; e.currentTarget.style.boxShadow = '0 6px 18px -8px rgba(38,32,74,.22)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E9E7F2'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* League & status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {fixture.league_logo && <img src={fixture.league_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: '#86829A' }}>{fixture.league_name}</span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
          color: ss.fg, background: ss.bg,
        }}>
          {tab === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E0782A' }} />}
          {clock || statusLabel(tab)}
        </span>
      </div>

      {/* Home row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <TeamLogo src={fixture.home_logo} alt={fixture.home_team} size={24} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#221E33', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixture.home_team}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, color: sc }}>{fixture.score_home ?? ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <TeamLogo src={fixture.away_logo} alt={fixture.away_team} size={24} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#221E33', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixture.away_team}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, color: sc }}>{fixture.score_away ?? ''}</span>
        </div>
      </div>
    </button>
  );
}

/* ----- Match detail modal ----- */
function MatchModal({ fixture, onClose }: { fixture: Fixture; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const tab = fixtureTab(fixture.status);
  const scoreLine = fixture.score_home != null ? `${fixture.score_home} – ${fixture.score_away}` : 'vs';
  const dateStr = fixture.date ? new Date(fixture.date).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '';
  const clock = tab === 'live' && fixture.elapsed ? `${fixture.elapsed}'` : fixture.status_long || '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(25,21,38,.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'oria-msg-in .2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="full-sm"
        style={{
          width: 440, maxWidth: '100%', background: '#fff', borderRadius: 20,
          boxShadow: '0 30px 70px -20px rgba(25,21,38,.5)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '16px 20px', borderBottom: '1px solid #F0EEF8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fixture.league_logo && <img src={fixture.league_logo} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4A3FC0' }}>{fixture.league_name}</span>
            {fixture.round && <span style={{ fontSize: 11, color: '#86829A' }}>· {fixture.round}</span>}
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: '#F3F2F9', width: 28, height: 28, borderRadius: 9, color: '#86829A', cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>

        {/* Teams & Score */}
        <div style={{ padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <TeamLogo src={fixture.home_logo} alt={fixture.home_team} size={48} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fixture.home_team}</span>
            </div>
            <div style={{ flex: 'none', textAlign: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 600, color: '#191526' }}>{scoreLine}</span>
              <p style={{ fontSize: 11, color: '#86829A', margin: '4px 0 0' }}>{clock}</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <TeamLogo src={fixture.away_logo} alt={fixture.away_team} size={48} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fixture.away_team}</span>
            </div>
          </div>

          {/* Info */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F0EEF8', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#605C74' }}>
              <span style={{ color: '#86829A' }}>Quand</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{dateStr}</span>
            </div>
            {fixture.venue?.name && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#605C74' }}>
                <span style={{ color: '#86829A' }}>Stade</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ''}</span>
              </div>
            )}
            {fixture.referee && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#605C74' }}>
                <span style={{ color: '#86829A' }}>Arbitre</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fixture.referee}</span>
              </div>
            )}
          </div>

          <Link
            to="/app"
            state={{
              fixture_id: fixture.id,
              league_id: fixture.league_id,
              _fixture_home: fixture.home_team,
              _fixture_away: fixture.away_team,
              _fixture_home_logo: fixture.home_logo,
              _fixture_away_logo: fixture.away_logo,
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', marginTop: 20, border: 'none', background: '#5B4FD6', color: '#fff',
              cursor: 'pointer', fontSize: 14.5, fontWeight: 700, padding: 13, borderRadius: 12,
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>＋</span> Ajouter ce match au chat
          </Link>
          <p style={{ fontSize: 11.5, color: '#A5A0BC', textAlign: 'center', margin: '10px 0 0' }}>
            Oria s'ouvrira avec ce match déjà en contexte.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing component                                            */
/* ------------------------------------------------------------------ */

export function Landing() {
  const [activeTab, setActiveTab] = useState<TabKey>('pre');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'yesterday' | 'today' | 'tomorrow'
  const [showAllLeagues, setShowAllLeagues] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Fixture | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  /* Load fixtures and leagues from API */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [todayFixtures, liveFixtures, leagueData] = await Promise.all([
          listFixtures({ date: today }).catch(() => [] as Fixture[]),
          listLiveFixtures().catch(() => [] as Fixture[]),
          listLeagues().catch(() => [] as League[]),
        ]);
        if (cancelled) return;

        // Deduplicate by id (live first for freshest data)
        const seen = new Set<number>();
        const all: Fixture[] = [];
        for (const f of [...liveFixtures, ...todayFixtures]) {
          if (!seen.has(f.id)) {
            seen.add(f.id);
            all.push(f);
          }
        }
        setFixtures(all);
        setLeagues(leagueData);

        // Auto-select best tab
        const liveCount = all.filter(f => fixtureTab(f.status) === 'live').length;
        const ftCount = all.filter(f => fixtureTab(f.status) === 'ft').length;
        if (liveCount > 0) setActiveTab('live');
        else if (ftCount > 0) setActiveTab('ft');
        else setActiveTab('pre');
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* Derived */
  const filteredFixtures = fixtures.filter((f) => {
    if (fixtureTab(f.status) !== activeTab) return false;
    // Filtre par ligue maj
eures si showAllLeagues est false
    if (!showAllLeagues && f.league_id && !MAJOR_LEAGUE_IDS.has(f.league_id)) return false;
    // Filtre par zone si sélectionnée
    if (zoneFilter && f.league_country) {
      const zone = getZoneForCountry(f.league_country);
      if (zone?.id !== zoneFilter) return false;
    }
    // Filtre par ligue si sélectionnée
    if (leagueFilter && f.league_name !== leagueFilter) return false;
    return true;
  });

  const counts: Record<TabKey, number> = {
    live: fixtures.filter((f) => {
      if (fixtureTab(f.status) !== 'live') return false;
      if (!showAllLeagues && f.league_id && !MAJOR_LEAGUE_IDS.has(f.league_id)) return false;
      if (zoneFilter && f.league_country) {
        const zone = getZoneForCountry(f.league_country);
        if (zone?.id !== zoneFilter) return false;
      }
      if (leagueFilter && f.league_name !== leagueFilter) return false;
      return true;
    }).length,
    ft: fixtures.filter((f) => {
      if (fixtureTab(f.status) !== 'ft') return false;
      if (!showAllLeagues && f.league_id && !MAJOR_LEAGUE_IDS.has(f.league_id)) return false;
      if (zoneFilter && f.league_country) {
        const zone = getZoneForCountry(f.league_country);
        if (zone?.id !== zoneFilter) return false;
      }
      if (leagueFilter && f.league_name !== leagueFilter) return false;
      return true;
    }).length,
    pre: fixtures.filter((f) => {
      if (fixtureTab(f.status) !== 'pre') return false;
      if (!showAllLeagues && f.league_id && !MAJOR_LEAGUE_IDS.has(f.league_id)) return false;
      if (zoneFilter && f.league_country) {
        const zone = getZoneForCountry(f.league_country);
        if (zone?.id !== zoneFilter) return false;
      }
      if (leagueFilter && f.league_name !== leagueFilter) return false;
      return true;
    }).length,
  };

  const liveCount = fixtures.filter((f) => fixtureTab(f.status) === 'live').length;

  // Unique leagues from loaded fixtures (for filter when no league API data)
  const fixtureLeagues = [...new Map(
    fixtures
      .filter(f => f.league_name)
      .map(f => [f.league_name!, { id: f.league_id ?? 0, name: f.league_name!, logo: f.league_logo, country: f.league_country ?? '' } as League])
  ).values()];

  let displayLeagues = leagues.length > 0 ? leagues : fixtureLeagues;

  // Filtrer les ligues par zone si sélectionnée
  if (zoneFilter) {
    displayLeagues = displayLeagues.filter(l => {
      const zone = getZoneForCountry(l.country);
      return zone?.id === zoneFilter;
    });
  }

  // Filtrer par ligues majeures si showAllLeagues est false
  if (!showAllLeagues) {
    displayLeagues = displayLeagues.filter(l => MAJOR_LEAGUE_IDS.has(l.id));
  }

  return (
    <div className="min-h-screen bg-surface">

      {/* ============================================================ */}
      {/*  SCOREBOARD                                                  */}
      {/* ============================================================ */}
      <div style={{ borderBottom: '1px solid #E9E7F2', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 20px' }}>
          {/* Tabs + League filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', padding: 3, background: '#F3F2F9', borderRadius: 11, gap: 2 }}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 9,
                      whiteSpace: 'nowrap',
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? '#191526' : '#86829A',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                    }}
                  >
                    {tab.key === 'live' && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E0782A', animation: 'oriaPulse 1.5s infinite' }} />
                    )}
                    {tab.label}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: isActive ? '#191526' : '#B4AFCA' }}>
                      {counts[tab.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Zone filter */}
            <div className="hide-sm" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#86829A', fontWeight: 600 }}>Zone</span>
              <select
                value={zoneFilter}
                onChange={(e) => { setZoneFilter(e.target.value); setLeagueFilter(''); }}
                style={{
                  fontSize: 13, fontWeight: 600, color: '#3F3B54',
                  padding: '8px 12px', border: '1px solid #E1DEF0', borderRadius: 10,
                  background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <option value="">Toutes les zones</option>
                {ZONES.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>

            {/* League filter */}
            <div>
              <LeagueFilter value={leagueFilter} onChange={setLeagueFilter} leagues={displayLeagues} />
            </div>

            {/* Show all toggle */}
            <button
              onClick={() => setShowAllLeagues(!showAllLeagues)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, color: showAllLeagues ? '#5B4FD6' : '#86829A',
                padding: '8px 12px', border: '1px solid' + (showAllLeagues ? ' #C9C3EC' : ' #E1DEF0'),
                borderRadius: 10, background: showAllLeagues ? '#EEEDFA' : '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              title={showAllLeagues ? 'Afficher uniquement les ligues majeures' : 'Afficher toutes les ligues'}
            >
              {showAllLeagues ? '🌍 Toutes' : '⭐ Majeures'}
            </button>
          </div>

          {/* Horizontal scrolling match cards */}
          <div className="oria-sc" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '14px 2px 4px', scrollSnapType: 'x proximity' }}>
            {loading ? (
              <div style={{ flex: 1, padding: 22, textAlign: 'center', fontSize: 13, color: '#B4AFCA' }}>
                Chargement des matchs...
              </div>
            ) : filteredFixtures.length > 0 ? (
              filteredFixtures.map((f) => (
                <BoardCard key={f.id} fixture={f} onClick={() => setSelectedMatch(f)} />
              ))
            ) : (
              <div style={{ flex: 1, padding: 22, textAlign: 'center', fontSize: 13, color: '#B4AFCA' }}>
                Aucun match dans cette sélection.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  HERO SECTION                                                */}
      {/* ============================================================ */}
      <section className="grid-2" style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 40px', alignItems: 'center', gap: 48 }}>
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999,
            background: '#EEEDFA', border: '1px solid #DED9FA',
            fontSize: 12.5, fontWeight: 600, color: '#4A3FC0',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E0782A', animation: 'oriaPulse 1.5s infinite' }} />
            {liveCount > 0 ? `${liveCount} rencontres en direct maintenant` : 'Données fraîches en continu'}
          </span>

          <h1 className="font-serif" style={{ fontWeight: 400, fontSize: 'clamp(38px,9vw,60px)', lineHeight: 1.03, letterSpacing: '-.5px', margin: '20px 0 0' }}>
            L'oracle du sport,<br />en langage naturel.
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#605C74', maxWidth: 480, margin: '20px 0 0' }}>
            Pose n'importe quelle question sur le foot — résultats, forme, compos,
            cotes, tendances. Oria répond à partir de données fraîches, et te laisse
            cadrer la question au niveau ligue, match, équipe ou joueur.
          </p>

          <div className="stack-sm" style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <Link
              to="/register"
              style={{
                border: 'none', background: '#5B4FD6', color: '#fff',
                fontSize: 15, fontWeight: 700, padding: '14px 26px', borderRadius: 12,
                boxShadow: '0 8px 20px -6px rgba(91,79,214,.5)', textDecoration: 'none', textAlign: 'center',
              }}
            >
              Commencer gratuitement
            </Link>
            <Link
              to="/app"
              style={{
                border: '1px solid #E1DEF0', background: '#fff', color: '#221E33',
                fontSize: 15, fontWeight: 600, padding: '14px 26px', borderRadius: 12,
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              Voir une démo
            </Link>
          </div>

          <p style={{ fontSize: 13, color: '#A5A0BC', marginTop: 16 }}>
            Sans carte bancaire · 20 questions / jour offertes
          </p>

          {/* Stats counters */}
          <div style={{ display: 'flex', gap: 32, marginTop: 26, flexWrap: 'wrap' }}>
            <div>
              <p className="font-mono" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#191526' }}>{displayLeagues.length || '—'}</p>
              <p style={{ fontSize: 12.5, color: '#86829A', margin: '2px 0 0' }}>ligues couvertes</p>
            </div>
            <div style={{ borderLeft: '1px solid #E9E7F2', paddingLeft: 32 }}>
              <p className="font-mono" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#191526' }}>{fixtures.length > 0 ? `${fixtures.length}+` : '—'}</p>
              <p style={{ fontSize: 12.5, color: '#86829A', margin: '2px 0 0' }}>matchs suivis</p>
            </div>
            <div style={{ borderLeft: '1px solid #E9E7F2', paddingLeft: 32 }}>
              <p className="font-mono" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#191526' }}>2 h</p>
              <p style={{ fontSize: 12.5, color: '#86829A', margin: '2px 0 0' }}>fraîcheur moyenne</p>
            </div>
          </div>
        </div>

        {/* Mock chat preview */}
        <div style={{ background: '#fff', border: '1px solid #EDEBF6', borderRadius: 22, boxShadow: '0 30px 60px -24px rgba(38,32,74,.28)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px 14px', borderBottom: '1px solid #F0EEF8' }}>
            <OriaLogo size={24} />
            <span className="font-serif" style={{ fontSize: 20 }}>Oria</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#3B9B6E' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B9B6E' }} />
              à jour il y a 2 h
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '16px 2px 8px' }}>
            <span style={{ padding: '5px 11px', borderRadius: 999, background: '#EEEDFA', border: '1px solid #DED9FA', fontSize: 12, fontWeight: 600, color: '#4A3FC0' }}>Ligue 1</span>
            <span style={{ padding: '5px 11px', borderRadius: 999, background: '#EEEDFA', border: '1px solid #DED9FA', fontSize: 12, fontWeight: 600, color: '#4A3FC0' }}>Paris SG</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#5B4FD6', color: '#fff', borderRadius: '16px 4px 16px 16px', padding: '11px 15px', fontSize: 14 }}>Son prochain match ?</div>
          </div>
          <div style={{ background: '#FAFAFE', border: '1px solid #EEEDF6', borderRadius: 14, padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>Paris SG</div>
              <span style={{ fontSize: 10, color: '#86829A', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>reçoit</span>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Le Havre</div>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #EEEDF6', fontSize: 12, color: '#86829A', textAlign: 'center' }}>
              <span style={{ color: '#5B4FD6', fontWeight: 600 }}>Ligue 1</span> · sam. 17 août 21:00 · Parc des Princes
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-purple-surface flex items-center justify-center font-serif text-[22px] text-primary">+</div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Sélecteur de contexte</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Cadre ta question en un geste : pays &rarr; ligue &rarr; match ou équipe &rarr; joueur. Optionnel, jamais imposé.
            </p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-success-surface flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-success" />
            </div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Fraîcheur affichée</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Chaque réponse indique quand la donnée a été rafraîchie. Pas de réponse &laquo; au pif &raquo;.
            </p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-warning-surface flex items-center justify-center font-mono font-semibold text-warning-text">1.9</div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Cotes & tendances</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Compos probables, forme récente, cotes et statistiques, réservées au palier Premium.
            </p>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 8px', textAlign: 'center' }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#A5A0BC', marginBottom: 18 }}>Couverture</p>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {displayLeagues.map((league) => (
            <span key={league.id} className="inline-flex items-center gap-2 px-4 py-[9px] rounded-full bg-white border border-border text-[13.5px] font-semibold text-text-dark">
              {league.logo && <img src={league.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
              {league.name}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 13, color: '#A5A0BC', marginTop: 16 }}>
          ...et bientôt d'autres sports. L'identité d'Oria reste neutre.
        </p>
      </section>

      {/* CTA gradient */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div className="bg-gradient-to-br from-primary to-primary-light rounded-3xl px-10 py-[52px] text-center text-white">
          <h2 className="font-serif font-normal text-[38px]">Prêt à interroger l'oracle ?</h2>
          <p className="text-base opacity-85 mt-3 mb-[26px]">
            Commence gratuitement. Passe en Premium quand tu veux le direct et les analyses.
          </p>
          <div className="flex gap-3 justify-center flex-col sm:flex-row">
            <Link to="/register" className="px-7 py-3.5 text-[15px] font-bold text-primary-hover bg-white hover:bg-surface rounded-xl transition-colors text-center">
              Créer mon compte
            </Link>
            <Link to="/pricing" className="px-7 py-3.5 text-[15px] font-semibold text-white border border-white/40 hover:border-white/70 rounded-xl transition-colors text-center">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-text-faint">&copy; {new Date().getFullYear()} Oria — Assistant football intelligent</p>
      </footer>

      {/* Match detail modal */}
      {selectedMatch && <MatchModal fixture={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </div>
  );
}
