import { describe, expect, it } from 'vitest';
import {
  chaseFromLive,
  chipLabel,
  classifyOverlayBurst,
  classifyOverlayBursts,
  overlayQueryString,
  overlayStatus,
  parseOverlayConfig,
  projectedScore,
  shouldAnimateSequence,
  structuredEventLabel,
  type OverlayBurst,
} from './overlay-model';
import type { PublicLiveScoreDto } from '@/types/api';

function live(partial: Partial<PublicLiveScoreDto> = {}): PublicLiveScoreDto {
  return {
    matchId: 'm1',
    publicSlug: 'alpha-raghus',
    title: 'Alpha XI vs Raghus',
    status: 'LIVE',
    venueText: null,
    tournamentName: null,
    oversLimit: 10,
    maxWickets: 7,
    ballsPerOver: 6,
    homeTeam: { id: 'h', name: 'Alpha XI', shortName: 'ALP', logoUrl: null },
    awayTeam: { id: 'a', name: 'Raghus', shortName: 'RAG', logoUrl: null },
    battingTeamId: 'h',
    bowlingTeamId: 'a',
    inningsId: 'i2',
    inningsNumber: 1,
    score: { runs: 32, wickets: 2, overs: '5.0', balls: 30, runRate: 6.4, extras: 2 },
    striker: null,
    nonStriker: null,
    bowler: null,
    partnership: null,
    recentBalls: [],
    commentary: [],
    lastBall: null,
    youtube: { enabled: false, videoId: null },
    result: {
      resultType: null,
      winnerTeamId: null,
      marginType: null,
      marginValue: null,
      innings: [{ battingTeamId: 'h', bowlingTeamId: 'a', inningsNumber: 1, runs: 32, wickets: 2, overs: '5.0' }],
    },
    ...partial,
  };
}

describe('parseOverlayConfig', () => {
  it('defaults to STANDARD with batsmen and bowler', () => {
    const c = parseOverlayConfig('');
    expect(c.mode).toBe('standard');
    expect(c.theme).toBe('dark');
    expect(c.score).toBe(true);
    expect(c.batters).toBe(true);
    expect(c.bowler).toBe(true);
    expect(c.projected).toBe(false);
    expect(c.fan).toBe(false);
    expect(c.sound).toBe(false);
  });

  it('enables full-mode extras from the query string', () => {
    const c = parseOverlayConfig('mode=full&projected=1&sound=on');
    expect(c.mode).toBe('full');
    expect(c.bowler).toBe(true);
    expect(c.partnership).toBe(true);
    expect(c.projected).toBe(true);
    expect(c.sound).toBe(true);
  });

  it('defaults to the score scene and falls back to score for an unknown scene', () => {
    expect(parseOverlayConfig('').scene).toBe('score');
    expect(parseOverlayConfig('scene=made-up').scene).toBe('score');
  });

  it('picks a valid scene from the query string', () => {
    expect(parseOverlayConfig('scene=intro').scene).toBe('intro');
    expect(parseOverlayConfig('scene=lineup').scene).toBe('lineup');
    expect(parseOverlayConfig('scene=lower-third').scene).toBe('lower-third');
    expect(parseOverlayConfig('scene=target').scene).toBe('target');
    expect(parseOverlayConfig('scene=ball-result').scene).toBe('ball-result');
  });

  it('defaults the lower-third role to striker and accepts a valid override', () => {
    expect(parseOverlayConfig('scene=lower-third').lowerThirdRole).toBe('striker');
    expect(parseOverlayConfig('scene=lower-third&role=bowler').lowerThirdRole).toBe('bowler');
    expect(parseOverlayConfig('scene=lower-third&role=nonStriker').lowerThirdRole).toBe('nonStriker');
    expect(parseOverlayConfig('scene=lower-third&role=made-up').lowerThirdRole).toBe('striker');
  });
});

describe('overlayQueryString', () => {
  it('omits scene/role when they are the defaults', () => {
    const qs = overlayQueryString(parseOverlayConfig(''));
    expect(qs).not.toContain('scene=');
    expect(qs).not.toContain('role=');
  });

  it('round-trips a non-default scene and lower-third role', () => {
    const config = parseOverlayConfig('scene=lower-third&role=bowler');
    const qs = overlayQueryString(config);
    expect(qs).toContain('scene=lower-third');
    expect(qs).toContain('role=bowler');
    expect(parseOverlayConfig(qs).scene).toBe('lower-third');
    expect(parseOverlayConfig(qs).lowerThirdRole).toBe('bowler');
  });
});

describe('overlayStatus', () => {
  it('maps real match states only', () => {
    expect(overlayStatus('LIVE')).toBe('LIVE');
    expect(overlayStatus('INNINGS_BREAK')).toBe('INNINGS_BREAK');
    expect(overlayStatus('DRINKS_BREAK')).toBe('DRINKS');
    expect(overlayStatus('RAIN_DELAY')).toBe('RAIN');
    expect(overlayStatus('MATCH_DELAY')).toBe('DELAY');
    expect(overlayStatus('COMPLETED')).toBe('COMPLETE');
    expect(overlayStatus('SCHEDULED')).toBe('UPCOMING');
    expect(overlayStatus('ABANDONED')).toBe('ABANDONED');
    expect(overlayStatus('CANCELLED')).toBe('CANCELLED');
  });
});

describe('chaseFromLive', () => {
  it('hides target in the first innings', () => {
    expect(chaseFromLive(live({ inningsNumber: 1 }))).toBeNull();
  });

  it('computes target, needed runs and RRR from first-innings score', () => {
    const chase = chaseFromLive(
      live({
        inningsNumber: 2,
        battingTeamId: 'a',
        score: { runs: 72, wickets: 3, overs: '7.4', balls: 46, runRate: 9.39, extras: 0 },
        result: {
          resultType: null,
          winnerTeamId: null,
          marginType: null,
          marginValue: null,
          innings: [{ battingTeamId: 'h', bowlingTeamId: 'a', inningsNumber: 1, runs: 100, wickets: 5, overs: '10.0' }],
        },
      }),
    );
    expect(chase).toEqual({ target: 101, needed: 29, ballsLeft: 14, rrr: expect.closeTo(12.428, 2) });
  });
});

describe('projectedScore', () => {
  it('projects first-innings total from current scoring rate', () => {
    expect(projectedScore(live({ score: { runs: 32, wickets: 2, overs: '5.0', balls: 30, runRate: 6.4, extras: 0 } }))).toBe(64);
  });

  it('hides projection without balls or in the chase', () => {
    expect(projectedScore(live({ score: { runs: 0, wickets: 0, overs: '0.0', balls: 0, runRate: 0, extras: 0 } }))).toBeNull();
    expect(projectedScore(live({ inningsNumber: 2 }))).toBeNull();
  });
});

describe('chip and event labels', () => {
  it('centralizes extra chips without inventing commentary', () => {
    const wide = { sequence: 1, overNumber: 0, ballInOver: 1, label: 'wd', flash: 'WD', commentary: null, isWicket: false, extraType: 'WIDE' as const, batsmanRuns: 0, extraRuns: 1 };
    expect(chipLabel(wide)).toBe('WD');
    expect(structuredEventLabel(wide)).toBe('WD');
    expect(structuredEventLabel({ ...wide, commentary: 'Wide down leg' })).toBe('Wide down leg');
  });
});

describe('classifyOverlayBurst', () => {
  const ball = (seq: number, extra: Partial<PublicLiveScoreDto['lastBall']> = {}) => ({
    sequence: seq,
    overNumber: 4,
    ballInOver: 6,
    label: '4',
    flash: 'FOUR',
    commentary: null,
    isWicket: false,
    extraType: 'NONE' as const,
    batsmanRuns: 4,
    extraRuns: 0,
    ...extra,
  });

  it('does not animate the first snapshot or a reconnect of the same ball', () => {
    const next = live({ lastBall: ball(12) });
    expect(classifyOverlayBurst(null, next)).toBeNull();
    expect(classifyOverlayBurst(next, next)).toBeNull();
  });

  it('emits FOUR / SIX / WICKET only for a newer sequence', () => {
    const prev = live({ lastBall: ball(11, { batsmanRuns: 1, label: '1', flash: '1' }) });
    expect(classifyOverlayBurst(prev, live({ lastBall: ball(12) }))).toEqual({ kind: 'FOUR', key: 'i2-12' });
    expect(classifyOverlayBurst(prev, live({ lastBall: ball(12, { batsmanRuns: 6, label: '6', flash: 'SIX' }) }))).toEqual({
      kind: 'SIX',
      key: 'i2-12',
    });
    const wicket = classifyOverlayBurst(
      prev,
      live({ lastBall: ball(12, { isWicket: true, label: 'W', flash: 'W', strikerName: 'Bhavin', dismissalType: 'BOWLED' }) }),
    ) as OverlayBurst;
    expect(wicket).toMatchObject({ kind: 'WICKET', name: 'Bhavin', detail: 'BOWLED' });
  });

  it('emits FOUR before TEAM 50 when a boundary crosses the mark', () => {
    const prev = live({ score: { runs: 48, wickets: 2, overs: '4.5', balls: 29, runRate: 9.9, extras: 0 }, lastBall: ball(10, { batsmanRuns: 1 }) });
    const bursts = classifyOverlayBursts(
      prev,
      live({
        score: { runs: 52, wickets: 2, overs: '5.0', balls: 30, runRate: 10.4, extras: 0 },
        lastBall: ball(11, { batsmanRuns: 4 }),
      }),
    );
    expect(bursts[0]?.kind).toBe('FOUR');
    expect(bursts.some((b) => b.kind === 'MILESTONE' && b.kind === 'MILESTONE' && 'runs' in b && b.runs === 50)).toBe(true);
  });

  it('emits TEAM 50 when a normal scoring ball crosses the mark', () => {
    const prev = live({
      score: { runs: 49, wickets: 2, overs: '4.5', balls: 29, runRate: 10.1, extras: 0 },
      lastBall: ball(10, { batsmanRuns: 1, label: '1', flash: '1' }),
    });
    const burst = classifyOverlayBurst(
      prev,
      live({
        score: { runs: 51, wickets: 2, overs: '5.0', balls: 30, runRate: 10.2, extras: 0 },
        lastBall: ball(11, { batsmanRuns: 2, label: '2', flash: '2' }),
      }),
    );
    expect(burst).toMatchObject({ kind: 'MILESTONE', runs: 50, team: 'Alpha XI' });
  });

  it('emits a player 50 once when the striker crosses the mark', () => {
    const batter = (runs: number) => ({
      playerId: 's',
      name: 'Sudhir',
      runs,
      balls: 31,
      fours: 4,
      sixes: 2,
      strikeRate: 161,
      onStrike: true,
    });
    const prev = live({
      striker: batter(48),
      lastBall: ball(20, { batsmanRuns: 1, label: '1', flash: '1' }),
    });
    const bursts = classifyOverlayBursts(
      prev,
      live({
        striker: batter(52),
        lastBall: ball(21, { batsmanRuns: 4, strikerName: 'Sudhir' }),
      }),
    );
    expect(bursts.some((b) => b.kind === 'PLAYER' && b.runs === 50 && b.name === 'Sudhir')).toBe(true);
  });
});

describe('shouldAnimateSequence', () => {
  it('requires a previously seen sequence so refresh does not replay', () => {
    expect(shouldAnimateSequence(null, 9)).toBe(false);
    expect(shouldAnimateSequence(9, 9)).toBe(false);
    expect(shouldAnimateSequence(9, 10)).toBe(true);
  });
});
