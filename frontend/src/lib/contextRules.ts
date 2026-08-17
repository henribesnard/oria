/**
 * contextRules.ts — Logique pure d'invalidation et de navigation du contexte.
 *
 * Partageable entre web et mobile (copie identique).
 * Aucun import React ni DOM : que de la logique.
 */

import type { ChatContext } from '../api/chat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextLabels {
  league?: { id: number; name: string; logo?: string; country?: string };
  fixture?: {
    id: number;
    home: string;
    away: string;
    homeId?: number;
    awayId?: number;
    homeLogo?: string;
    awayLogo?: string;
    date?: string;
    status?: string;
    round?: string;
  };
  team?: { id: number; name: string; logo?: string };
  player?: { id: number; name: string; photo?: string; number?: number };
}

export interface ContextState {
  context: ChatContext;
  labels: ContextLabels;
}

export type Level = 'none' | 'league' | 'fixture' | 'team' | 'player';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const EMPTY_CONTEXT_STATE: ContextState = {
  context: {},
  labels: {},
};

export const LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
export const FINISHED = ['FT', 'AET', 'PEN'];
export const UPCOMING = ['NS', 'TBD'];
export const OTHER = ['PST', 'CANC', 'ABD', 'AWD', 'WO'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Saison courante : annee en cours si mois >= 7 (juillet), sinon annee - 1.
 * Doit correspondre exactement a `_current_season()` du backend.
 */
export function currentSeason(now?: Date): number {
  const d = now ?? new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

/**
 * Fenetre canonique de matchs, bornes calees au jour (YYYY-MM-DD).
 */
export function snapWindow(
  now?: Date,
  daysBack = 10,
  daysAhead = 10,
): { from: string; to: string } {
  const d = now ?? new Date();
  const from = new Date(d);
  from.setDate(from.getDate() - daysBack);
  const to = new Date(d);
  to.setDate(to.getDate() + daysAhead);
  return { from: fmtDate(from), to: fmtDate(to) };
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Niveau le plus specifique
// ---------------------------------------------------------------------------

export function deepestLevel(s: ContextState): Level {
  if (s.context.player_id) return 'player';
  if (s.context.team_id) return 'team';
  if (s.context.fixture_id) return 'fixture';
  if (s.context.league_id) return 'league';
  return 'none';
}

// ---------------------------------------------------------------------------
// Selecteurs — retournent un nouvel etat (immuable)
// ---------------------------------------------------------------------------

interface LeagueInput {
  id: number;
  name: string;
  logo?: string;
  country?: string;
}

export function selectLeague(s: ContextState, league: LeagueInput): ContextState {
  return {
    context: {
      league_id: league.id,
      season: currentSeason(),
    },
    labels: {
      league: { id: league.id, name: league.name, logo: league.logo, country: league.country },
    },
  };
}

interface FixtureInput {
  id: number;
  home: string;
  away: string;
  homeId?: number;
  awayId?: number;
  homeLogo?: string;
  awayLogo?: string;
  date?: string;
  status?: string;
  round?: string;
}

export function selectFixture(s: ContextState, fixture: FixtureInput): ContextState {
  const ctx = { ...s.context, fixture_id: fixture.id };
  const labels: ContextLabels = {
    ...s.labels,
    fixture: { ...fixture },
  };

  // Si team_id defini mais n'est ni home ni away -> supprimer team + player
  if (ctx.team_id && ctx.team_id !== fixture.homeId && ctx.team_id !== fixture.awayId) {
    delete ctx.team_id;
    delete ctx.player_id;
    delete labels.team;
    delete labels.player;
  }

  return { context: ctx, labels };
}

interface TeamInput {
  id: number;
  name: string;
  logo?: string;
}

export function selectTeam(s: ContextState, team: TeamInput): ContextState {
  const ctx = { ...s.context, team_id: team.id };
  const labels: ContextLabels = {
    ...s.labels,
    team: { id: team.id, name: team.name, logo: team.logo },
  };

  // Toujours supprimer player
  delete ctx.player_id;
  delete labels.player;

  // Conserver fixture seulement si team est dans le match
  if (ctx.fixture_id && s.labels.fixture) {
    const fx = s.labels.fixture;
    if (team.id !== fx.homeId && team.id !== fx.awayId) {
      delete ctx.fixture_id;
      delete labels.fixture;
    }
  }

  return { context: ctx, labels };
}

interface PlayerInput {
  id: number;
  name: string;
  photo?: string;
  number?: number;
}

export function selectPlayer(s: ContextState, player: PlayerInput): ContextState {
  // No-op si team_id absent (le niveau 4 exige le niveau 3)
  if (!s.context.team_id) return s;

  return {
    context: { ...s.context, player_id: player.id },
    labels: {
      ...s.labels,
      player: { id: player.id, name: player.name, photo: player.photo, number: player.number },
    },
  };
}

// ---------------------------------------------------------------------------
// Effacement
// ---------------------------------------------------------------------------

export function clearLevel(s: ContextState, level: Exclude<Level, 'none'>): ContextState {
  const ctx = { ...s.context };
  const labels = { ...s.labels };

  switch (level) {
    case 'league':
      // Vide tout le contexte
      return { ...EMPTY_CONTEXT_STATE };

    case 'fixture':
      // Supprime fixture uniquement ; team et player survivent
      delete ctx.fixture_id;
      delete labels.fixture;
      break;

    case 'team':
      // Supprime team et player ; conserve fixture
      delete ctx.team_id;
      delete ctx.player_id;
      delete labels.team;
      delete labels.player;
      break;

    case 'player':
      // Supprime player seul
      delete ctx.player_id;
      delete labels.player;
      break;
  }

  return { context: ctx, labels };
}
