import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RegisterClubPage', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/pages/RegisterClubPage.tsx'), 'utf8');

  it('uses a hidden file picker instead of a logo URL field', () => {
    expect(src).toMatch(/ClubLogoField/);
    expect(src).not.toMatch(/clubs\.logoUrl/);
    expect(src).not.toMatch(/type="url"/);
  });

  it('disables duplicate submit while uploading or saving', () => {
    expect(src).toMatch(/create\.isPending \|\| logoBusy/);
    expect(src).toMatch(/disabled=\{submitting\}/);
  });
});
