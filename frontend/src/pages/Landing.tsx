import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OriaLogo from '../components/OriaLogo';

/* ------------------------------------------------------------------ */
/*  Static demo data                                                  */
/* ------------------------------------------------------------------ */

const leagues = [
  'Ligue 1', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Eredivisie',
];

type MatchStatus = 'live' | 'ft' | 'pre';

interface Match {
  id: number;
  league: string;
  leagueAbbr: string;
  homeTeam: string;
  homeAbbr: string;
  awayTeam: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  clock: string;
  date: string;
  venue: string;
  homeForm: ('W' | 'D' | 'L')[];
  awayForm: ('W' | 'D' | 'L')[];
}

const MATCHES: Match[] = [
  {
    id: 1, league: 'Ligue 1', leagueAbbr: 'L1',
    homeTeam: 'Paris SG', homeAbbr: 'PSG',
    awayTeam: 'Olympique Lyonnais', awayAbbr: 'OL',
    homeScore: 2, awayScore: 1, status: 'live', clock: '67\'',
    date: '25 juil. 2026 · 21:00', venue: 'Parc des Princes',
    homeForm: ['W', 'W', 'D', 'W', 'L'], awayForm: ['L', 'D', 'W', 'W', 'D'],
  },
  {
    id: 2, league: 'Ligue 1', leagueAbbr: 'L1',
    homeTeam: 'Olympique de Marseille', homeAbbr: 'OM',
    awayTeam: 'AS Monaco', awayAbbr: 'ASM',
    homeScore: 1, awayScore: 1, status: 'live', clock: '34\'',
    date: '25 juil. 2026 · 21:00', venue: 'Orange Vélodrome',
    homeForm: ['W', 'D', 'W', 'L', 'W'], awayForm: ['W', 'W', 'W', 'D', 'L'],
  },
  {
    id: 3, league: 'Premier League', leagueAbbr: 'PL',
    homeTeam: 'Arsenal', homeAbbr: 'ARS',
    awayTeam: 'Chelsea', awayAbbr: 'CHE',
    homeScore: 3, awayScore: 0, status: 'ft', clock: '90\'',
    date: '25 juil. 2026 · 18:30', venue: 'Emirates Stadium',
    homeForm: ['W', 'W', 'W', 'D', 'W'], awayForm: ['L', 'L', 'D', 'W', 'D'],
  },
  {
    id: 4, league: 'La Liga', leagueAbbr: 'LL',
    homeTeam: 'FC Barcelona', homeAbbr: 'FCB',
    awayTeam: 'Real Madrid', awayAbbr: 'RMA',
    homeScore: 2, awayScore: 2, status: 'ft', clock: '90\'',
    date: '25 juil. 2026 · 19:00', venue: 'Camp Nou',
    homeForm: ['W', 'D', 'W', 'W', 'D'], awayForm: ['W', 'W', 'L', 'W', 'W'],
  },
  {
    id: 5, league: 'Serie A', leagueAbbr: 'SA',
    homeTeam: 'Juventus', homeAbbr: 'JUV',
    awayTeam: 'AC Milan', awayAbbr: 'ACM',
    homeScore: null, awayScore: null, status: 'pre', clock: '20:45',
    date: '26 juil. 2026 · 20:45', venue: 'Allianz Stadium',
    homeForm: ['W', 'D', 'D', 'W', 'W'], awayForm: ['L', 'W', 'D', 'L', 'W'],
  },
  {
    id: 6, league: 'Bundesliga', leagueAbbr: 'BL',
    homeTeam: 'Bayern München', homeAbbr: 'BAY',
    awayTeam: 'Borussia Dortmund', awayAbbr: 'BVB',
    homeScore: null, awayScore: null, status: 'pre', clock: '18:30',
    date: '26 juil. 2026 · 18:30', venue: 'Allianz Arena',
    homeForm: ['W', 'W', 'W', 'W', 'D'], awayForm: ['D', 'W', 'L', 'W', 'W'],
  },
  {
    id: 7, league: 'Premier League', leagueAbbr: 'PL',
    homeTeam: 'Liverpool', homeAbbr: 'LIV',
    awayTeam: 'Man City', awayAbbr: 'MCI',
    homeScore: 1, awayScore: 2, status: 'ft', clock: '90\'',
    date: '24 juil. 2026 · 21:00', venue: 'Anfield',
    homeForm: ['W', 'L', 'W', 'D', 'W'], awayForm: ['W', 'W', 'W', 'W', 'D'],
  },
  {
    id: 8, league: 'Ligue 1', leagueAbbr: 'L1',
    homeTeam: 'LOSC Lille', homeAbbr: 'LIL',
    awayTeam: 'RC Lens', awayAbbr: 'RCL',
    homeScore: null, awayScore: null, status: 'pre', clock: '17:00',
    date: '27 juil. 2026 · 17:00', venue: 'Stade Pierre-Mauroy',
    homeForm: ['D', 'W', 'L', 'W', 'D'], awayForm: ['W', 'D', 'W', 'L', 'L'],
  },
];

type TabKey = 'live' | 'ft' | 'pre';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'live', label: 'En direct' },
  { key: 'ft', label: 'Terminés' },
  { key: 'pre', label: 'À venir' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function statusColor(s: MatchStatus) {
  if (s === 'live') return { bg: 'bg-warning-surface', text: 'text-warning-text', dot: 'bg-warning' };
  if (s === 'ft') return { bg: 'bg-surface-muted', text: 'text-text-muted', dot: 'bg-text-disabled' };
  return { bg: 'bg-purple-surface', text: 'text-primary', dot: 'bg-primary-muted' };
}

function statusLabel(s: MatchStatus) {
  if (s === 'live') return 'En direct';
  if (s === 'ft') return 'Terminé';
  return 'À venir';
}

function formChipClass(r: 'W' | 'D' | 'L') {
  if (r === 'W') return 'bg-success-surface text-success-text';
  if (r === 'D') return 'bg-warning-surface text-warning-text';
  return 'bg-danger-surface text-danger-text';
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

/* ----- Ticker Bar ----- */
function TickerBar() {
  const items = MATCHES;
  /* Duplicate to create seamless loop */
  const doubled = [...items, ...items];

  return (
    <div className="w-full overflow-hidden bg-surface-card border-b border-border">
      <div
        className="flex gap-0 whitespace-nowrap"
        style={{ animation: 'oria-marquee 30s linear infinite', width: 'max-content' }}
      >
        {doubled.map((m, i) => {
          const sc = statusColor(m.status);
          return (
            <div
              key={`${m.id}-${i}`}
              className={`
                inline-flex items-center gap-2 px-4 py-2.5
                border-r border-border-inner text-[13px] font-semibold
                ${sc.bg}
              `}
            >
              <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${sc.dot} ${m.status === 'live' ? 'animate-pulse' : ''}`} />
              <span className={`font-mono ${sc.text}`}>
                {m.homeAbbr}
              </span>
              <span className={`font-mono font-bold ${sc.text}`}>
                {m.homeScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'vs'}
              </span>
              <span className={`font-mono ${sc.text}`}>
                {m.awayAbbr}
              </span>
              <span className={`text-[11px] ${sc.text} opacity-75`}>
                {m.clock}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----- League filter dropdown ----- */
function LeagueFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-border text-sm font-semibold text-text hover:border-purple-hover transition-colors"
      >
        <span>{value || 'Toutes les ligues'}</span>
        <svg className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 left-0 min-w-[200px] bg-surface-card border border-border rounded-xl shadow-[0_12px_32px_-8px_rgba(38,32,74,.18)] py-1.5 animate-[oria-msg-in_0.15s_ease-out]">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-hover transition-colors ${value === '' ? 'font-bold text-primary' : 'text-text'}`}
          >
            Toutes les ligues
          </button>
          {options.map((l) => (
            <button
              key={l}
              onClick={() => { onChange(l); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-hover transition-colors ${value === l ? 'font-bold text-primary' : 'text-text'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----- Match card ----- */
function MatchCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const sc = statusColor(match.status);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-card border border-border rounded-2xl p-5 hover:border-purple-hover hover:shadow-[0_8px_24px_-8px_rgba(91,79,214,.12)] transition-all group"
    >
      {/* League & status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-purple-surface flex items-center justify-center text-[10px] font-bold text-primary font-mono">
            {match.leagueAbbr}
          </span>
          <span className="text-xs font-semibold text-text-secondary">{match.league}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${sc.bg} ${sc.text}`}>
          <span className={`w-[6px] h-[6px] rounded-full ${sc.dot} ${match.status === 'live' ? 'animate-pulse' : ''}`} />
          {statusLabel(match.status)}
        </span>
      </div>

      {/* Teams & score */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 text-right">
          <div className="w-10 h-10 rounded-full bg-surface border border-border-inner flex items-center justify-center ml-auto mb-1.5">
            <span className="text-xs font-bold font-mono text-text-secondary">{match.homeAbbr.slice(0, 2)}</span>
          </div>
          <p className="text-sm font-bold text-text-strong truncate">{match.homeTeam}</p>
        </div>

        {/* Score / Clock */}
        <div className="flex-shrink-0 text-center min-w-[64px]">
          {match.homeScore !== null ? (
            <p className={`text-2xl font-bold font-mono ${match.status === 'live' ? 'text-warning-text' : 'text-text-strong'}`}>
              {match.homeScore} - {match.awayScore}
            </p>
          ) : (
            <p className="text-lg font-bold font-mono text-primary">{match.clock}</p>
          )}
          {match.status === 'live' && (
            <p className="text-[11px] font-mono font-semibold text-warning-text mt-0.5">{match.clock}</p>
          )}
        </div>

        {/* Away */}
        <div className="flex-1">
          <div className="w-10 h-10 rounded-full bg-surface border border-border-inner flex items-center justify-center mb-1.5">
            <span className="text-xs font-bold font-mono text-text-secondary">{match.awayAbbr.slice(0, 2)}</span>
          </div>
          <p className="text-sm font-bold text-text-strong truncate">{match.awayTeam}</p>
        </div>
      </div>
    </button>
  );
}

/* ----- Match detail modal ----- */
function MatchModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const sc = statusColor(match.status);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* Lock scroll */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative w-full max-w-[520px] bg-surface-card rounded-3xl shadow-[0_32px_64px_-16px_rgba(38,32,74,.35)] overflow-hidden animate-[oria-msg-in_0.2s_ease-out]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors z-10"
          aria-label="Fermer"
        >
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header: League & Status */}
        <div className="px-6 pt-6 pb-4 border-b border-border-inner">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-surface flex items-center justify-center text-[11px] font-bold text-primary font-mono">
              {match.leagueAbbr}
            </span>
            <span className="text-sm font-semibold text-text-secondary">{match.league}</span>
            <span className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
              <span className={`w-[6px] h-[6px] rounded-full ${sc.dot} ${match.status === 'live' ? 'animate-pulse' : ''}`} />
              {statusLabel(match.status)}
            </span>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="px-6 py-8">
          <div className="flex items-center gap-4">
            {/* Home */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 rounded-full bg-surface border border-border-inner flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold font-mono text-text-secondary">{match.homeAbbr.slice(0, 3)}</span>
              </div>
              <p className="text-base font-bold text-text-strong">{match.homeTeam}</p>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 text-center">
              {match.homeScore !== null ? (
                <p className={`text-4xl font-bold font-mono ${match.status === 'live' ? 'text-warning-text' : 'text-text-strong'}`}>
                  {match.homeScore} - {match.awayScore}
                </p>
              ) : (
                <p className="text-2xl font-bold font-mono text-primary">vs</p>
              )}
              <p className={`text-sm font-mono font-semibold mt-1 ${match.status === 'live' ? 'text-warning-text' : 'text-text-muted'}`}>
                {match.clock}
              </p>
            </div>

            {/* Away */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 rounded-full bg-surface border border-border-inner flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold font-mono text-text-secondary">{match.awayAbbr.slice(0, 3)}</span>
              </div>
              <p className="text-base font-bold text-text-strong">{match.awayTeam}</p>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="mx-6 px-4 py-3 bg-surface rounded-xl text-center text-xs text-text-muted font-medium">
          {match.date} &middot; {match.venue}
        </div>

        {/* Form results */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[11px] font-bold tracking-[1px] uppercase text-text-disabled mb-3">Forme récente</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">{match.homeAbbr}</p>
              <div className="flex gap-1.5">
                {match.homeForm.map((r, i) => (
                  <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${formChipClass(r)}`}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">{match.awayAbbr}</p>
              <div className="flex gap-1.5">
                {match.awayForm.map((r, i) => (
                  <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${formChipClass(r)}`}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pt-4 pb-6">
          <Link
            to="/app"
            className="block w-full text-center px-6 py-3.5 text-[15px] font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-[0_8px_20px_-6px_rgba(91,79,214,.5)] transition-colors"
          >
            Demander à Oria
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing component                                            */
/* ------------------------------------------------------------------ */

export function Landing() {
  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  /* Derived */
  const filteredMatches = MATCHES.filter((m) => {
    if (m.status !== activeTab) return false;
    if (leagueFilter && m.league !== leagueFilter) return false;
    return true;
  });

  const counts: Record<TabKey, number> = {
    live: MATCHES.filter((m) => m.status === 'live' && (!leagueFilter || m.league === leagueFilter)).length,
    ft: MATCHES.filter((m) => m.status === 'ft' && (!leagueFilter || m.league === leagueFilter)).length,
    pre: MATCHES.filter((m) => m.status === 'pre' && (!leagueFilter || m.league === leagueFilter)).length,
  };

  /* Unique leagues present in data */
  const availableLeagues = [...new Set(MATCHES.map((m) => m.league))];

  return (
    <div className="min-h-screen bg-surface">
      {/* Ticker Bar */}
      <TickerBar />

      {/* Hero */}
      <section className="max-w-[1120px] mx-auto px-6 pt-[72px] pb-10 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-surface border border-purple-border text-[12.5px] font-semibold text-primary-hover">
            <span className="w-[7px] h-[7px] rounded-full bg-success" />
            Données à jour · Football
          </span>
          <h1 className="font-serif font-normal text-[clamp(36px,5vw,60px)] leading-[1.02] tracking-tight mt-5">
            L'oracle du sport,<br />en langage naturel.
          </h1>
          <p className="text-lg leading-relaxed text-text-secondary max-w-[480px] mt-5">
            Pose n'importe quelle question sur le foot — résultats, forme, compos,
            cotes, tendances. Oria répond à partir de données fraîches, et te laisse
            cadrer la question au niveau ligue, match, équipe ou joueur.
          </p>
          <div className="flex gap-3 mt-7 flex-col sm:flex-row">
            <Link
              to="/register"
              className="px-[26px] py-3.5 text-[15px] font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-[0_8px_20px_-6px_rgba(91,79,214,.5)] transition-colors text-center"
            >
              Commencer gratuitement
            </Link>
            <Link
              to="/app"
              className="px-[26px] py-3.5 text-[15px] font-semibold text-text-strong bg-white border border-border-light hover:border-purple-hover rounded-xl transition-colors text-center"
            >
              Voir une démo
            </Link>
          </div>
          <p className="text-[13px] text-text-disabled mt-4">
            Sans carte bancaire · 20 questions / jour offertes
          </p>
        </div>

        {/* Mock chat preview */}
        <div className="bg-white border border-[#EDEBF6] rounded-[22px] shadow-[0_30px_60px_-24px_rgba(38,32,74,.28)] p-[18px]">
          <div className="flex items-center gap-2.5 px-1 pb-3.5 border-b border-border-inner">
            <OriaLogo size={24} centerFill="#fff" />
            <span className="font-serif text-xl">Oria</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
              <span className="w-[7px] h-[7px] rounded-full bg-success" />
              à jour il y a 2 h
            </span>
          </div>
          <div className="flex justify-end gap-1.5 px-0.5 pt-4 pb-2">
            <span className="px-[11px] py-[5px] rounded-full bg-purple-surface border border-purple-border text-xs font-semibold text-primary-hover">
              Ligue 1
            </span>
            <span className="px-[11px] py-[5px] rounded-full bg-purple-surface border border-purple-border text-xs font-semibold text-primary-hover">
              Paris SG
            </span>
          </div>
          <div className="flex justify-end">
            <div className="bg-primary text-white rounded-[16px_4px_16px_16px] px-[15px] py-[11px] text-sm">
              Son prochain match ?
            </div>
          </div>
          <div className="bg-surface-light border border-[#EEEDF6] rounded-[14px] p-3.5 mt-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-right font-bold text-sm">Paris SG</div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                reçoit
              </span>
              <div className="flex-1 font-bold text-sm">Le Havre</div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[#EEEDF6] text-xs text-text-muted text-center">
              <span className="text-primary font-semibold">Ligue 1</span> · sam. 17 août 21:00 · Parc des Princes
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SCOREBOARD SECTION                                          */}
      {/* ============================================================ */}
      <section className="max-w-[1120px] mx-auto px-6 pt-4 pb-12">
        {/* Section heading */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif font-normal text-[clamp(26px,3.5vw,36px)] leading-tight tracking-tight">
              Scores en direct
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Suivez tous les matchs en temps réel
            </p>
          </div>
          <LeagueFilter value={leagueFilter} onChange={setLeagueFilter} options={availableLeagues} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-surface-card border border-border rounded-xl mb-6 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = counts[tab.key];
            const tabSc = statusColor(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-primary text-white shadow-[0_2px_8px_-2px_rgba(91,79,214,.4)]'
                    : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                  }
                `}
              >
                {!isActive && (
                  <span className={`w-[6px] h-[6px] rounded-full ${tabSc.dot}`} />
                )}
                {tab.label}
                <span className={`
                  text-[11px] font-bold px-1.5 py-0.5 rounded-md
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-surface text-text-muted'
                  }
                `}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Match grid */}
        {filteredMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((m) => (
              <MatchCard key={m.id} match={m} onClick={() => setSelectedMatch(m)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-surface-card border border-border rounded-2xl">
            <p className="text-text-muted text-sm">Aucun match trouvé pour ce filtre.</p>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-[1120px] mx-auto px-6 py-9">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-purple-surface flex items-center justify-center font-serif text-[22px] text-primary">
              +
            </div>
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
            <div className="w-10 h-10 rounded-[11px] bg-warning-surface flex items-center justify-center font-mono font-semibold text-warning-text">
              1.9
            </div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Cotes & tendances</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Compos probables, forme récente, cotes et statistiques, réservées au palier Premium.
            </p>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="max-w-[1120px] mx-auto px-6 pt-6 pb-2 text-center">
        <p className="text-[12.5px] font-bold tracking-[1.2px] uppercase text-text-disabled mb-[18px]">
          Couverture
        </p>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {leagues.map((name) => (
            <span
              key={name}
              className="px-4 py-[9px] rounded-full bg-white border border-border text-[13.5px] font-semibold text-text-dark"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-[13px] text-text-disabled mt-4">
          ...et bientôt d'autres sports. L'identité d'Oria reste neutre.
        </p>
      </section>

      {/* CTA gradient */}
      <section className="max-w-[1120px] mx-auto px-6 pt-12 pb-20">
        <div className="bg-gradient-to-br from-primary to-primary-light rounded-3xl px-10 py-[52px] text-center text-white">
          <h2 className="font-serif font-normal text-[38px]">
            Prêt à interroger l'oracle ?
          </h2>
          <p className="text-base opacity-85 mt-3 mb-[26px]">
            Commence gratuitement. Passe en Premium quand tu veux le direct et les analyses.
          </p>
          <div className="flex gap-3 justify-center flex-col sm:flex-row">
            <Link
              to="/register"
              className="px-7 py-3.5 text-[15px] font-bold text-primary-hover bg-white hover:bg-surface rounded-xl transition-colors text-center"
            >
              Créer mon compte
            </Link>
            <Link
              to="/#tarifs"
              className="px-7 py-3.5 text-[15px] font-semibold text-white border border-white/40 hover:border-white/70 rounded-xl transition-colors text-center"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-text-faint">
          &copy; {new Date().getFullYear()} Oria &mdash; Assistant football intelligent
        </p>
      </footer>

      {/* Match detail modal */}
      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}
