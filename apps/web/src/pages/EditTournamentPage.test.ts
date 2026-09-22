import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('EditTournamentPage', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/pages/EditTournamentPage.tsx'), 'utf8');

  it('does not silently swallow a failure to save rule changes and navigate away regardless', () => {
    // Regression: editing hattrick/penalty/bonus values then saving used to always nav() away even
    // when the rules PUT/activate call failed, silently discarding the edit with zero feedback —
    // so reopening Edit Tournament showed the old (pre-edit) values, looking like they "vanished".
    expect(src).not.toMatch(/catch\s*\{\s*\/\/ The tournament's basic details were still saved successfully; rules can be retried/);
    expect(src).toMatch(/setRulesSaveFailed\(true\)/);
    expect(src).toMatch(/rulesSaveFailed/);
  });

  it('activates a newly-created rule version even when an older version is already enabled', () => {
    // Regression: once a match starts, the previously-active version is locked, so editing rules
    // again always creates a NEW version. The old activation check only looked at whether the OLD
    // version was enabled (always true after the first activation), so it never activated the new
    // one — rule edits after a tournament's first match silently never went live.
    expect(src).not.toMatch(/if \(!current\?\.enabled && merged\.some/);
    expect(src).toMatch(/version !== current\?\.version \|\| !current\?\.enabled/);
  });
});
