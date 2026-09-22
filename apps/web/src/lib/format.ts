import type { Match, Player, Team } from '@/types/api';

export function teamPlayers(team?: Team | null): Player[] {
  return (team?.players ?? []).map((tp) => tp.player);
}

export function allMatchPlayers(match: Match): Player[] {
  const map = new Map<string, Player>();
  for (const p of [...teamPlayers(match.homeTeam), ...teamPlayers(match.awayTeam)]) map.set(p.id, p);
  for (const row of match.players ?? []) map.set(row.player.id, row.player);
  return [...map.values()];
}

export function playerName(match: Match, id: string | null | undefined): string {
  if (!id) return '—';
  return allMatchPlayers(match).find((p) => p.id === id)?.name ?? '—';
}

export function playingXiPlayers(match: Match, teamId: string | null | undefined): Player[] {
  if (!teamId) return [];
  const xi = (match.players ?? []).filter((p) => p.teamId === teamId && p.isPlaying !== false);
  if (xi.length) return xi.map((p) => p.player);
  return teamPlayers(teamById(match, teamId));
}

export function teamRosterPlayers(match: Match, teamId: string | null | undefined): Player[] {
  if (!teamId) return [];
  const map = new Map<string, Player>();
  for (const p of teamPlayers(teamById(match, teamId))) map.set(p.id, p);
  for (const row of match.players ?? []) {
    if (row.teamId === teamId) map.set(row.player.id, row.player);
  }
  return [...map.values()];
}

export function fieldingSidePlayers(match: Match, teamId: string | null | undefined): Player[] {
  const xi = new Set(playingXiPlayers(match, teamId).map((p) => p.id));
  return teamRosterPlayers(match, teamId).sort((a, b) => {
    const play = Number(xi.has(b.id)) - Number(xi.has(a.id));
    if (play) return play;
    return a.name.localeCompare(b.name);
  });
}

export function teamById(match: Match, id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  if (match.homeTeam.id === id) return match.homeTeam;
  if (match.awayTeam.id === id) return match.awayTeam;
  return undefined;
}

export function formatOversFromBalls(legalBalls: number, ballsPerOver: number): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

export function strikeRate(runs: number, balls: number): string {
  if (!balls) return '0.00';
  return ((runs / balls) * 100).toFixed(2);
}

export function economy(runs: number, balls: number, ballsPerOver: number): string {
  if (!balls) return '0.00';
  const overs = balls / ballsPerOver;
  return (runs / overs).toFixed(2);
}

export function formatNrr(nrr: number): string {
  return nrr.toFixed(2);
}

export function formatMatchWhen(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
