import { api } from './client';

export interface League {
  id: number;
  name: string;
  type?: string;
  logo?: string;
  country: string;
  country_code?: string;
  country_flag?: string;
  [key: string]: unknown;
}

export interface Team {
  id: number;
  name: string;
  logo?: string;
  country?: string;
  [key: string]: unknown;
}

export interface Player {
  id: number;
  name: string;
  photo?: string;
  number?: number;
  position?: string;
  age?: number;
  [key: string]: unknown;
}

export interface Fixture {
  id: number;
  date: string;
  timestamp?: number;
  home_team: string;
  home_id?: number;
  away_team: string;
  away_id?: number;
  home_logo?: string;
  away_logo?: string;
  score_home?: number | null;
  score_away?: number | null;
  status?: string;
  status_long?: string;
  elapsed?: number | null;
  league_id?: number;
  league_name?: string;
  league_logo?: string;
  league_country?: string;
  league_flag?: string;
  round?: string;
  venue?: { id?: number; name?: string; city?: string };
  referee?: string;
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

export async function listLiveFixtures(): Promise<Fixture[]> {
  return api.get<Fixture[]>('/catalog/fixtures/live');
}

export async function listFixtures(opts?: {
  leagueId?: number;
  teamId?: number;
  season?: number;
  nextCount?: number;
  lastCount?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  fixtureId?: number;
  round?: string;
}): Promise<Fixture[]> {
  const parts: string[] = [];
  if (opts?.fixtureId) {
    parts.push(`fixture_id=${opts.fixtureId}`);
  } else {
    if (opts?.leagueId) parts.push(`league_id=${opts.leagueId}`);
    if (opts?.teamId) parts.push(`team_id=${opts.teamId}`);
    if (opts?.season) parts.push(`season=${opts.season}`);
    if (opts?.nextCount) parts.push(`next_count=${opts.nextCount}`);
    if (opts?.lastCount) parts.push(`last_count=${opts.lastCount}`);
    if (opts?.date) parts.push(`date=${opts.date}`);
    if (opts?.dateFrom) parts.push(`date_from=${opts.dateFrom}`);
    if (opts?.dateTo) parts.push(`date_to=${opts.dateTo}`);
    if (opts?.round) parts.push(`round=${encodeURIComponent(opts.round)}`);
  }
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return api.get<Fixture[]>(`/catalog/fixtures${qs}`);
}

export async function getSquad(teamId: number): Promise<Player[]> {
  return api.get<Player[]>(`/catalog/squad?team_id=${teamId}`);
}
