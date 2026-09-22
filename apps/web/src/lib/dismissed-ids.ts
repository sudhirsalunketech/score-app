export function dismissedIdsFromSnapshot(
  batters: Array<{ playerId: string; isOut?: boolean }> | undefined,
  previous: string[] = [],
) {
  const fromSnap = (batters ?? []).filter((b) => b.isOut).map((b) => b.playerId);
  if (fromSnap.length) return Array.from(new Set(fromSnap));
  return previous.filter((id) => (batters ?? []).some((b) => b.playerId === id && b.isOut));
}
