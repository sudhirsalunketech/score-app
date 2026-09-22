import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('player account routes', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/players/player-account.controller.ts'), 'utf8');

  it('exposes player history and dedicated team history endpoints', () => {
    expect(src).toMatch(/@Get\('users\/me\/played-matches'\)/);
    expect(src).toMatch(/@Get\('users\/me\/tournaments'\)/);
    expect(src).toMatch(/@Get\('players\/:id\/teams'\)/);
    expect(src).toMatch(/@Get\('players\/:id\/matches'\)/);
    expect(src).toMatch(/@Get\('teams\/:id\/matches'\)/);
    expect(src).toMatch(/@Get\('teams\/:id\/tournaments'\)/);
    expect(src).toMatch(/@Query\('from'\)/);
    expect(src).toMatch(/@Query\('to'\)/);
    expect(src).toMatch(/@Query\('page'\)/);
    expect(src).toMatch(/@Query\('limit'\)/);
    expect(src).toMatch(/@Query\('season'\)/);
    expect(src).toMatch(/@Query\('tournamentId'\)/);
  });

  it('keeps team history public-readable without mutating teams', () => {
    expect(src).toMatch(/@Public\(\)\s*\n\s*@Get\('teams\/:id\/matches'\)/);
    expect(src).toMatch(/@Public\(\)\s*\n\s*@Get\('teams\/:id\/tournaments'\)/);
    expect(src).not.toMatch(/@Post\('teams\//);
    expect(src).not.toMatch(/@Patch\('teams\//);
  });
});
