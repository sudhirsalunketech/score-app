import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('beta controller wiring', () => {
  it('protects tester and feedback admin routes with Roles', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/beta/beta.controller.ts'), 'utf8');
    expect(src).toMatch(/@Roles\(Role\.ADMIN, Role\.SUPER_ADMIN\)/);
    expect(src).toMatch(/@Get\('testers'\)/);
    expect(src).toMatch(/@Post\('testers\/invite'\)/);
    expect(src).toMatch(/@Post\('feedback'\)/);
    expect(src).not.toMatch(/@Public\(\)/);
  });
});
