import type { Match, Team } from '@/types/api';

export function matchGroupName(match: Pick<Match, 'homeTeamId' | 'awayTeamId' | 'tournament'> | null | undefined): string | null {
  const groups = match?.tournament?.groups ?? [];
  if (!match || !groups.length) return null;
  const both = groups.find((g) => {
    const ids = g.teams.map((t) => t.teamId);
    return ids.includes(match.homeTeamId) && ids.includes(match.awayTeamId);
  });
  if (both) return both.name;
  const one = groups.find((g) => g.teams.some((t) => t.teamId === match.homeTeamId || t.teamId === match.awayTeamId));
  return one?.name ?? groups[0]?.name ?? null;
}

export function splitTeamName(name: string): [string, string] {
  const i = name.trim().lastIndexOf(' ');
  if (i <= 0) return [name, ''];
  return [name.slice(0, i), name.slice(i + 1)];
}

export function settingString(settings: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = settings?.[key];
  return typeof v === 'string' && v ? v : null;
}

export function settingBool(settings: Record<string, unknown> | null | undefined, key: string, fallback = false): boolean {
  const v = settings?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function teamLogo(team: Team | null | undefined): string | null {
  return team?.logoUrl ?? null;
}
