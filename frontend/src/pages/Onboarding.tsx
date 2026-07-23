import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTeams } from '../api/catalog';
import type { Team } from '../api/catalog';
import { follow } from '../api/follows';

const STEPS = ['Bienvenue', 'Vos \u00e9quipes', 'C\'est parti'] as const;

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Team[]>([]);
  const [selected, setSelected] = useState<Team[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const teams = await listTeams();
      // Simple client-side filter since catalog may not have search param
      const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  const toggleTeam = (team: Team) => {
    setSelected(prev =>
      prev.some(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
        : [...prev, team]
    );
  };

  const finishOnboarding = async () => {
    // Follow all selected teams
    for (const team of selected) {
      try {
        await follow('team', team.id, team.name);
      } catch {
        // ignore duplicates
      }
    }
    navigate('/app');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-6">
      <div className="w-full max-w-[480px]">
        {/* Progress */}
        <div className="flex items-center gap-2 justify-center mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i <= step ? 'w-8 bg-primary' : 'w-4 bg-border'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-surface flex items-center justify-center mx-auto mb-5">
              <span className="font-serif text-2xl text-primary">O</span>
            </div>
            <h1 className="text-2xl font-bold text-text-strong mb-2">Bienvenue sur Oria</h1>
            <p className="text-sm text-text-muted max-w-[360px] mx-auto mb-8">
              Configurons votre exp\u00e9rience pour vous offrir les meilleures recommandations football.
            </p>
            <button
              onClick={() => setStep(1)}
              className="h-11 px-8 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors"
            >
              Commencer
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-text-strong mb-1 text-center">Vos \u00e9quipes favorites</h2>
            <p className="text-sm text-text-muted text-center mb-6">
              Recherchez et s\u00e9lectionnez les \u00e9quipes que vous souhaitez suivre.
            </p>

            {/* Search */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="Rechercher une \u00e9quipe..."
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
              />
              <button
                onClick={doSearch}
                disabled={searching}
                className="h-11 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {searching ? '...' : 'Chercher'}
              </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="bg-surface-card border border-border rounded-xl divide-y divide-border-inner max-h-[240px] overflow-y-auto mb-4">
                {results.map(team => {
                  const isSelected = selected.some(t => t.id === team.id);
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleTeam(team)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors ${
                        isSelected ? 'bg-purple-surface' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center shrink-0">
                        <span className="text-sm">{'\u26BD'}</span>
                      </div>
                      <span className="text-sm font-semibold text-text-strong flex-1">{team.name}</span>
                      {isSelected && <span className="text-primary text-sm">{'\u2713'}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selected.map(team => (
                  <span
                    key={team.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-surface text-primary text-xs font-semibold"
                  >
                    {team.name}
                    <button onClick={() => toggleTeam(team)} className="text-primary-muted hover:text-primary">{'\u00d7'}</button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(0)}
                className="h-11 px-6 text-sm font-semibold text-text-secondary hover:text-text-dark transition-colors"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(2)}
                className="h-11 px-8 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-success-surface flex items-center justify-center mx-auto mb-5">
              <span className="text-2xl">{'\u2705'}</span>
            </div>
            <h2 className="text-xl font-bold text-text-strong mb-2">C'est parti !</h2>
            <p className="text-sm text-text-muted max-w-[360px] mx-auto mb-2">
              {selected.length > 0
                ? `Vous suivez ${selected.length} \u00e9quipe${selected.length > 1 ? 's' : ''}. Oria vous enverra des mises \u00e0 jour personnalis\u00e9es.`
                : 'Vous pouvez toujours ajouter des suivis plus tard depuis le chat.'}
            </p>
            <button
              onClick={finishOnboarding}
              className="h-11 px-8 mt-6 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors"
            >
              Aller au chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
