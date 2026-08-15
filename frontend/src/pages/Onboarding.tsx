import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLeagues, listTeams, listPlayers } from '../api/catalog';
import type { League, Team, Player } from '../api/catalog';
import { follow } from '../api/follows';
import OriaLogo from '../components/OriaLogo';

interface SelectableLeague extends League {
  selected: boolean;
}

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

export function Onboarding() {
  const navigate = useNavigate();
  const [teamSearch, setTeamSearch] = useState('');
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [searchingTeams, setSearchingTeams] = useState(false);

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);

  const [leagues, setLeagues] = useState<SelectableLeague[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris');

  /* Load leagues from API on mount */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listLeagues();
        if (cancelled) return;
        const majorLeagues = data
          .filter(l => l.type === 'League' || !l.type)
          .slice(0, 10)
          .map((l, i) => ({ ...l, selected: i < 2 }));
        setLeagues(majorLeagues);
      } catch {
        // Fallback to empty
      } finally {
        if (!cancelled) setLoadingLeagues(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const doTeamSearch = useCallback(async () => {
    if (!teamSearch.trim()) return;
    setSearchingTeams(true);
    try {
      const teams = await listTeams();
      const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(teamSearch.toLowerCase())
      );
      setTeamResults(filtered);
    } catch {
      setTeamResults([]);
    } finally {
      setSearchingTeams(false);
    }
  }, [teamSearch]);

  const doPlayerSearch = useCallback(async () => {
    if (!playerSearch.trim()) return;
    setSearchingPlayers(true);
    try {
      const players = await listPlayers();
      const filtered = players.filter(p =>
        p.name.toLowerCase().includes(playerSearch.toLowerCase())
      );
      setPlayerResults(filtered);
    } catch {
      setPlayerResults([]);
    } finally {
      setSearchingPlayers(false);
    }
  }, [playerSearch]);

  const toggleTeam = (team: Team) => {
    setSelectedTeams(prev =>
      prev.some(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
        : [...prev, team]
    );
  };

  const togglePlayer = (player: Player) => {
    setSelectedPlayers(prev =>
      prev.some(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : [...prev, player]
    );
  };

  const toggleLeague = (id: number) => {
    setLeagues(prev => prev.map(l => l.id === id ? { ...l, selected: !l.selected } : l));
  };

  const finishOnboarding = async () => {
    // Follow selected leagues
    for (const league of leagues.filter(l => l.selected)) {
      try {
        await follow('league', league.id, league.name, league.logo);
      } catch {
        // ignore duplicates
      }
    }
    // Follow selected teams
    for (const team of selectedTeams) {
      try {
        await follow('team', team.id, team.name, team.logo);
      } catch {
        // ignore duplicates
      }
    }
    // Follow selected players
    for (const player of selectedPlayers) {
      try {
        await follow('player', player.id, player.name, player.photo);
      } catch {
        // ignore duplicates
      }
    }
    navigate('/app');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-6 py-10">
      <div className="w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-surface flex items-center justify-center mb-5">
            <OriaLogo size={30} />
          </div>
          <h1 className="font-serif font-normal text-[clamp(26px,5vw,34px)] text-center">
            Choisis ce que tu suis
          </h1>
          <p className="text-[15px] text-text-secondary text-center mt-1 max-w-[400px]">
            Sélectionne ce que tu veux suivre. Tu pourras modifier ça plus tard.
          </p>
        </div>

        {/* Leagues */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="bg-white border border-border rounded-2xl p-[22px]">
            <h2 className="text-[16px] font-semibold mb-3.5">Ligues</h2>
            {loadingLeagues ? (
              <p className="text-sm text-text-muted">Chargement des ligues…</p>
            ) : leagues.length === 0 ? (
              <p className="text-sm text-text-muted">Aucune ligue disponible</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {leagues.map(league => (
                  <button
                    key={league.id}
                    onClick={() => toggleLeague(league.id)}
                    className="inline-flex items-center gap-2 px-3.5 py-[9px] rounded-[11px] border text-[13.5px] font-semibold transition-colors"
                    style={{
                      background: league.selected ? '#EEEDFA' : '#fff',
                      borderColor: league.selected ? '#C9C3EC' : '#E9E7F2',
                      color: league.selected ? '#4A3FC0' : '#605C74',
                    }}
                  >
                    <span className="w-5 h-5 rounded-md border flex items-center justify-center text-[11px]"
                      style={{
                        borderColor: league.selected ? '#C9C3EC' : '#E9E7F2',
                        background: league.selected ? '#5B4FD6' : 'transparent',
                        color: league.selected ? '#fff' : 'transparent',
                      }}
                    >
                      {league.selected ? '✓' : ''}
                    </span>
                    {league.logo && (
                      <img src={league.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                    )}
                    {league.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team search */}
        <div className="bg-white border border-border rounded-2xl p-[22px] mb-4">
          <h2 className="text-[16px] font-semibold mb-3">Rechercher une équipe</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doTeamSearch()}
              placeholder="Rechercher une équipe…"
              className="flex-1 px-[13px] py-[11px] rounded-[11px] border border-border-light bg-surface-alt text-sm placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
            <button
              onClick={doTeamSearch}
              disabled={searchingTeams}
              className="px-4 py-[11px] bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-[11px] transition-colors disabled:opacity-50"
            >
              {searchingTeams ? '…' : 'Chercher'}
            </button>
          </div>

          {teamResults.length > 0 && (
            <div className="border border-border rounded-[11px] divide-y divide-border-inner max-h-[200px] overflow-y-auto mb-3">
              {teamResults.map(team => {
                const isSelected = selectedTeams.some(t => t.id === team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover transition-colors ${
                      isSelected ? 'bg-purple-surface' : ''
                    }`}
                  >
                    {team.logo && (
                      <img src={team.logo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span className="text-sm font-semibold text-text-strong flex-1">{team.name}</span>
                    <span className="text-primary text-sm font-bold">{isSelected ? '✓' : '＋'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedTeams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTeams.map(team => (
                <span
                  key={team.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-surface border border-purple-border text-[13px] font-semibold text-primary-hover"
                >
                  {team.logo && (
                    <img src={team.logo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  )}
                  {team.name}
                  <button
                    onClick={() => toggleTeam(team)}
                    className="text-primary-soft hover:text-primary w-[18px] h-[18px] rounded-full text-xs hover:bg-purple-border transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Player search */}
        <div className="bg-white border border-border rounded-2xl p-[22px] mb-4">
          <h2 className="text-[16px] font-semibold mb-3">Rechercher un joueur</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doPlayerSearch()}
              placeholder="Rechercher un joueur…"
              className="flex-1 px-[13px] py-[11px] rounded-[11px] border border-border-light bg-surface-alt text-sm placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
            <button
              onClick={doPlayerSearch}
              disabled={searchingPlayers}
              className="px-4 py-[11px] bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-[11px] transition-colors disabled:opacity-50"
            >
              {searchingPlayers ? '…' : 'Chercher'}
            </button>
          </div>

          {playerResults.length > 0 && (
            <div className="border border-border rounded-[11px] divide-y divide-border-inner max-h-[200px] overflow-y-auto mb-3">
              {playerResults.map(player => {
                const isSelected = selectedPlayers.some(p => p.id === player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover transition-colors ${
                      isSelected ? 'bg-purple-surface' : ''
                    }`}
                  >
                    {player.photo && (
                      <img src={player.photo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }} />
                    )}
                    <span className="text-sm font-semibold text-text-strong flex-1">{player.name}</span>
                    <span className="text-primary text-sm font-bold">{isSelected ? '✓' : '＋'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map(player => (
                <span
                  key={player.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-surface border border-purple-border text-[13px] font-semibold text-primary-hover"
                >
                  {player.photo && (
                    <img src={player.photo} alt="" style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: '50%' }} />
                  )}
                  {player.name}
                  <button
                    onClick={() => togglePlayer(player)}
                    className="text-primary-soft hover:text-primary w-[18px] h-[18px] rounded-full text-xs hover:bg-purple-border transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timezone */}
        <div className="bg-white border border-border rounded-2xl p-[22px] mb-6">
          <h2 className="text-[16px] font-semibold mb-3">Fuseau horaire</h2>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-[13px] py-[11px] rounded-[11px] border border-border-light bg-surface-alt text-sm text-text focus:outline-none focus:border-primary-soft transition-colors cursor-pointer"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
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
            Terminer et ouvrir Oria
          </button>
        </div>
      </div>
    </div>
  );
}
