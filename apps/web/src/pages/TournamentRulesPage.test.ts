import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TournamentRulesPage', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/pages/TournamentRulesPage.tsx'), 'utf8');

  it('activates a newly-created rule version even when an older version is already enabled', () => {
    // Regression: once a match starts, the previously-active version is locked, so saving any
    // preset (Hattrick, Penalty, Six Bonus, Boundary Streak) again creates a NEW version. The old
    // activation check only looked at whether the OLD version was enabled (always true after the
    // first activation), so it never activated the new one — edits after a tournament's first
    // match silently never went live, even though the save itself appeared to succeed.
    expect(src).not.toMatch(/if \(opts\.activateAfter && !enabled\)/);
    expect(src).toMatch(/version !== current\?\.version \|\| !enabled/);
  });
});
