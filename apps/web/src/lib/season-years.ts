export const SEASON_YEAR_MIN = 1970;

export function seasonYearOptions(now = new Date().getFullYear(), min = SEASON_YEAR_MIN): string[] {
  const out: string[] = [];
  for (let year = now; year >= min; year -= 1) {
    out.push(`Year ${year}`);
    if (year > min) {
      out.push(`Year ${year - 1}-${String(year).slice(-2)}`);
    }
  }
  return out;
}

export function filterSeasonYears(options: string[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((option) => option.toLowerCase().includes(q));
}
