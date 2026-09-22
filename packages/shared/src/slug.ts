export function slugifyMatchTitle(home: string, away: string, year = new Date().getUTCFullYear()): string {
  const base = `${home}-vs-${away}-${year}`
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return base || `match-${year}`;
}

export function withSlugSuffix(base: string, suffix: string): string {
  const clean = suffix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
  return `${base}-${clean || 'live'}`.slice(0, 80);
}

export function slugifyName(name: string, year = new Date().getUTCFullYear()): string {
  const base = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return base || `tournament-${year}`;
}
