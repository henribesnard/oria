import { useState, useEffect } from 'react';
import { listTeams, listFixtures, getSquad, type Team, type Fixture, type Player } from '../api/catalog';
import { currentSeason, snapWindow } from '../lib/contextRules';

interface TeamData {
  team: Team | null;
  recentFixtures: Fixture[];
  nextFixture: Fixture | null;
  squad: Player[];
}

export function useTeam(teamId: number) {
  const [data, setData] = useState<TeamData>({
    team: null,
    recentFixtures: [],
    nextFixture: null,
    squad: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const season = currentSeason();
        const { from, to } = snapWindow(undefined, 30, 10);

        const [teamsData, fixturesData, squadData] = await Promise.all([
          listTeams(undefined, season).catch(() => []),
          listFixtures({ teamId, season, dateFrom: from, dateTo: to }).catch(() => []),
          getSquad(teamId).catch(() => []),
        ]);

        if (cancelled) return;

        const team = teamsData.find(t => t.id === teamId) ?? null;
        const now = Date.now();
        const past = fixturesData
          .filter(f => new Date(f.date).getTime() < now)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const future = fixturesData
          .filter(f => new Date(f.date).getTime() >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setData({
          team,
          recentFixtures: past.slice(0, 5),
          nextFixture: future[0] ?? null,
          squad: squadData,
        });
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  return { ...data, loading };
}
