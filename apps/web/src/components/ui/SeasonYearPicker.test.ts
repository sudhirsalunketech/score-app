import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SeasonYearPicker', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/components/ui/SeasonYearPicker.tsx'), 'utf8');

  it('uses a custom portal popup instead of a native select or nested modal scroll', () => {
    expect(src).toMatch(/createPortal/);
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).not.toMatch(/<select\b/);
    expect(src).not.toMatch(/from '@\/components\/ui\/Modal'/);
  });

  it('keeps existing season options and search filtering', () => {
    expect(src).toMatch(/seasonYearOptions/);
    expect(src).toMatch(/filterSeasonYears/);
    expect(src).toMatch(/optionsProp/);
  });

  it('scrolls only the season list and shows a selected check', () => {
    expect(src.match(/overflow-y-auto/g)?.length).toBe(1);
    expect(src).toMatch(/cs-season-list/);
    expect(src).toMatch(/✓/);
    expect(src).toMatch(/tournaments\.seasonSearch/);
    expect(src).toMatch(/tournaments\.noSeasons/);
    expect(src).toMatch(/document\.body\.style\.overflow = 'hidden'/);
    expect(src).toMatch(/Escape/);
    expect(src).toMatch(/ArrowDown/);
  });
});
