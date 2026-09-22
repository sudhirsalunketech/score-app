export type PlayingXiRoleFlag = {
  playerId: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWicketKeeper?: boolean;
};

export type PlayingXiValidationInput = {
  teamId: string;
  matchTeamIds: [string, string];
  playingPerSide: number;
  rosterPlayerIds: string[];
  players: PlayingXiRoleFlag[];
};

export type PlayingXiValidationError = {
  code:
    | 'WRONG_TEAM'
    | 'DUPLICATE_PLAYER'
    | 'NOT_IN_ROSTER'
    | 'COUNT'
    | 'CAPTAIN'
    | 'VICE_CAPTAIN'
    | 'WICKET_KEEPER'
    | 'CAPTAIN_EQUALS_VICE';
  message: string;
};

export function toggleSelectedPlayer(selectedIds: string[], playerId: string, max: number): string[] {
  if (selectedIds.includes(playerId)) return selectedIds.filter((id) => id !== playerId);
  if (selectedIds.length >= max) return selectedIds;
  return [...selectedIds, playerId];
}

export function assignExclusiveRole<T extends PlayingXiRoleFlag>(
  players: T[],
  playerId: string,
  role: 'isCaptain' | 'isViceCaptain' | 'isWicketKeeper',
): T[] {
  if (!players.some((p) => p.playerId === playerId)) return players;
  return players.map((p) => {
    const next = { ...p, [role]: p.playerId === playerId };
    if (role === 'isCaptain' && p.playerId === playerId) next.isViceCaptain = false;
    if (role === 'isViceCaptain' && p.playerId === playerId) next.isCaptain = false;
    return next;
  });
}

export function validatePlayingXi(input: PlayingXiValidationInput): PlayingXiValidationError[] {
  const errors: PlayingXiValidationError[] = [];
  const required = Math.max(2, Math.min(11, input.playingPerSide));
  if (![input.matchTeamIds[0], input.matchTeamIds[1]].includes(input.teamId)) {
    errors.push({ code: 'WRONG_TEAM', message: 'Team is not part of this match' });
  }
  const ids = input.players.map((p) => p.playerId);
  if (new Set(ids).size !== ids.length) {
    errors.push({ code: 'DUPLICATE_PLAYER', message: 'Duplicate player in Playing XI' });
  }
  if (ids.length !== required) {
    errors.push({
      code: 'COUNT',
      message: `Playing XI must have exactly ${required} players`,
    });
  }
  const roster = new Set(input.rosterPlayerIds);
  if (ids.some((id) => !roster.has(id))) {
    errors.push({ code: 'NOT_IN_ROSTER', message: 'Player does not belong to the selected team' });
  }
  const captains = input.players.filter((p) => p.isCaptain);
  const vices = input.players.filter((p) => p.isViceCaptain);
  const keepers = input.players.filter((p) => p.isWicketKeeper);
  if (captains.length !== 1) {
    errors.push({ code: 'CAPTAIN', message: 'Select exactly one captain from the Playing XI' });
  }
  if (vices.length !== 1) {
    errors.push({ code: 'VICE_CAPTAIN', message: 'Select exactly one vice captain from the Playing XI' });
  }
  if (keepers.length !== 1) {
    errors.push({ code: 'WICKET_KEEPER', message: 'Select exactly one wicket keeper from the Playing XI' });
  }
  if (captains[0] && vices[0] && captains[0].playerId === vices[0].playerId) {
    errors.push({ code: 'CAPTAIN_EQUALS_VICE', message: 'Captain and vice captain must be different players' });
  }
  return errors;
}

export function playingXiLocked(scoringEventCount: number): boolean {
  return scoringEventCount > 0;
}
