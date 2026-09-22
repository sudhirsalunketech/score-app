import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { canManageMatch, canManagePlayer, canManageTeam, canManageTournament, canScoreMatch } from '../matches/scoring-access';
import { canSensitivePlayerLookup } from '../catalog/player-lookup';

describe('PLAYER authorization', () => {
  const player = { id: 'player-user', role: Role.PLAYER };

  it('can score, manage and tournament-manage things they created, but not other people\'s', () => {
    expect(canScoreMatch(player, { createdById: 'player-user', settings: {} })).toBe(true);
    expect(canManageMatch(player, { createdById: 'player-user', settings: {} })).toBe(true);
    expect(canManageTournament(player, { createdById: 'player-user' })).toBe(true);
    expect(canManageTeam(player, { createdById: 'player-user' })).toBe(true);
    expect(canScoreMatch(player, { createdById: 'someone-else', settings: {} })).toBe(false);
    expect(canManageMatch(player, { createdById: 'someone-else', settings: {} })).toBe(false);
    expect(canManageTournament(player, { createdById: 'someone-else' })).toBe(false);
    expect(canManageTeam(player, { createdById: 'someone-else' })).toBe(false);
    expect(canManagePlayer(player, { userId: 'someone-else', teams: [] })).toBe(false);
    expect(canSensitivePlayerLookup(Role.PLAYER)).toBe(false);
  });

  it('keeps scoring endpoints behind MATCH_SCORE / MATCH_UNDO', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/matches/matches.controller.ts'), 'utf8');
    expect(src).toMatch(/@RequirePermission\('MATCH_SCORE'/);
    expect(src).toMatch(/@RequirePermission\('MATCH_UNDO'/);
    expect(src).toMatch(/@Post\('innings\/:id\/events'\)/);
    expect(src).toMatch(/@Post\('innings\/:id\/undo'\)/);
  });

  it('allows PLAYER on team mutation routes (ownership is still enforced inside the handler)', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/catalog/catalog.controller.ts'), 'utf8');
    expect(src).toMatch(/@Roles\(Role\.SUPER_ADMIN, Role\.ADMIN, Role\.SCORER, Role\.TEAM_MANAGER, Role\.PLAYER\)\s*\n\s*createTeam/);
    expect(src).toMatch(/@Roles\(Role\.SUPER_ADMIN, Role\.ADMIN, Role\.SCORER, Role\.TEAM_MANAGER, Role\.PLAYER\)\s*\n\s*async addPlayerToTeam/);
    expect(src).toMatch(/@Roles\(Role\.SUPER_ADMIN, Role\.ADMIN, Role\.SCORER, Role\.TEAM_MANAGER, Role\.PLAYER\)\s*\n\s*async removePlayerFromTeam/);
    expect(src).toMatch(/@Patch\('teams\/:id'\)\s*\n\s*@Roles\(Role\.SUPER_ADMIN, Role\.ADMIN, Role\.SCORER, Role\.TEAM_MANAGER, Role\.PLAYER\)/);
  });

  it('protects tournament edits and custom rules, but lets a PLAYER manage their own tournament', () => {
    const tournaments = readFileSync(path.join(process.cwd(), 'src/tournaments/tournaments.controller.ts'), 'utf8');
    const rules = readFileSync(path.join(process.cwd(), 'src/tournaments/rules.controller.ts'), 'utf8');
    expect(tournaments).toMatch(/@RequirePermission\('TOURNAMENT_EDIT'/);
    expect(rules).toMatch(/@RequirePermission\('TOURNAMENT_MANAGE_RULES'/);
    expect(canManageTournament(player, { createdById: 'player-user' })).toBe(true);
    expect(canManageTournament(player, { createdById: 'someone-else' })).toBe(false);
  });

  it('lets a PLAYER manage only their own linked player record', () => {
    expect(canManagePlayer(player, { userId: 'player-user', teams: [] })).toBe(true);
    expect(canManagePlayer(player, { userId: 'someone-else', teams: [] })).toBe(false);
  });

  it('restricts deleting a team or player to SUPER_ADMIN only', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/catalog/catalog.controller.ts'), 'utf8');
    expect(src).toMatch(/@Delete\('teams\/:id'\)\s*\n\s*@Roles\(Role\.SUPER_ADMIN\)\s*\n\s*async deleteTeam/);
    expect(src).toMatch(/@Delete\('players\/:id'\)\s*\n\s*@Roles\(Role\.SUPER_ADMIN\)\s*\n\s*async deletePlayer/);
  });
});
