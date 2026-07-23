import { api } from './client';

export interface League {
  id: number;
  name: string;
  country: string;
  logo?: string;
  [key: string]: unknown;
}

export interface Team {
  id: number;
  name: string;
  logo?: string;
  [key: string]: unknown;
}

export interface Player {
  id: number;
  name: string;
  photo?: string;
  [key: string]: unknown;
}

export interface Fixture {
  id: number;
  date: string;
  home_team: string;
  away_team: string;
  home_logo?: string;
  away_logo?: string;
  score_home?: number | null;
  score_away?: number | null;
  status?: string;
  league_name?: string;
  [key: string]: unknown;
}

export async function listLeagues(country?: string): Promise<League[]> {
  const params = country ? `?country=${country}` : '';
  return api.get<League[]>(`/catalog/leagues${params}`);
}

export async function listTeams(leagueId?: number, season?: number): Promise<Team[]> {
  const parts: string[] = [];
  if (leagueId) parts.push(`league_id=${leagueId}`);
  if (season) parts.push(`season=${season}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return api.get<Team[]>(`/catalog/teams${qs}`);
}

export async function listPlayers(teamId?: number, season?: number): Promise<Player[]> {
  const parts: string[] = [];
  if (teamId) parts.push(`team_id=${teamId}`);
  if (season) parts.push(`season=${season}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return api.get<Player[]>(`/catalog/players${qs}`);
}

export async function listFixtures(leagueId?: number, teamId?: number, nextCount?: number): Promise<Fixture[]> {
  const parts: string[] = [];
  if (leagueId) parts.push(`league_id=${leagueId}`);
  if (teamId) parts.push(`team_id=${teamId}`);
  if (nextCount) parts.push(`next_count=${nextCount}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return api.get<Fixture[]>(`/catalog/fixtures${qs}`);
}
