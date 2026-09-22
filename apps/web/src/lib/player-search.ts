export type SearchablePlayer = {
  id: string;
  name: string;
  profileCode?: string | null;
  role?: string | null;
  jerseyNo?: number | null;
};

export function playerMatchesQuery(player: SearchablePlayer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (player.name.toLowerCase().includes(q)) return true;
  if (player.profileCode?.toLowerCase().includes(q)) return true;
  if ((player.role ?? '').toLowerCase().replace(/[_-]/g, ' ').includes(q.replace(/[_-]/g, ' '))) return true;
  if (player.jerseyNo != null && (String(player.jerseyNo) === q || `#${player.jerseyNo}` === q)) return true;
  return false;
}

export function filterPlayersForSearch(
  players: SearchablePlayer[],
  query: string,
  excludeIds: string[] = [],
  limit = 20,
): SearchablePlayer[] {
  const excluded = new Set(excludeIds);
  return players.filter((player) => !excluded.has(player.id) && playerMatchesQuery(player, query)).slice(0, limit);
}
