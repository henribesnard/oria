import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTeams } from '../api/catalog';
import type { Team } from '../api/catalog';
import { follow } from '../api/follows';
import OriaLogo from '../components/OriaLogo';

interface OnbItem {
  name: string;
  selected: boolean;
}

const defaultLeagues: OnbItem[] = [
  { name: 'Ligue 1', selected: true },
  { name: 'Premier League', selected: true },
  { name: 'LaLiga', selected: false },
  { name: 'Serie A', selected: false },
  { name: 'Bundesliga', selected: false },
];
const defaultTeamNames: OnbItem[] = [
  { name: 'Paris SG', selected: true },
  { name: 'Real Madrid', selected: false },
  { name: 'Marseille', selected: false },
  { name: 'Arsenal', selected: false },
];
const defaultPlayers: OnbItem[] = [
  { name: 'Dembélé', selected: true },
  { name: 'Mbappé', selected: false },
  { name: 'Haaland', selected: false },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [apiResults, setApiResults] = useState<Team[]>([]);
  const [apiSelected, setApiSelected] = useState<Team[]>([]);
  const [searching, setSearching] = useState(false);

  const [leagues, setLeagues] = useState(defaultLeagues);
  const [teamNames, setTeamNames] = useState(defaultTeamNames);
  const [players, setPlayers] = useState(defaultPlayers);

  const doSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const teams = await listTeams();
      const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
      setApiResults(filtered);
    } catch {
      setApiResults([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  const toggleApiTeam = (team: Team) => {
    setApiSelected(prev =>
      prev.some(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
        : [...prev, team]
    );
  };

  const toggleItem = (
    list: OnbItem[],
    setter: React.Dispatch<React.SetStateAction<OnbItem[]>>,
    name: string
  ) => {
    setter(list.map(item => item.name === name ? { ...item, selected: !item.selected } : item));
  };

  const finishOnboarding = async () => {
    for (const team of apiSelected) {
      try {
        await follow('team', team.id, team.name);
      } catch {
        // ignore duplicates
      }
    }
    navigate('/app');
  };

  const groups = [
    { title: 'Ligues', items: leagues, setter: setLeagues },
    { title: 'Équipes', items: teamNames, setter: setTeamNames },
    { title: 'Joueurs', items: players, setter: setPlayers },
  ] as const;

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-6 py-10">
      <div className="w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-surface flex items-center justify-center mb-5">
            <OriaLogo size={30} />
          </div>
          <h1 className="font-serif font-normal text-[clamp(26px,5vw,34px)] text-center">
            Bienvenue sur Oria
          </h1>
          <p className="text-[15px] text-text-secondary text-center mt-1 max-w-[400px]">
            Sélectionne ce que tu veux suivre. Tu pourras modifier ça plus tard.
          </p>
        </div>

        {/* Follow groups */}
        <div className="flex flex-col gap-4 mb-8">
          {groups.map(({ title, items, setter }) => (
            <div key={title} className="bg-white border border-border rounded-2xl p-[22px]">
              <h2 className="text-[16px] font-semibold mb-3.5">{title}</h2>
              <div className="flex flex-wrap gap-2">
                {items.map(item => (
                  <button
                    key={item.name}
                    onClick={() => toggleItem(items as OnbItem[], setter as React.Dispatch<React.SetStateAction<OnbItem[]>>, item.name)}
                    className="inline-flex items-center gap-2 px-3.5 py-[9px] rounded-[11px] border text-[13.5px] font-semibold transition-colors"
                    style={{
                      background: item.selected ? '#EEEDFA' : '#fff',
                      borderColor: item.selected ? '#C9C3EC' : '#E9E7F2',
                      color: item.selected ? '#4A3FC0' : '#605C74',
                    }}
                  >
                    <span className="w-5 h-5 rounded-md border flex items-center justify-center text-[11px]"
                      style={{
                        borderColor: item.selected ? '#C9C3EC' : '#E9E7F2',
                        background: item.selected ? '#5B4FD6' : 'transparent',
                        color: item.selected ? '#fff' : 'transparent',
                      }}
                    >
                      {item.selected ? '✓' : ''}
                    </span>
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* API search */}
        <div className="bg-white border border-border rounded-2xl p-[22px] mb-6">
          <h2 className="text-[16px] font-semibold mb-3">Rechercher une équipe</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="Rechercher une équipe..."
              className="flex-1 px-[13px] py-[11px] rounded-[11px] border border-border-light bg-surface-alt text-sm placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
            <button
              onClick={doSearch}
              disabled={searching}
              className="px-4 py-[11px] bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-[11px] transition-colors disabled:opacity-50"
            >
              {searching ? '...' : 'Chercher'}
            </button>
          </div>

          {apiResults.length > 0 && (
            <div className="border border-border rounded-[11px] divide-y divide-border-inner max-h-[200px] overflow-y-auto mb-3">
              {apiResults.map(team => {
                const isSelected = apiSelected.some(t => t.id === team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleApiTeam(team)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover transition-colors ${
                      isSelected ? 'bg-purple-surface' : ''
                    }`}
                  >
                    <span className="text-sm font-semibold text-text-strong flex-1">{team.name}</span>
                    <span className="text-primary text-sm font-bold">{isSelected ? '✓' : '＋'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {apiSelected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {apiSelected.map(team => (
                <span
                  key={team.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-surface border border-purple-border text-[13px] font-semibold text-primary-hover"
                >
                  {team.name}
                  <button
                    onClick={() => toggleApiTeam(team)}
                    className="text-primary-soft hover:text-primary w-[18px] h-[18px] rounded-full text-xs hover:bg-purple-border transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/app')}
            className="text-sm font-semibold text-text-muted hover:text-text-dark transition-colors"
          >
            Passer cette étape
          </button>
          <button
            onClick={finishOnboarding}
            className="px-7 py-3 bg-primary hover:bg-primary-hover text-white text-[15px] font-bold rounded-[11px] transition-colors"
          >
            C'est parti →
          </button>
        </div>
      </div>
    </div>
  );
}
