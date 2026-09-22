import { describe, expect, it } from 'vitest';
import { filterSeasonYears, seasonYearOptions } from './season-years';

describe('seasonYearOptions', () => {
  it('lists calendar years and season ranges like Year 2023 then Year 2022-23', () => {
    expect(seasonYearOptions(2023, 2021)).toEqual([
      'Year 2023',
      'Year 2022-23',
      'Year 2022',
      'Year 2021-22',
      'Year 2021',
    ]);
  });

  it('filters by year digits', () => {
    const options = seasonYearOptions(2023, 2020);
    expect(filterSeasonYears(options, '2022-23')).toEqual(['Year 2022-23']);
    expect(filterSeasonYears(options, '2021')).toEqual(['Year 2021-22', 'Year 2021']);
  });
});
