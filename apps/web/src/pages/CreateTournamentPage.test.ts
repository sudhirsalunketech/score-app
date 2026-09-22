import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CreateTournamentPage', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/pages/CreateTournamentPage.tsx'), 'utf8');

  it('uses a hidden file picker instead of a logo URL field', () => {
    expect(src).toMatch(/ClubLogoField/);
    expect(src).not.toMatch(/tournaments\.logoUrl/);
  });

  it('disables duplicate submit while uploading or saving', () => {
    expect(src).toMatch(/create\.isPending \|\| logoBusy/);
    expect(src).toMatch(/disabled=\{submitting\}/);
  });

  it('matches the register-club full-screen form chrome', () => {
    expect(src).toMatch(/flex min-h-dvh flex-col/);
    expect(src).toMatch(/bg-dark-chrome text-on-dark/);
    expect(src).toMatch(/sticky top-0/);
    expect(src).toMatch(/w-\[calc\(100%-2rem\)\]/);
    expect(src).toMatch(/text-lg font-semibold leading-snug/);
    expect(src).toMatch(/h-\[52px\] w-full/);
    expect(src).toMatch(/noValidate/);
    expect(src).not.toMatch(/saveAndContinue/);
    expect(src).not.toMatch(/onToggle/);
  });

  it('does not silently swallow a failure to save preset rules', () => {
    // Regression: a tournament created with rules enabled (hattrick/boundary/six bonus etc.)
    // used to lose those rules with zero feedback whenever the follow-up rulesets call failed.
    expect(src).not.toMatch(/catch\s*\{\s*\/\/ The tournament itself was created successfully/);
    expect(src).toMatch(/setRulesRetry\(\{ tournamentId: tn\.id \}\)/);
    expect(src).toMatch(/rulesSaveFailedTitle/);
  });
});
