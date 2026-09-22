import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('controller permission wiring', () => {
  it('requires MATCH_SCORE / MATCH_UNDO separately and is not public', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/matches/matches.controller.ts'), 'utf8');
    expect(src).toMatch(/@RequirePermission\('MATCH_SCORE'/);
    expect(src).toMatch(/@RequirePermission\('MATCH_UNDO'/);
    expect(src).toMatch(/@RequirePermission\('MATCH_DELETE'\)/);
    expect(src).toMatch(/@RequirePermission\('MATCH_MANAGE_PLAYING_XI'\)/);
    expect(src).toMatch(/@RequirePermission\('MATCH_MANAGE_TOSS'\)/);
    expect(src).toMatch(/@RequirePermission\('MATCH_MANAGE_RESULT'\)/);
    expect(src).not.toMatch(/@Public\(\)\s*\n\s*@Post\('innings\/:id\/events'\)/);
    expect(src).not.toMatch(/@Public\(\)\s*\n\s*@Post\('innings\/:id\/undo'\)/);
    expect(src).not.toMatch(/@Roles\(Role\.SCORER[\s\S]*@Post\('innings\/:id\/events'\)/);
  });

  it('health reports status ok and config is public', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/app.module.ts'), 'utf8');
    expect(src).toMatch(/status: 'ok'/);
    expect(src).toMatch(/@Get\('config'\)/);
    expect(src).toMatch(/BetaController/);
  });

  it('protects tournament rule edits with TOURNAMENT_MANAGE_RULES', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/tournaments/rules.controller.ts'), 'utf8');
    expect(src).toMatch(/@RequirePermission\('TOURNAMENT_MANAGE_RULES'/);
    expect(src).not.toMatch(/@Roles\(/);
  });
});
