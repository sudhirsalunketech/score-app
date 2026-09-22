import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AppShell', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8');

  it('uses the same full-screen chrome as register club for tournament forms', () => {
    expect(src).toContain("/clubs/register");
    expect(src).toContain("/tournaments/new");
    expect(src).toContain("/edit");
  });
});
