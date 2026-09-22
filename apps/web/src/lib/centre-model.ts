import { economy, playerName, strikeRate, teamById } from '@/lib/format';
import type { CustomRulesOverlay, InningsSnapshot, LiveData, PublicLiveScoreDto } from '@/types/api';

export type CentreBatter = {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  sr: string;
  onStrike: boolean;
};

export type CentreBowler = {
  id: string;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  eco: string;
  balls: number;
};

export type CentreBall = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  label: string;
  isWicket: boolean;
  runs: number;
  strikerName?: string | null;
  bowlerName?: string | null;
};

export type CentreModel = {
  battingTeamName: string;
  inningsNumber: number;
  runs: number;
  wickets: number;
  maxWickets: number;
  extras: number;
  overs: string;
  oversLimit: number;
  crr: number;
  partnershipRuns: number;
  partnershipBalls: number;
  batsmen: CentreBatter[];
  bowler: CentreBowler | null;
  recentBalls: CentreBall[];
  status: string;
  title: string;
  youtubeVideoId: string | null;
  youtubeEnabled: boolean;
  publicSlug: string | null;
  publicLiveEnabled: boolean;
  shareUrl: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  resultType: string | null;
  winnerTeamId: string | null;
  marginType: string | null;
  marginValue: number | null;
  inningsScores: Array<{ battingTeamId: string; runs: number; wickets: number; overs: string }>;
  customRules?: CustomRulesOverlay | null;
};

export function groupRecentOvers(balls: CentreBall[]): { overNumber: number; balls: CentreBall[] }[] {
  const map = new Map<number, CentreBall[]>();
  for (const b of balls) {
    const list = map.get(b.overNumber) ?? [];
    list.push(b);
    map.set(b.overNumber, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([overNumber, items]) => ({
      overNumber,
      balls: items.slice().sort((a, b) => a.sequence - b.sequence),
    }));
}

function batterFromSnap(
  snap: InningsSnapshot,
  id: string | null,
  name: string,
  onStrike: boolean,
): CentreBatter | null {
  if (!id) return null;
  const c = snap.batters.find((b) => b.playerId === id);
  return {
    id,
    name,
    runs: c?.runs ?? 0,
    balls: c?.balls ?? 0,
    fours: c?.fours ?? 0,
    sixes: c?.sixes ?? 0,
    sr: Number(strikeRate(c?.runs ?? 0, c?.balls ?? 0)).toFixed(1),
    onStrike,
  };
}

export function centreFromLive(live: LiveData, shareUrl: string | null): CentreModel {
  const match = live.match;
  const snap = live.snapshot;
  const innings = live.innings;
  const batting = innings ? teamById(match, innings.battingTeamId) : match.homeTeam;
  const strikerId = snap?.strikerId ?? null;
  const nonStrikerId = snap?.nonStrikerId ?? null;
  const batsmen = [
    batterFromSnap(snap ?? emptySnap(), strikerId, playerName(match, strikerId), true),
    batterFromSnap(snap ?? emptySnap(), nonStrikerId, playerName(match, nonStrikerId), false),
  ].filter((x): x is CentreBatter => Boolean(x));
  const bowlerId = snap?.bowlerId ?? null;
  const bowlCard = bowlerId ? snap?.bowlers.find((b) => b.playerId === bowlerId) : undefined;
  const bowlerBalls = bowlCard?.balls ?? 0;
  const bowler: CentreBowler | null = bowlerId
    ? {
        id: bowlerId,
        name: playerName(match, bowlerId),
        overs: `${Math.floor(bowlerBalls / match.ballsPerOver)}.${bowlerBalls % match.ballsPerOver}`,
        maidens: bowlCard?.maidens ?? 0,
        runs: bowlCard?.runs ?? 0,
        wickets: bowlCard?.wickets ?? 0,
        eco: economy(bowlCard?.runs ?? 0, bowlerBalls, match.ballsPerOver),
        balls: bowlerBalls,
      }
    : null;

  return {
    battingTeamName: batting?.name ?? match.homeTeam.name,
    inningsNumber: innings?.inningsNumber ?? 1,
    runs: snap?.totalRuns ?? 0,
    wickets: snap?.totalWickets ?? 0,
    maxWickets: match.maxWickets,
    extras: snap?.extras ?? 0,
    overs: snap?.oversDisplay ?? '0.0',
    oversLimit: match.overs,
    crr: snap?.currentRunRate ?? 0,
    partnershipRuns: snap?.partnership?.runs ?? 0,
    partnershipBalls: snap?.partnership?.balls ?? 0,
    batsmen,
    bowler,
    recentBalls: [],
    status: match.status,
    title: match.title,
    youtubeVideoId: match.youtubeVideoId ?? null,
    youtubeEnabled: Boolean(match.youtubeEnabled && match.youtubeVideoId),
    publicSlug: match.publicSlug ?? null,
    publicLiveEnabled: Boolean(match.publicLiveEnabled),
    shareUrl,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    resultType: match.resultType ?? null,
    winnerTeamId: match.resultWinnerTeamId ?? null,
    marginType: match.marginType ?? null,
    marginValue: match.marginValue ?? null,
    inningsScores: (match.innings ?? []).map((inn) => ({
      battingTeamId: inn.battingTeamId,
      runs: inn.totalRuns,
      wickets: inn.totalWickets,
      overs: inn.snapshot?.oversDisplay ?? `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`,
    })),
    customRules: live.customRules,
  };
}

export function centreFromPublic(data: PublicLiveScoreDto, shareUrl: string | null): CentreModel {
  const batting =
    data.battingTeamId === data.awayTeam.id ? data.awayTeam.name : data.homeTeam.name;
  const batsmen: CentreBatter[] = [];
  if (data.striker) {
    batsmen.push({
      id: data.striker.playerId,
      name: data.striker.name,
      runs: data.striker.runs,
      balls: data.striker.balls,
      fours: data.striker.fours,
      sixes: data.striker.sixes,
      sr: data.striker.strikeRate.toFixed(1),
      onStrike: data.striker.onStrike,
    });
  }
  if (data.nonStriker) {
    batsmen.push({
      id: data.nonStriker.playerId,
      name: data.nonStriker.name,
      runs: data.nonStriker.runs,
      balls: data.nonStriker.balls,
      fours: data.nonStriker.fours,
      sixes: data.nonStriker.sixes,
      sr: data.nonStriker.strikeRate.toFixed(1),
      onStrike: data.nonStriker.onStrike,
    });
  }
  return {
    battingTeamName: batting,
    inningsNumber: data.inningsNumber ?? 1,
    runs: data.score.runs,
    wickets: data.score.wickets,
    maxWickets: data.maxWickets,
    extras: data.score.extras ?? 0,
    overs: data.score.overs,
    oversLimit: data.oversLimit,
    crr: data.score.runRate,
    partnershipRuns: data.partnership?.runs ?? 0,
    partnershipBalls: data.partnership?.balls ?? 0,
    batsmen,
    bowler: data.bowler
      ? {
          id: data.bowler.playerId,
          name: data.bowler.name,
          overs: data.bowler.overs,
          maidens: data.bowler.maidens,
          runs: data.bowler.runs,
          wickets: data.bowler.wickets,
          eco: data.bowler.economy.toFixed(2),
          balls: 1,
        }
      : null,
    recentBalls: data.recentBalls.map((b) => ({
      sequence: b.sequence,
      overNumber: b.overNumber,
      ballInOver: b.ballInOver,
      label: b.label,
      isWicket: b.isWicket,
      runs: (b.batsmanRuns ?? 0) + (b.extraRuns ?? 0),
      strikerName: b.strikerName,
      bowlerName: b.bowlerName,
    })),
    status: data.status,
    title: data.title,
    youtubeVideoId: data.youtube.videoId,
    youtubeEnabled: data.youtube.enabled,
    publicSlug: data.publicSlug,
    publicLiveEnabled: true,
    shareUrl,
    homeTeamName: data.homeTeam.name,
    awayTeamName: data.awayTeam.name,
    homeTeamId: data.homeTeam.id,
    awayTeamId: data.awayTeam.id,
    resultType: data.result?.resultType ?? null,
    winnerTeamId: data.result?.winnerTeamId ?? null,
    marginType: data.result?.marginType ?? null,
    marginValue: data.result?.marginValue ?? null,
    inningsScores: data.result?.innings ?? [],
    customRules: data.customRules,
  };
}

export function eventsToCentreBalls(
  events: {
    sequence: number;
    overNumber: number;
    ballInOver: number;
    batsmanRuns: number;
    extraRuns: number;
    extraType: string;
    isWicket: boolean;
    strikerName?: string | null;
    bowlerName?: string | null;
  }[],
): CentreBall[] {
  return events.map((ev) => ({
    sequence: ev.sequence,
    overNumber: ev.overNumber,
    ballInOver: ev.ballInOver,
    label: centreBallLabel(ev),
    isWicket: ev.isWicket,
    runs: ev.batsmanRuns + (ev.extraRuns ?? 0),
    strikerName: ev.strikerName ?? null,
    bowlerName: ev.bowlerName ?? null,
  }));
}

function centreBallLabel(ev: {
  batsmanRuns: number;
  extraRuns: number;
  extraType: string;
  isWicket: boolean;
}): string {
  if (ev.isWicket) return 'W';
  if (ev.extraType === 'WIDE') return ev.extraRuns > 1 ? `wd+${ev.extraRuns - 1}` : 'wd';
  if (ev.extraType === 'NO_BALL') return ev.batsmanRuns ? `nb+${ev.batsmanRuns}` : 'nb';
  if (ev.extraType === 'BYE') return `b${ev.extraRuns}`;
  if (ev.extraType === 'LEG_BYE') return `lb${ev.extraRuns}`;
  if (ev.extraType === 'PENALTY') return ev.extraRuns < 0 ? `p${ev.extraRuns}` : `p+${ev.extraRuns}`;
  return String(ev.batsmanRuns);
}

function emptySnap(): InningsSnapshot {
  return {
    totalRuns: 0,
    totalWickets: 0,
    totalBallsLegal: 0,
    extras: 0,
    extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    oversDisplay: '0.0',
    currentOver: 0,
    ballsInCurrentOver: 0,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    currentRunRate: 0,
    partnership: null,
    partnerships: [],
    fallOfWickets: [],
    batters: [],
    bowlers: [],
    isComplete: false,
    freeHitNext: false,
  };
}
