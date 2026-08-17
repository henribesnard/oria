import { describe, it, expect } from 'vitest';
import {
  selectLeague,
  selectFixture,
  selectTeam,
  selectPlayer,
  clearLevel,
  deepestLevel,
  currentSeason,
  snapWindow,
  EMPTY_CONTEXT_STATE,
  type ContextState,
} from './contextRules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAGUE = { id: 61, name: 'Ligue 1', logo: '/l1.png', country: 'France' };
const LEAGUE_PL = { id: 39, name: 'Premier League', logo: '/pl.png', country: 'England' };

const FIXTURE = {
  id: 999,
  home: 'Marseille', away: 'Strasbourg',
  homeId: 81, awayId: 44,
  homeLogo: '/om.png', awayLogo: '/rcs.png',
  date: '2026-08-22', status: 'NS', round: 'Regular Season - 3',
};

const TEAM_OM = { id: 81, name: 'Marseille', logo: '/om.png' };
const TEAM_PSG = { id: 85, name: 'PSG', logo: '/psg.png' };
const PLAYER_RULLI = { id: 123, name: 'Rulli', photo: '/rulli.png', number: 1 };

function withLeague(): ContextState {
  return selectLeague(EMPTY_CONTEXT_STATE, LEAGUE);
}

function withFixture(): ContextState {
  return selectFixture(withLeague(), FIXTURE);
}

function withTeam(): ContextState {
  return selectTeam(withLeague(), TEAM_OM);
}

function withAll(): ContextState {
  const s1 = withLeague();
  const s2 = selectFixture(s1, FIXTURE);
  const s3 = selectTeam(s2, TEAM_OM);
  return selectPlayer(s3, PLAYER_RULLI);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectLeague', () => {
  it('pose league_id et season, supprime fixture/team/player', () => {
    const s = selectLeague(withAll(), LEAGUE_PL);
    expect(s.context.league_id).toBe(39);
    expect(s.context.season).toBeDefined();
    expect(s.context.fixture_id).toBeUndefined();
    expect(s.context.team_id).toBeUndefined();
    expect(s.context.player_id).toBeUndefined();
    expect(s.labels.league?.name).toBe('Premier League');
    expect(s.labels.fixture).toBeUndefined();
    expect(s.labels.team).toBeUndefined();
    expect(s.labels.player).toBeUndefined();
  });
});

describe('clearLevel(league)', () => {
  it('vide tout le contexte', () => {
    const s = clearLevel(withAll(), 'league');
    expect(s.context).toEqual({});
    expect(s.labels).toEqual({});
  });
});

describe('selectFixture', () => {
  it('pose fixture_id, conserve team_id si elle appartient au match', () => {
    const s = selectTeam(withLeague(), TEAM_OM);
    const r = selectFixture(s, FIXTURE);
    expect(r.context.fixture_id).toBe(999);
    expect(r.context.team_id).toBe(81); // OM est home -> conserve
    expect(r.labels.fixture?.home).toBe('Marseille');
  });

  it('supprime team_id et player_id si equipe etrangere au match', () => {
    const s = selectTeam(withLeague(), TEAM_PSG);
    const withPlayer = selectPlayer(s, PLAYER_RULLI); // player sans fixture ne marche que si team_id
    const r = selectFixture(withPlayer, FIXTURE);
    expect(r.context.fixture_id).toBe(999);
    expect(r.context.team_id).toBeUndefined(); // PSG n'est ni home ni away
    expect(r.context.player_id).toBeUndefined();
  });
});

describe('clearLevel(fixture)', () => {
  it('supprime fixture_id seul, team et player survivent', () => {
    const s = withAll();
    const r = clearLevel(s, 'fixture');
    expect(r.context.fixture_id).toBeUndefined();
    expect(r.context.team_id).toBe(81);
    expect(r.context.player_id).toBe(123);
  });
});

describe('selectTeam', () => {
  it('pose team_id, supprime toujours player_id', () => {
    const s = withAll();
    const r = selectTeam(s, TEAM_OM);
    expect(r.context.team_id).toBe(81);
    expect(r.context.player_id).toBeUndefined();
  });

  it('conserve fixture_id si team est dans le match', () => {
    const s = selectFixture(withLeague(), FIXTURE);
    const r = selectTeam(s, TEAM_OM);
    expect(r.context.fixture_id).toBe(999);
  });

  it('supprime fixture_id si team hors du match', () => {
    const s = selectFixture(withLeague(), FIXTURE);
    const r = selectTeam(s, TEAM_PSG);
    expect(r.context.fixture_id).toBeUndefined();
  });
});

describe('clearLevel(team)', () => {
  it('supprime team_id et player_id, conserve fixture_id', () => {
    const s = withAll();
    const r = clearLevel(s, 'team');
    expect(r.context.team_id).toBeUndefined();
    expect(r.context.player_id).toBeUndefined();
    expect(r.context.fixture_id).toBe(999);
  });
});

describe('selectPlayer', () => {
  it('pose player_id quand team_id present', () => {
    const s = withTeam();
    const r = selectPlayer(s, PLAYER_RULLI);
    expect(r.context.player_id).toBe(123);
    expect(r.labels.player?.name).toBe('Rulli');
  });

  it('no-op si team_id absent', () => {
    const s = withLeague();
    const r = selectPlayer(s, PLAYER_RULLI);
    expect(r).toBe(s); // meme reference = no-op
    expect(r.context.player_id).toBeUndefined();
  });
});

describe('clearLevel(player)', () => {
  it('supprime player_id seul', () => {
    const s = withAll();
    const r = clearLevel(s, 'player');
    expect(r.context.player_id).toBeUndefined();
    expect(r.context.team_id).toBe(81);
    expect(r.context.fixture_id).toBe(999);
  });
});

describe('deepestLevel', () => {
  it('none quand vide', () => expect(deepestLevel(EMPTY_CONTEXT_STATE)).toBe('none'));
  it('league', () => expect(deepestLevel(withLeague())).toBe('league'));
  it('fixture', () => expect(deepestLevel(withFixture())).toBe('fixture'));
  it('team', () => expect(deepestLevel(withTeam())).toBe('team'));
  it('player', () => expect(deepestLevel(withAll())).toBe('player'));
});

describe('currentSeason', () => {
  it('renvoie annee - 1 avant juillet', () => {
    expect(currentSeason(new Date('2026-06-15'))).toBe(2025);
  });
  it('renvoie annee a partir de juillet', () => {
    expect(currentSeason(new Date('2026-07-01'))).toBe(2026);
  });
  it('renvoie annee en decembre', () => {
    expect(currentSeason(new Date('2026-12-31'))).toBe(2026);
  });
});

describe('snapWindow', () => {
  it('renvoie des bornes YYYY-MM-DD', () => {
    const { from, to } = snapWindow(new Date('2026-08-15'));
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toBe('2026-08-05');
    expect(to).toBe('2026-08-25');
  });

  it('est stable pour deux appels le meme jour a des heures differentes', () => {
    const a = snapWindow(new Date('2026-08-15T08:00:00'));
    const b = snapWindow(new Date('2026-08-15T23:59:59'));
    expect(a).toEqual(b);
  });

  it('respecte daysBack et daysAhead personnalises', () => {
    const { from, to } = snapWindow(new Date('2026-08-15'), 30, 30);
    expect(from).toBe('2026-07-16');
    expect(to).toBe('2026-09-14');
  });
});
