import type { ExtraType, InningsSnapshot } from '@/types/api';

export type BallFeedEvent = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  batsmanRuns: number;
  extraRuns: number;
  extraType: ExtraType | string;
  isWicket: boolean;
  dismissalType?: string | null;
  commentary?: string | null;
  bowlerName: string;
  strikerName: string;
  dismissedName?: string | null;
  ruleLabel?: string | null;
  ruleReason?: string | null;
};

export type BallsBatterLine = { name: string; runs: number; balls: number };
export type BallsBowlerLine = { name: string; overs: string; maidens: number; runs: number; wickets: number };
export type BallsSummary = {
  striker: BallsBatterLine | null;
  nonStriker: BallsBatterLine | null;
  bowler: BallsBowlerLine | null;
  overs: string;
  runs: number;
  wickets: number;
};

export function ballFeedBadge(ev: BallFeedEvent): string {
  if (ev.isWicket) return 'W';
  if (ev.extraType === 'WIDE') return 'Wd';
  if (ev.extraType === 'NO_BALL') return ev.batsmanRuns > 0 ? `N${ev.batsmanRuns}` : 'N';
  if (ev.extraType === 'BYE') return ev.extraRuns > 1 ? `B${ev.extraRuns}` : 'B';
  if (ev.extraType === 'LEG_BYE') return ev.extraRuns > 1 ? `Lb${ev.extraRuns}` : 'Lb';
  if (ev.extraType === 'PENALTY') return ev.extraRuns < 0 ? `${ev.extraRuns}` : `+${ev.extraRuns}`;
  return String(ev.batsmanRuns);
}

/**
 * `overNumber`/`ballInOver` on the stored event are the pre-ball snapshot (legal
 * balls already bowled in the over before this delivery, 0-indexed) — that's the
 * correct semantic for scoring/replay math, but commentary needs the 1-indexed
 * ball-within-over label ("0.1" for the first ball, "0.6" for the last of over 0).
 */
export function ballFeedOver(ev: Pick<BallFeedEvent, 'overNumber' | 'ballInOver'>): string {
  return `${ev.overNumber}.${ev.ballInOver + 1}`;
}

const RUN_KEYS = ['dot', 'single', 'two', 'three', 'four', 'five', 'six'] as const;

const DISMISSAL_KEYS: Record<string, string> = {
  BOWLED: 'scoring.bowled',
  CAUGHT: 'scoring.caught',
  STUMPED: 'scoring.stumped',
  LBW: 'scoring.lbw',
  RUN_OUT: 'scoring.runOut',
  MANKAD: 'scoring.mankad',
  RETIRED_OUT: 'scoring.retired',
  RETIRED_HURT: 'scoring.retired',
  OVER_THE_FENCE: 'scoring.overTheFence',
  ONE_HAND_ONE_BOUNCE: 'scoring.oneHandOneBounce',
  OBSTRUCTING: 'scoring.obstructing',
  HIT_WICKET: 'scoring.hitWicket',
  HIT_BALL_TWICE: 'scoring.hitBallTwice',
  TIMED_OUT: 'scoring.timedOut',
};

export function dismissalI18nKey(type?: string | null): string {
  return (type && DISMISSAL_KEYS[type]) || 'match.ballDesc.wicket';
}

export function ballFeedDescriptionKey(ev: BallFeedEvent): { key: string; count?: number } {
  if (ev.isWicket) {
    if (ev.dismissalType === 'BOWLED') return { key: 'match.ballDesc.bowledWicket' };
    if (ev.dismissalType === 'CAUGHT') return { key: 'match.ballDesc.caughtWicket' };
    if (ev.dismissalType) return { key: 'match.ballDesc.wicketLine' };
    return { key: 'match.ballDesc.wicket' };
  }
  if (ev.extraType === 'WIDE') return { key: 'match.ballDesc.wide' };
  if (ev.extraType === 'NO_BALL') return { key: 'match.ballDesc.noBall' };
  if (ev.extraType === 'BYE') return { key: 'match.ballDesc.bye', count: ev.extraRuns };
  if (ev.extraType === 'LEG_BYE') return { key: 'match.ballDesc.legBye', count: ev.extraRuns };
  if (ev.extraType === 'PENALTY') return { key: ev.extraRuns < 0 ? 'match.ballDesc.penalty' : 'match.ballDesc.bonus' };
  const runs = Math.min(Math.max(ev.batsmanRuns, 0), 6);
  return { key: `match.ballDesc.${RUN_KEYS[runs]}` };
}

export function latestOverBalls(events: BallFeedEvent[]): BallFeedEvent[] {
  if (events.length === 0) return [];
  const over = Math.max(...events.map((e) => e.overNumber));
  return events.filter((e) => e.overNumber === over).sort((a, b) => a.sequence - b.sequence);
}

export function formatOversLabel(display: string): string {
  return display.endsWith('.0') ? display.slice(0, -2) : display;
}

export function ballsSummaryFromSnapshot(
  snap: InningsSnapshot | null | undefined,
  nameOf: (id: string | null) => string,
  ballsPerOver: number,
): BallsSummary | null {
  if (!snap) return null;
  const batter = (id: string | null): BallsBatterLine | null => {
    if (!id) return null;
    const card = snap.batters.find((b) => b.playerId === id);
    return { name: nameOf(id), runs: card?.runs ?? 0, balls: card?.balls ?? 0 };
  };
  const bowlerId = snap.bowlerId;
  const bowl = bowlerId ? snap.bowlers.find((b) => b.playerId === bowlerId) : undefined;
  return {
    striker: batter(snap.strikerId),
    nonStriker: batter(snap.nonStrikerId),
    bowler:
      bowlerId && bowl
        ? {
            name: nameOf(bowlerId),
            overs: `${Math.floor(bowl.balls / ballsPerOver)}.${bowl.balls % ballsPerOver}`,
            maidens: bowl.maidens,
            runs: bowl.runs,
            wickets: bowl.wickets,
          }
        : bowlerId
          ? { name: nameOf(bowlerId), overs: '0.0', maidens: 0, runs: 0, wickets: 0 }
          : null,
    overs: formatOversLabel(snap.oversDisplay),
    runs: snap.totalRuns,
    wickets: snap.totalWickets,
  };
}

export function ballsSummaryFromEvents(events: BallFeedEvent[], ballsPerOver: number): BallsSummary | null {
  if (events.length === 0) return null;
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  for (const e of events) {
    runs += e.batsmanRuns + e.extraRuns;
    if (e.isWicket) wickets += 1;
    const extra = e.extraType;
    if (extra !== 'WIDE' && extra !== 'NO_BALL' && extra !== 'PENALTY') legal += 1;
  }
  const last = [...events].sort((a, b) => b.sequence - a.sequence)[0]!;
  const overs = `${Math.floor(legal / ballsPerOver)}.${legal % ballsPerOver}`;
  return {
    striker: { name: last.strikerName, runs: 0, balls: 0 },
    nonStriker: null,
    bowler: { name: last.bowlerName, overs, maidens: 0, runs, wickets },
    overs: formatOversLabel(overs),
    runs,
    wickets,
  };
}
