import { useState, useEffect, useRef } from 'react';
import type { ChatContext } from '../../api/chat';
import { listLeagues, listTeams } from '../../api/catalog';
import type { League, Team } from '../../api/catalog';

interface Props {
  context: ChatContext;
  onChange: (ctx: ChatContext) => void;
}

/* ------------------------------------------------------------------ */
/*  Generic dropdown                                                   */
/* ------------------------------------------------------------------ */

interface DropdownItem {
  id: number;
  name: string;
  logo?: string;
  extra?: string;
}

function Dropdown({
  label,
  placeholder,
  items,
  value,
  onSelect,
  onClear,
  loading,
}: {
  label: string;
  placeholder: string;
  items: DropdownItem[];
  value: DropdownItem | null;
  onSelect: (item: DropdownItem) => void;
  onClear: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-[7px] rounded-xl border text-[12.5px] font-semibold transition-colors"
        style={{
          borderColor: value ? '#C9C3EC' : '#E1DEF0',
          background: value ? '#EEEDFA' : '#fff',
          color: value ? '#4A3FC0' : '#605C74',
        }}
      >
        {value?.logo && (
          <img src={value.logo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
        )}
        <span>{value ? value.name : label}</span>
        {value ? (
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-primary-muted hover:text-primary cursor-pointer ml-0.5"
          >
            ×
          </span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-30 min-w-[240px] max-h-[260px] bg-white border border-border rounded-xl shadow-lg overflow-hidden"
          style={{ boxShadow: '0 14px 36px -10px rgba(38,32,74,.24)' }}
        >
          {items.length > 6 && (
            <div className="px-2.5 pt-2.5 pb-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-alt text-xs placeholder:text-text-faint focus:outline-none focus:border-primary-soft"
              />
            </div>
          )}
          <div className="overflow-y-auto max-h-[200px] p-1.5">
            {loading ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">Aucun résultat</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item); setOpen(false); setSearch(''); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[12.5px] font-semibold hover:bg-surface-hover transition-colors"
                  style={{ color: value?.id === item.id ? '#4A3FC0' : '#3F3B54' }}
                >
                  {item.logo && (
                    <img src={item.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.extra && <span className="text-[11px] text-text-muted">{item.extra}</span>}
                  {value?.id === item.id && <span className="text-primary font-bold">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ContextSelector                                                    */
/* ------------------------------------------------------------------ */

export function ContextSelector({ context, onChange }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Load leagues on mount
  useEffect(() => {
    let cancelled = false;
    listLeagues()
      .then((data) => { if (!cancelled) setLeagues(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingLeagues(false); });
    return () => { cancelled = true; };
  }, []);

  // Load teams when league changes
  useEffect(() => {
    if (!context.league_id) {
      setTeams([]);
      return;
    }
    let cancelled = false;
    setLoadingTeams(true);
    listTeams(context.league_id)
      .then((data) => { if (!cancelled) setTeams(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTeams(false); });
    return () => { cancelled = true; };
  }, [context.league_id]);

  const selectedLeague = leagues.find((l) => l.id === context.league_id) ?? null;
  const selectedTeam = teams.find((t) => t.id === context.team_id) ?? null;

  const leagueItems: DropdownItem[] = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    logo: l.logo,
    extra: l.country,
  }));

  const teamItems: DropdownItem[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo,
  }));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Contexte</span>

      <Dropdown
        label="Ligue"
        placeholder="Rechercher une ligue..."
        items={leagueItems}
        value={selectedLeague ? { id: selectedLeague.id, name: selectedLeague.name, logo: selectedLeague.logo } : null}
        onSelect={(item) => onChange({ ...context, league_id: item.id, team_id: undefined })}
        onClear={() => onChange({ ...context, league_id: undefined, team_id: undefined })}
        loading={loadingLeagues}
      />

      {context.league_id && (
        <Dropdown
          label="Équipe"
          placeholder="Rechercher une équipe..."
          items={teamItems}
          value={selectedTeam ? { id: selectedTeam.id, name: selectedTeam.name, logo: selectedTeam.logo } : null}
          onSelect={(item) => onChange({ ...context, team_id: item.id })}
          onClear={() => onChange({ ...context, team_id: undefined })}
          loading={loadingTeams}
        />
      )}
    </div>
  );
}
