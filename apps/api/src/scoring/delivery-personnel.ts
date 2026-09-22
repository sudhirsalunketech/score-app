export function deliveryPersonnelError(input: {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  battingPlayerIds: Iterable<string>;
  bowlingPlayerIds: Iterable<string>;
}): string | null {
  if (input.strikerId === input.nonStrikerId) {
    return 'Striker and non-striker must be different players.';
  }
  const batting = new Set(input.battingPlayerIds);
  const bowling = new Set(input.bowlingPlayerIds);
  if (!batting.has(input.strikerId) || !batting.has(input.nonStrikerId)) {
    return 'Batsmen must belong to the batting team.';
  }
  if (!bowling.has(input.bowlerId)) {
    return 'Bowler must belong to the bowling team.';
  }
  return null;
}
