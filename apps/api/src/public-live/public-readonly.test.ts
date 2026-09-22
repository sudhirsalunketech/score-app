import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public APIs are read-only', () => {
  it('does not expose scoring or undo on public live controllers', () => {
    const live = readFileSync(path.join(process.cwd(), 'src/public-live/public-live.controller.ts'), 'utf8');
    const tournament = readFileSync(path.join(process.cwd(), 'src/public-live/public-tournament.controller.ts'), 'utf8');
    expect(live).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
    expect(tournament).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });

  it('requires auth to score or undo', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/matches/matches.controller.ts'), 'utf8');
    expect(src).toMatch(/@Post\('innings\/:id\/events'\)/);
    expect(src).toMatch(/@Post\('innings\/:id\/undo'\)/);
    expect(src).not.toMatch(/@Public\(\)\s*\n\s*@Post\('innings\/:id\/events'\)/);
    expect(src).not.toMatch(/@Public\(\)\s*\n\s*@Post\('innings\/:id\/undo'\)/);
    expect(src).toMatch(/assertCanScoreInnings/);
  });
});
