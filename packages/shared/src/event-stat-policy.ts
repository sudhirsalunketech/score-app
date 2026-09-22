import type { RuleAffects } from './tournament-rules';

export type EventStatPolicy = {
  affectsTeamScore: boolean;
  affectsPlayerStats: boolean;
  affectsBatterStats: boolean;
  affectsBowlerStats: boolean;
  affectsMvp: boolean;
  affectsTournamentPoints: boolean;
};

export function eventStatPolicy(input: {
  extraType?: string | null;
  isWicket?: boolean;
  isUndone?: boolean;
  batsmanRuns?: number;
  extraRuns?: number;
  ruleAffects?: Partial<RuleAffects> | null;
}): EventStatPolicy {
  if (input.isUndone) {
    return {
      affectsTeamScore: false,
      affectsPlayerStats: false,
      affectsBatterStats: false,
      affectsBowlerStats: false,
      affectsMvp: false,
      affectsTournamentPoints: false,
    };
  }
  const extra = input.extraType ?? 'NONE';
  const penalty = extra === 'PENALTY';
  const bye = extra === 'BYE' || extra === 'LEG_BYE';
  const wide = extra === 'WIDE';
  const playerOn = input.ruleAffects?.playerStats !== false;
  const pointsOn = input.ruleAffects?.tournamentPoints !== false;
  const mvpOn = playerOn;

  return {
    affectsTeamScore: true,
    affectsPlayerStats: playerOn && !penalty,
    affectsBatterStats: playerOn && !penalty && !bye && !wide,
    affectsBowlerStats: playerOn && !penalty && !bye,
    affectsMvp: mvpOn && !penalty,
    affectsTournamentPoints: pointsOn,
  };
}

export function applyCountedRunsToBatter(input: {
  batsmanRuns: number;
  originalRuns: number;
  countedRuns: number;
  affectsPlayerStats: boolean;
}) {
  if (!input.affectsPlayerStats) return input.batsmanRuns;
  const delta = input.countedRuns - input.originalRuns;
  return Math.max(0, input.batsmanRuns + delta);
}
