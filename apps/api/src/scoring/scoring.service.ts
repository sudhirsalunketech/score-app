import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ExtraType, InningsStatus, MatchFormat, MatchMarginType, MatchResultType, MatchStatus, Prisma } from '@prisma/client';
import { LIVE_SOCKET, computeBoundaryStreakSequences, computeHattrickSequences, computeMatchMvp, computeMatchResult, computeSuperOverResult, computeTestMatchResult, deliveryBlockedMessage, matchReplayOptions, mvpConfigFromSnapshot, mvpInputsFromInnings, parseRuleSnapshot, recalcBallPositions, replayInnings, sanitizeStreakLength, type InningsSnapshot, type ScoringEvent } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppError, Errors } from '../common/app-error';
import { matchInclude } from '../domain/includes';
import { assertTransition } from '../domain/lifecycle';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PublicLiveService } from '../public-live/public-live.service';
import { StatsPersistenceService } from '../statistics/stats-persistence.service';
import { TournamentRulesService } from '../tournaments/rules.service';
import { OverRulesService, type OverRuleAppliedEvent } from '../matches/over-rules.service';
import { FanService } from '../fan/fan.service';
import { KnockoutService } from '../tournaments/knockout.service';
import { NotificationsService } from '../notifications/notifications.service';
import { deliveryPersonnelError } from './delivery-personnel';
import type { AuthUser } from '../common/auth.guard';
import { z } from 'zod';

export const deliverySchema = z.object({
  idempotencyKey: z.string().min(8),
  strikerId: z.string(),
  nonStrikerId: z.string(),
  bowlerId: z.string(),
  batsmanRuns: z.number().int().min(0).max(13),
  extraType: z.enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']).optional(),
  extraRuns: z.number().int().min(-13).max(13).optional(),
  penaltyReason: z.enum(['TOURNAMENT_PENALTY', 'SLOW_OVER_RATE', 'MISCONDUCT', 'ILLEGAL_EQUIPMENT', 'OTHER']).optional(),
  isWicket: z.boolean().optional(),
  dismissalType: z
    .enum([
      'BOWLED',
      'CAUGHT',
      'LBW',
      'RUN_OUT',
      'STUMPED',
      'HIT_WICKET',
      'MANKAD',
      'OVER_THE_FENCE',
      'ONE_HAND_ONE_BOUNCE',
      'OBSTRUCTING',
      'HIT_BALL_TWICE',
      'TIMED_OUT',
      'RETIRED_HURT',
      'RETIRED_OUT',
    ])
    .optional(),
  dismissedPlayerId: z.string().optional(),
  fielderId: z.string().optional(),
}).refine((v) => v.extraType !== 'PENALTY' || v.penaltyReason != null, {
  message: 'A reason is required for penalty runs.',
  path: ['penaltyReason'],
});

const dismissalTypeSchema = z.enum([
  'BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'MANKAD', 'OVER_THE_FENCE',
  'ONE_HAND_ONE_BOUNCE', 'OBSTRUCTING', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_HURT', 'RETIRED_OUT',
]);

/** Fields an admin can correct on an existing ball. All optional except `reason` — only changed fields need to be sent. */
export const correctionSchema = z
  .object({
    strikerId: z.string().optional(),
    nonStrikerId: z.string().optional(),
    bowlerId: z.string().optional(),
    batsmanRuns: z.number().int().min(0).max(13).optional(),
    extraType: z.enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']).optional(),
    extraRuns: z.number().int().min(-13).max(13).optional(),
    penaltyReason: z.enum(['TOURNAMENT_PENALTY', 'SLOW_OVER_RATE', 'MISCONDUCT', 'ILLEGAL_EQUIPMENT', 'OTHER']).optional(),
    isWicket: z.boolean().optional(),
    dismissalType: dismissalTypeSchema.nullable().optional(),
    dismissedPlayerId: z.string().nullable().optional(),
    fielderId: z.string().nullable().optional(),
    reason: z.string().trim().min(3, 'A correction reason is required.'),
  })
  .refine((v) => !v.isWicket || v.dismissalType != null, {
    message: 'Dismissal type required for a wicket.',
    path: ['dismissalType'],
  });

export const insertBallSchema = z.object({
  afterEventId: z.string().nullable(),
  strikerId: z.string(),
  nonStrikerId: z.string(),
  bowlerId: z.string(),
  batsmanRuns: z.number().int().min(0).max(13),
  extraType: z.enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']).optional(),
  extraRuns: z.number().int().min(-13).max(13).optional(),
  penaltyReason: z.enum(['TOURNAMENT_PENALTY', 'SLOW_OVER_RATE', 'MISCONDUCT', 'ILLEGAL_EQUIPMENT', 'OTHER']).optional(),
  isWicket: z.boolean().optional(),
  dismissalType: dismissalTypeSchema.optional(),
  dismissedPlayerId: z.string().optional(),
  fielderId: z.string().optional(),
  reason: z.string().trim().min(3, 'A correction reason is required.'),
});

export const deleteBallSchema = z.object({
  reason: z.string().trim().min(3, 'A correction reason is required.'),
});

function toScoringEvents(rows: { sequence: number; overNumber: number; ballInOver: number; strikerId: string; nonStrikerId: string; bowlerId: string; batsmanRuns: number; extraRuns: number; extraType: ExtraType; isWicket: boolean; dismissalType: ScoringEvent['dismissalType']; dismissedPlayerId: string | null; isUndone: boolean }[]): ScoringEvent[] {
  return rows.map((e) => ({
    sequence: e.sequence,
    overNumber: e.overNumber,
    ballInOver: e.ballInOver,
    strikerId: e.strikerId,
    nonStrikerId: e.nonStrikerId,
    bowlerId: e.bowlerId,
    batsmanRuns: e.batsmanRuns,
    extraRuns: e.extraRuns,
    extraType: e.extraType,
    isWicket: e.isWicket,
    dismissalType: e.dismissalType,
    dismissedPlayerId: e.dismissedPlayerId,
    isUndone: e.isUndone,
  }));
}

@Injectable()
export class ScoringService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
    @Inject(PublicLiveService) private readonly publicLive: PublicLiveService,
    @Inject(StatsPersistenceService) private readonly stats: StatsPersistenceService,
    @Inject(TournamentRulesService) private readonly rules: TournamentRulesService,
    @Inject(OverRulesService) private readonly overRules: OverRulesService,
    @Inject(FanService) private readonly fan: FanService,
    @Inject(KnockoutService) private readonly knockout: KnockoutService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  replayOptions(
    match: { ballsPerOver: number; overs: number; maxWickets: number; settings: Prisma.JsonValue | null },
    innings: { targetRuns?: number | null; oversLimit?: number | null; maxWicketsLimit?: number | null },
  ) {
    return matchReplayOptions(match, innings.targetRuns, innings);
  }

  async snapshotForInnings(inningsId: string): Promise<{ snapshot: InningsSnapshot; innings: Prisma.InningsGetPayload<{ include: { match: true; events: true } }> }> {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: { match: true, events: { orderBy: { sequence: 'asc' } } },
    });
    if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
    const snapshot = replayInnings(toScoringEvents(innings.events), this.replayOptions(innings.match, innings));
    return { snapshot, innings };
  }

  async persistProjection(tx: Prisma.TransactionClient, inningsId: string, snapshot: InningsSnapshot) {
    await tx.innings.update({
      where: { id: inningsId },
      data: {
        totalRuns: snapshot.totalRuns,
        totalWickets: snapshot.totalWickets,
        totalBallsLegal: snapshot.totalBallsLegal,
        extras: snapshot.extras,
        extrasWides: snapshot.extrasBreakdown.wides,
        extrasNoBalls: snapshot.extrasBreakdown.noBalls,
        extrasByes: snapshot.extrasBreakdown.byes,
        extrasLegByes: snapshot.extrasBreakdown.legByes,
        extrasPenalty: snapshot.extrasBreakdown.penalty,
        status: snapshot.isComplete ? InningsStatus.COMPLETED : InningsStatus.IN_PROGRESS,
      },
    });
    await tx.fallOfWicket.deleteMany({ where: { inningsId } });
    if (snapshot.fallOfWickets.length) {
      await tx.fallOfWicket.createMany({
        data: snapshot.fallOfWickets.map((f) => ({
          inningsId,
          wicketNumber: f.wicketNumber,
          score: f.score,
          overs: f.overs,
          playerId: f.playerId,
          dismissalType: f.dismissalType ?? null,
        })),
      });
    }
    await tx.partnership.deleteMany({ where: { inningsId } });
    if (snapshot.partnership) {
      await tx.partnership.create({
        data: {
          inningsId,
          batterAId: snapshot.partnership.batterIds[0],
          batterBId: snapshot.partnership.batterIds[1],
          runs: snapshot.partnership.runs,
          balls: snapshot.partnership.balls,
        },
      });
    }
  }

  /**
   * Called once an innings' replay snapshot reports `isComplete`. Decides what completing this
   * particular innings means for the match: move to INNINGS_BREAK, hold at SUPER_OVER_PENDING on a
   * tie (see §3/§4 of the Super Over spec — points/result are never awarded until the tie is
   * resolved), or finalize the match outright.
   */
  private async finalizeInningsCompletion(
    tx: Prisma.TransactionClient,
    innings: {
      id: string;
      matchId: string;
      inningsNumber: number;
      battingTeamId: string;
      bowlingTeamId: string;
      isSuperOver: boolean;
      superOverNumber: number | null;
      oversLimit: number | null;
      maxWicketsLimit: number | null;
      match: { homeTeamId: string; awayTeamId: string; maxWickets: number; status: MatchStatus; format: MatchFormat };
    },
    snapshot: InningsSnapshot,
  ) {
    if (innings.isSuperOver) {
      await this.finalizeSuperOverInnings(tx, innings, snapshot);
      return;
    }
    if (innings.match.format === MatchFormat.TEST) {
      await this.finalizeTestInningsCompletion(tx, innings, snapshot);
      return;
    }
    const inningsId = innings.id;
    const allInns = await tx.innings.findMany({ where: { matchId: innings.matchId, isSuperOver: false } });
    if (allInns.length < 2) {
      assertTransition(innings.match.status, MatchStatus.INNINGS_BREAK);
      await tx.match.update({ where: { id: innings.matchId }, data: { status: MatchStatus.INNINGS_BREAK } });
      return;
    }
    const resultInns = await this.rules.resultInnings(
      tx,
      innings.matchId,
      allInns.map((i) => ({
        id: i.id,
        inningsNumber: i.inningsNumber,
        battingTeamId: i.battingTeamId,
        totalRuns: i.id === inningsId ? snapshot.totalRuns : i.totalRuns,
        totalWickets: i.id === inningsId ? snapshot.totalWickets : i.totalWickets,
        status: i.id === inningsId ? InningsStatus.COMPLETED : i.status,
      })),
    );
    const computed = computeMatchResult({
      homeTeamId: innings.match.homeTeamId,
      awayTeamId: innings.match.awayTeamId,
      maxWickets: innings.match.maxWickets,
      innings: resultInns,
    });
    if (computed.resultType === 'TIE') {
      assertTransition(innings.match.status, MatchStatus.SUPER_OVER_PENDING);
      await tx.match.update({ where: { id: innings.matchId }, data: { status: MatchStatus.SUPER_OVER_PENDING } });
      await tx.auditLog.create({ data: { action: 'MATCH_TIED', entity: 'Match', entityId: innings.matchId, meta: {} } });
      return;
    }
    assertTransition(innings.match.status, computed.status);
    await tx.match.update({
      where: { id: innings.matchId },
      data: {
        status: computed.status,
        resultType: computed.resultType,
        resultWinnerTeamId: computed.winnerTeamId,
        marginType: computed.marginType,
        marginValue: computed.marginValue,
        completedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        action: 'MATCH_COMPLETED',
        entity: 'Match',
        entityId: innings.matchId,
        meta: {
          resultType: computed.resultType,
          winnerTeamId: computed.winnerTeamId,
          marginType: computed.marginType,
          marginValue: computed.marginValue,
        },
      },
    });
    await this.stats.persist(tx, innings.matchId);
    await this.stats.persistStandings(tx, innings.matchId);
  }

  /**
   * A Test match runs to up to 4 innings (fewer on an innings victory), in whatever chronological
   * order follow-on produced — `computeTestMatchResult` only needs each terminal innings' team and
   * total, not an assumption about which side batted 1st/2nd/3rd/4th. When it isn't decided yet,
   * the match moves to INNINGS_BREAK so the scorer can act on the next step (start the next
   * innings, or decide a pending follow-on) — the same "pause and wait" state limited-overs uses
   * between innings 1 and 2.
   */
  private async finalizeTestInningsCompletion(
    tx: Prisma.TransactionClient,
    innings: {
      id: string;
      matchId: string;
      match: { homeTeamId: string; awayTeamId: string; maxWickets: number; status: MatchStatus };
    },
    snapshot: InningsSnapshot,
  ) {
    const allInns = await tx.innings.findMany({ where: { matchId: innings.matchId }, orderBy: { inningsNumber: 'asc' } });
    const computed = computeTestMatchResult({
      homeTeamId: innings.match.homeTeamId,
      awayTeamId: innings.match.awayTeamId,
      maxWickets: innings.match.maxWickets,
      innings: allInns.map((i) => ({
        inningsNumber: i.inningsNumber,
        battingTeamId: i.battingTeamId,
        totalRuns: i.id === innings.id ? snapshot.totalRuns : i.totalRuns,
        totalWickets: i.id === innings.id ? snapshot.totalWickets : i.totalWickets,
        status: i.status,
      })),
    });
    if (computed.resultType === 'NO_RESULT') {
      assertTransition(innings.match.status, MatchStatus.INNINGS_BREAK);
      await tx.match.update({ where: { id: innings.matchId }, data: { status: MatchStatus.INNINGS_BREAK } });
      return;
    }
    assertTransition(innings.match.status, computed.status);
    await tx.match.update({
      where: { id: innings.matchId },
      data: {
        status: computed.status,
        resultType: computed.resultType,
        resultWinnerTeamId: computed.winnerTeamId,
        marginType: computed.marginType,
        marginValue: computed.marginValue,
        completedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        action: 'MATCH_COMPLETED',
        entity: 'Match',
        entityId: innings.matchId,
        meta: {
          resultType: computed.resultType,
          winnerTeamId: computed.winnerTeamId,
          marginType: computed.marginType,
          marginValue: computed.marginValue,
        },
      },
    });
    await this.stats.persist(tx, innings.matchId);
    await this.stats.persistStandings(tx, innings.matchId);
  }

  /**
   * A Super Over pair is two innings sharing `superOverNumber`. The first to complete just sets up
   * the second (target = its total + 1), same shape as the normal first/second innings handoff. The
   * second completing decides the pair: a winner ends the match, another tie holds at
   * SUPER_OVER_PENDING so the scorer can start yet another Super Over (never silently pick a winner).
   */
  private async finalizeSuperOverInnings(
    tx: Prisma.TransactionClient,
    innings: {
      id: string;
      matchId: string;
      inningsNumber: number;
      battingTeamId: string;
      bowlingTeamId: string;
      superOverNumber: number | null;
      oversLimit: number | null;
      maxWicketsLimit: number | null;
      match: { status: MatchStatus };
    },
    snapshot: InningsSnapshot,
  ) {
    const pairNumber = innings.superOverNumber;
    const partner = await tx.innings.findFirst({
      where: { matchId: innings.matchId, isSuperOver: true, superOverNumber: pairNumber, NOT: { id: innings.id } },
    });
    if (!partner) {
      await tx.innings.create({
        data: {
          matchId: innings.matchId,
          inningsNumber: innings.inningsNumber + 1,
          battingTeamId: innings.bowlingTeamId,
          bowlingTeamId: innings.battingTeamId,
          isSuperOver: true,
          superOverNumber: pairNumber,
          oversLimit: innings.oversLimit,
          maxWicketsLimit: innings.maxWicketsLimit,
          targetRuns: snapshot.totalRuns + 1,
        },
      });
      return;
    }
    const soResult = computeSuperOverResult({
      innings: [
        { battingTeamId: partner.battingTeamId, totalRuns: partner.totalRuns },
        { battingTeamId: innings.battingTeamId, totalRuns: snapshot.totalRuns },
      ],
    });
    if (soResult.resultType === 'TIE') {
      assertTransition(innings.match.status, MatchStatus.SUPER_OVER_PENDING);
      await tx.match.update({ where: { id: innings.matchId }, data: { status: MatchStatus.SUPER_OVER_PENDING } });
      await tx.auditLog.create({
        data: { action: 'SUPER_OVER_TIED', entity: 'Match', entityId: innings.matchId, meta: { superOverNumber: pairNumber } },
      });
      return;
    }
    assertTransition(innings.match.status, MatchStatus.COMPLETED);
    await tx.match.update({
      where: { id: innings.matchId },
      data: {
        status: MatchStatus.COMPLETED,
        resultType: 'WIN',
        resultWinnerTeamId: soResult.winnerTeamId,
        marginType: soResult.marginType,
        marginValue: soResult.marginValue,
        completedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        action: 'MATCH_COMPLETED',
        entity: 'Match',
        entityId: innings.matchId,
        meta: { resultType: 'WIN', winnerTeamId: soResult.winnerTeamId, viaSuperOver: pairNumber },
      },
    });
    await this.stats.persist(tx, innings.matchId);
    await this.stats.persistStandings(tx, innings.matchId);
  }

  async applyEvent(inningsId: string, body: unknown) {
    const input = deliverySchema.parse(body);
    if (input.strikerId === input.nonStrikerId) throw Errors.invalidDelivery('Striker and non-striker must differ');
    if (input.isWicket && !input.dismissalType) throw Errors.invalidWicket('Dismissal type required');

    let result: {
      event: {
        matchId: string;
        id: string;
        batsmanRuns: number;
        extraRuns: number;
        isWicket: boolean;
        strikerId: string;
        bowlerId: string;
        dismissedPlayerId: string | null;
        overNumber: number;
        ballInOver: number;
        extraType: ExtraType;
      };
      snapshot: InningsSnapshot;
      duplicate: boolean;
      overRuleEvents: OverRuleAppliedEvent[];
    };
    try {
    result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Innings" WHERE id = ${inningsId} FOR UPDATE`);
      const innings = await tx.innings.findUnique({
        where: { id: inningsId },
        include: { match: true, events: { orderBy: { sequence: 'asc' } } },
      });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      const replayOpts = this.replayOptions(innings.match, innings);
      if (innings.match.status !== MatchStatus.LIVE && innings.match.status !== MatchStatus.SUPER_OVER) {
        if (
          innings.match.status === MatchStatus.COMPLETED ||
          innings.match.status === MatchStatus.ABANDONED ||
          innings.match.status === MatchStatus.CANCELLED
        ) {
          throw Errors.invalidState('This match is already complete. No additional balls can be added.');
        }
        if (innings.match.status === MatchStatus.INNINGS_BREAK || innings.match.status === MatchStatus.SUPER_OVER_PENDING) {
          throw Errors.invalidState('This innings is already complete. No additional balls can be added.');
        }
        if (
          innings.match.status === MatchStatus.DRINKS_BREAK ||
          innings.match.status === MatchStatus.RAIN_DELAY ||
          innings.match.status === MatchStatus.MATCH_DELAY
        ) {
          throw Errors.invalidState('Match is paused. Resume play before scoring.');
        }
        throw Errors.invalidState('Match is not live');
      }
      const [batRows, bowlRows] = await Promise.all([
        tx.teamPlayer.findMany({ where: { teamId: innings.battingTeamId }, select: { playerId: true } }),
        tx.teamPlayer.findMany({ where: { teamId: innings.bowlingTeamId }, select: { playerId: true } }),
      ]);
      const personnel = deliveryPersonnelError({
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        bowlerId: input.bowlerId,
        battingPlayerIds: batRows.map((row) => row.playerId),
        bowlingPlayerIds: bowlRows.map((row) => row.playerId),
      });
      if (personnel) throw Errors.invalidDelivery(personnel);

      if (innings.status === InningsStatus.COMPLETED) {
        const doneSnap = replayInnings(toScoringEvents(innings.events), replayOpts);
        throw Errors.invalidState(
          deliveryBlockedMessage({ ...doneSnap, isComplete: true }, replayOpts, {
            isWicket: Boolean(input.isWicket),
            dismissalType: input.dismissalType ?? null,
          }) ?? 'This innings is already complete. No additional balls can be added.',
        );
      }

      const dup = await tx.ballEvent.findUnique({
        where: { inningsId_idempotencyKey: { inningsId, idempotencyKey: input.idempotencyKey } },
      });
      if (dup) return { event: dup, snapshot: replayInnings(toScoringEvents(innings.events), replayOpts), duplicate: true, overRuleEvents: [] };

      const extraType = (input.extraType ?? 'NONE') as ExtraType;
      const extraRuns = input.extraRuns ?? (extraType === 'WIDE' || extraType === 'NO_BALL' ? 1 : extraType === 'NONE' ? 0 : 0);
      const sequence = (innings.events.reduce((max, e) => Math.max(max, e.sequence), 0) || 0) + 1;
      const currentSnap = replayInnings(toScoringEvents(innings.events), replayOpts);
      const blocked = deliveryBlockedMessage(currentSnap, replayOpts, {
        isWicket: Boolean(input.isWicket),
        dismissalType: input.dismissalType ?? null,
      });
      if (blocked) throw Errors.invalidState(blocked);
      const overNumber = currentSnap.currentOver;
      const ballInOver = currentSnap.ballsInCurrentOver;

      if (ballInOver === 0 && overNumber > 0) {
        const previousOverBowlerId = [...innings.events]
          .reverse()
          .find((e) => !e.isUndone && e.overNumber === overNumber - 1)?.bowlerId;
        if (previousOverBowlerId && previousOverBowlerId === input.bowlerId) {
          throw Errors.invalidDelivery('The same bowler cannot bowl consecutive overs. Choose a different bowler.');
        }
      }

      const event = await tx.ballEvent.create({
        data: {
          inningsId,
          matchId: innings.matchId,
          sequence,
          idempotencyKey: input.idempotencyKey,
          overNumber,
          ballInOver,
          strikerId: input.strikerId,
          nonStrikerId: input.nonStrikerId,
          bowlerId: input.bowlerId,
          batsmanRuns: input.batsmanRuns,
          extraRuns,
          totalRuns: input.batsmanRuns + extraRuns,
          extraType,
          isWicket: Boolean(input.isWicket),
          dismissalType: input.dismissalType ?? null,
          dismissedPlayerId: input.dismissedPlayerId ?? (input.isWicket ? input.strikerId : null),
          fielderId: input.fielderId ?? null,
          penaltyReason: extraType === 'PENALTY' ? input.penaltyReason ?? null : null,
          commentary: this.commentary(input.batsmanRuns, extraType, extraRuns, Boolean(input.isWicket), input.dismissalType),
        },
      });

      let events = [...innings.events, event];

      {
        const settings = (innings.match.settings ?? {}) as Record<string, unknown>;
        const ruleSnap = await tx.matchRuleSnapshot.findUnique({ where: { matchId: innings.matchId } });
        const ruleSnapshot = this.rules.engineSnapshot(ruleSnap);
        const tournamentRules = ruleSnapshot?.rules.filter((r) => r.enabled) ?? [];
        const autoExtras: Array<{ runs: number; commentary: string; key: string }> = [];

        if (event.isWicket) {
          const ballLog = events.map((e) => ({
            sequence: e.sequence,
            overNumber: e.overNumber,
            ballInOver: e.ballInOver,
            actualRuns: e.totalRuns,
            extraType: e.extraType,
            isWicket: e.isWicket,
            bowlerId: e.bowlerId,
            isAutoGenerated: e.isAutoGenerated,
          }));

          if (settings.hattrickBattingBonus || settings.hattrickWicketPenalty) {
            const hattrickHits = computeHattrickSequences(ballLog);
            if (hattrickHits.has(event.sequence)) {
              if (settings.hattrickBattingBonus) {
                const runs = Math.max(1, Math.min(13, Math.trunc(Number(settings.hattrickBattingBonusRuns)) || 1));
                autoExtras.push({ runs, commentary: `Hattrick Bonus +${runs}`, key: 'hattrick-bonus' });
              }
              if (settings.hattrickWicketPenalty) {
                const runs = Math.max(1, Math.min(13, Math.trunc(Number(settings.hattrickWicketPenaltyRuns)) || 1));
                autoExtras.push({ runs: -runs, commentary: `Hattrick Penalty -${runs}`, key: 'hattrick-penalty' });
              }
            }
          }

          // Each tournament-rule HATTRICK row carries its own configured streak length, so the hit-set
          // is recomputed per rule rather than shared — two rules can require a different run of wickets.
          for (const rule of tournamentRules.filter((r) => r.condition === 'HATTRICK')) {
            const runs = Math.abs(Math.trunc(Number(rule.actionConfig.runs ?? 0))) || 0;
            if (runs === 0) continue;
            const streakLength = sanitizeStreakLength(rule.conditionConfig.streakLength);
            if (!computeHattrickSequences(ballLog, streakLength).has(event.sequence)) continue;
            const isPenalty = rule.action === 'SUBTRACT_RUNS' || rule.action === 'WICKET_PENALTY' || rule.action === 'SUBTRACT_PENALTY';
            autoExtras.push(
              isPenalty
                ? { runs: -runs, commentary: `Hattrick Penalty -${runs}`, key: `rule-${rule.id}` }
                : { runs, commentary: `Hattrick Bonus +${runs}`, key: `rule-${rule.id}` },
            );
          }
        }

        if (event.extraType === ExtraType.NONE && (event.batsmanRuns === 4 || event.batsmanRuns === 6)) {
          if (event.batsmanRuns === 6) {
            for (const rule of tournamentRules.filter((r) => r.condition === 'SIX' && r.action === 'ADD_RUNS')) {
              const runs = Math.abs(Math.trunc(Number(rule.actionConfig.runs ?? 0))) || 0;
              if (runs > 0) autoExtras.push({ runs, commentary: `Six Bonus +${runs}`, key: `rule-${rule.id}` });
            }
          }

          const boundaryBallLog = events.map((e) => ({
            sequence: e.sequence,
            overNumber: e.overNumber,
            ballInOver: e.ballInOver,
            actualRuns: e.batsmanRuns,
            extraType: e.extraType,
            isWicket: e.isWicket,
            isAutoGenerated: e.isAutoGenerated,
          }));

          // Each BOUNDARY_STREAK rule carries its own streak length and, when split into a fours-only
          // or sixes-only bonus, a boundaryRunValue — so the hit-set is recomputed per rule. A rule with
          // no boundaryRunValue is the legacy combined "4s or 6s" behavior.
          for (const rule of tournamentRules.filter((r) => r.condition === 'BOUNDARY_STREAK')) {
            const runs = Math.abs(Math.trunc(Number(rule.actionConfig.runs ?? 0))) || 0;
            if (runs === 0) continue;
            const streakLength = sanitizeStreakLength(rule.conditionConfig.streakLength);
            const runValue = rule.conditionConfig.boundaryRunValue as 4 | 6 | undefined;
            if (!computeBoundaryStreakSequences(boundaryBallLog, { streakLength, runValue }).has(event.sequence)) continue;
            const isPenalty = rule.action === 'SUBTRACT_RUNS' || rule.action === 'WICKET_PENALTY' || rule.action === 'SUBTRACT_PENALTY';
            autoExtras.push(
              isPenalty
                ? { runs: -runs, commentary: `Boundary Hattrick Penalty -${runs}`, key: `rule-${rule.id}` }
                : { runs, commentary: `Boundary Hattrick Bonus +${runs}`, key: `rule-${rule.id}` },
            );
          }
        }

        if (autoExtras.length) {
          for (const extra of autoExtras) {
            const snapBefore = replayInnings(toScoringEvents(events), replayOpts);
            const extraEvent = await tx.ballEvent.create({
              data: {
                inningsId,
                matchId: innings.matchId,
                sequence: (events.reduce((max, e) => Math.max(max, e.sequence), 0) || 0) + 1,
                idempotencyKey: `${input.idempotencyKey}-${extra.key}`,
                overNumber: snapBefore.currentOver,
                ballInOver: snapBefore.ballsInCurrentOver,
                strikerId: event.strikerId,
                nonStrikerId: event.nonStrikerId,
                bowlerId: event.bowlerId,
                batsmanRuns: 0,
                extraRuns: extra.runs,
                totalRuns: extra.runs,
                extraType: ExtraType.PENALTY,
                isWicket: false,
                penaltyReason: 'OTHER',
                commentary: extra.commentary,
                isAutoGenerated: true,
              },
            });
            events = [...events, extraEvent];
          }
        }
      }

      const overRuleEvents = await this.overRules.evaluateOverCompletion(tx, innings.match, inningsId, events);
      if (innings.match.overWiseRulesEnabled) {
        events = await tx.ballEvent.findMany({ where: { inningsId }, orderBy: { sequence: 'asc' } });
      }

      const snapshot = replayInnings(toScoringEvents(events), this.replayOptions(innings.match, innings));
      await this.persistProjection(tx, inningsId, snapshot);
      await this.rules.evaluateInnings(tx, innings.matchId, inningsId);

      if (snapshot.isComplete) {
        await this.finalizeInningsCompletion(tx, innings, snapshot);
      }

      await tx.auditLog.create({
        data: { action: 'DELIVERY', entity: 'BallEvent', entityId: event.id, meta: { inningsId, sequence } },
      });

      return { event, snapshot, duplicate: false, overRuleEvents };
    });

    const dto = await this.publicLive.compose(result.event.matchId);
    this.realtime.emitMatch(result.event.matchId, LIVE_SOCKET.deliveryCreated, dto);
    this.realtime.emitMatch(result.event.matchId, LIVE_SOCKET.scoreUpdated, dto);
    for (const applied of result.overRuleEvents) {
      this.realtime.emitMatch(result.event.matchId, LIVE_SOCKET.overRuleApplied, { inningsId, ...applied });
    }
    if (result.snapshot.isComplete) {
      this.realtime.emitMatch(result.event.matchId, LIVE_SOCKET.inningsCompleted, dto);
      if (dto.status === 'COMPLETED') {
        this.realtime.emitMatch(result.event.matchId, LIVE_SOCKET.matchCompleted, dto);
        await this.knockout.advanceAfterResult(result.event.matchId);
        const recipients = await this.notifications.recipientsForMatch(result.event.matchId);
        void this.notifications.notify({
          userIds: recipients,
          type: 'MATCH_RESULT',
          title: 'Match completed',
          body: 'A match you follow has been completed.',
          link: `/matches/${result.event.matchId}/centre`,
          meta: { matchId: result.event.matchId },
        });
      }
    }
    void this.fan
      .onScoringEvent(result.event.matchId, {
        batsmanRuns: result.event.batsmanRuns,
        extraRuns: result.event.extraRuns,
        isWicket: result.event.isWicket,
        strikerId: result.event.strikerId,
        bowlerId: result.event.bowlerId,
        dismissedPlayerId: result.event.dismissedPlayerId,
        overNumber: result.event.overNumber,
        ballInOver: result.event.ballInOver,
        duplicate: result.duplicate,
        matchCompleted: dto.status === 'COMPLETED',
        totalRuns: result.snapshot.totalRuns,
        totalWickets: result.snapshot.totalWickets,
        oversComplete: result.snapshot.ballsInCurrentOver === 0 && result.event.extraType === ExtraType.NONE,
      })
      .catch(() => undefined);
    return result;
    } catch (err) {
      if (err instanceof AppError || err instanceof z.ZodError) throw err;
      throw Errors.unavailable();
    }
  }

  async declareComplete(inningsId: string, opts: { asDeclaration?: boolean } = {}) {
    const result = await this.prisma.$transaction(async (tx) => {
      const innings = await tx.innings.findUnique({
        where: { id: inningsId },
        include: { match: true, events: { orderBy: { sequence: 'asc' } } },
      });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      if (innings.status === InningsStatus.COMPLETED || innings.status === InningsStatus.DECLARED) {
        throw Errors.invalidState('This innings is already complete. No additional balls can be added.');
      }
      if (opts.asDeclaration && innings.match.format !== MatchFormat.TEST) {
        throw Errors.invalidState('Declarations are only available for Test matches.');
      }
      const snapshot = replayInnings(toScoringEvents(innings.events), this.replayOptions(innings.match, innings));
      await this.persistProjection(tx, inningsId, snapshot);
      const terminalStatus = opts.asDeclaration ? InningsStatus.DECLARED : InningsStatus.COMPLETED;
      await tx.innings.update({ where: { id: inningsId }, data: { status: terminalStatus } });
      await this.finalizeInningsCompletion(tx, innings, snapshot);
      await tx.auditLog.create({
        data: {
          action: opts.asDeclaration ? 'INNINGS_DECLARED' : 'INNINGS_ENDED_EARLY',
          entity: 'Innings',
          entityId: inningsId,
          meta: { matchId: innings.matchId },
        },
      });
      return { snapshot, matchId: innings.matchId };
    });
    const dto = await this.publicLive.compose(result.matchId);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.scoreUpdated, dto);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.inningsCompleted, dto);
    if (dto.status === 'COMPLETED') {
      this.realtime.emitMatch(result.matchId, LIVE_SOCKET.matchCompleted, dto);
      await this.knockout.advanceAfterResult(result.matchId);
    }
    return result;
  }

  async undo(inningsId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Serializes concurrent undo calls on the same innings (e.g. a rapid double-tap): the second
      // call blocks here until the first commits, then re-reads its already-updated isUndone flags
      // — without this lock, two overlapping requests can each independently compute "the last
      // non-undone ball" from the same stale snapshot and undo two different balls instead of one.
      await tx.$executeRaw`SELECT id FROM "Innings" WHERE id = ${inningsId} FOR UPDATE`;
      const innings = await tx.innings.findUnique({
        where: { id: inningsId },
        include: { match: true, events: { orderBy: { sequence: 'asc' } } },
      });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      const remaining = innings.events.filter((e) => !e.isUndone);
      if (!remaining.length) throw Errors.invalidDelivery('Nothing to undo');
      // Auto-generated bonus/penalty events (hattrick, boundary, six, boundary-streak rules) are a
      // side effect of the ball right before them, not a delivery the scorer entered — so "undo the
      // last ball" means undoing that trailing run of auto-generated events together with the real
      // ball that triggered them, in one press, rather than requiring a separate undo per bonus.
      const toUndo: (typeof remaining)[number][] = [];
      for (let i = remaining.length - 1; i >= 0; i--) {
        toUndo.push(remaining[i]!);
        if (!remaining[i]!.isAutoGenerated) break;
      }
      const last = toUndo[toUndo.length - 1]!;
      const undoIds = new Set(toUndo.map((e) => e.id));
      await tx.ballEvent.updateMany({ where: { id: { in: [...undoIds] } }, data: { isUndone: true } });
      let events = innings.events.map((e) => (undoIds.has(e.id) ? { ...e, isUndone: true } : e));
      await this.overRules.evaluateOverCompletion(tx, innings.match, inningsId, events);
      if (innings.match.overWiseRulesEnabled) {
        events = await tx.ballEvent.findMany({ where: { inningsId }, orderBy: { sequence: 'asc' } });
      }
      const snapshot = replayInnings(toScoringEvents(events), this.replayOptions(innings.match, innings));
      await this.persistProjection(tx, inningsId, snapshot);
      await this.rules.evaluateInnings(tx, innings.matchId, inningsId);
      if (
        innings.match.status === MatchStatus.INNINGS_BREAK ||
        innings.match.status === MatchStatus.COMPLETED ||
        innings.match.status === MatchStatus.SUPER_OVER_PENDING
      ) {
        if (innings.match.status === MatchStatus.COMPLETED) {
          await this.stats.revert(tx, innings.matchId);
          await this.stats.persistStandings(tx, innings.matchId);
        }
        const revertTarget = innings.isSuperOver ? MatchStatus.SUPER_OVER : MatchStatus.LIVE;
        await tx.match.update({
          where: { id: innings.matchId },
          data: {
            status: revertTarget,
            resultType: null,
            resultWinnerTeamId: null,
            marginType: null,
            marginValue: null,
            completedAt: null,
          },
        });
        await tx.innings.update({ where: { id: inningsId }, data: { status: InningsStatus.IN_PROGRESS } });
      }
      if (innings.isSuperOver && !snapshot.isComplete) {
        // undo popped the ball that had completed this super-over innings; drop the
        // partner innings it auto-created (with a target derived from the now-stale total)
        // as long as no ball has been scored in it yet.
        const partner = await tx.innings.findFirst({
          where: { matchId: innings.matchId, isSuperOver: true, superOverNumber: innings.superOverNumber, NOT: { id: inningsId } },
          include: { events: true },
        });
        if (partner && partner.events.length === 0) {
          await tx.innings.delete({ where: { id: partner.id } });
        }
      }
      return { snapshot, undoneEventId: last.id, matchId: innings.matchId, undone: {
        strikerId: last.strikerId,
        nonStrikerId: last.nonStrikerId,
        bowlerId: last.bowlerId,
      } };
    });
    const dto = await this.publicLive.compose(result.matchId);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.scoreUpdated, dto);
    return result;
  }

  /**
   * Corrections are allowed while a match is still in progress, or once it has been explicitly
   * unlocked (`Match.correctionUnlocked`) after completion. `assertTransition`'s "no-op on same
   * state" rule means we never need to move a completed match out of COMPLETED to fix its balls —
   * only its result/stats content is recomputed, never its lifecycle state.
   */
  private assertCorrectable(match: { status: MatchStatus; correctionUnlocked: boolean }) {
    const terminal = match.status === MatchStatus.COMPLETED || match.status === MatchStatus.ABANDONED || match.status === MatchStatus.CANCELLED;
    if (terminal && !match.correctionUnlocked) {
      throw Errors.invalidState('This match is locked. Unlock the scorecard before making corrections.');
    }
  }

  /**
   * Re-derives display `overNumber`/`ballInOver` for every ball in the innings (they're pure
   * display metadata re-stamped from `sequence` order — see `recalcBallPositions`), replays the
   * innings, and persists the projection via the SAME `persistProjection` used by live scoring.
   * If the match is already COMPLETED, also re-runs the result/stats pipeline so a correction can
   * never leave a stale winner or stale player figures behind.
   */
  private async finishCorrection(tx: Prisma.TransactionClient, inningsId: string, matchId: string): Promise<InningsSnapshot> {
    const innings = await tx.innings.findUnique({
      where: { id: inningsId },
      include: { match: true, events: { orderBy: { sequence: 'asc' } } },
    });
    if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
    const replayOpts = this.replayOptions(innings.match, innings);
    const recalced = recalcBallPositions(innings.events, replayOpts);
    for (const { event, overNumber, ballInOver } of recalced) {
      if (event.overNumber !== overNumber || event.ballInOver !== ballInOver) {
        await tx.ballEvent.update({ where: { id: event.id }, data: { overNumber, ballInOver } });
      }
    }
    // Re-stamped over/ball positions (a correction can shift them) — needed so over-wise rule
    // evaluation groups each ball into the over it actually now belongs to, not its stale one.
    const correctedEvents = recalced.map(({ event, overNumber, ballInOver }) => ({ ...event, overNumber, ballInOver }));
    await this.overRules.evaluateOverCompletion(tx, innings.match, inningsId, correctedEvents);
    let finalEvents: typeof innings.events = innings.events;
    if (innings.match.overWiseRulesEnabled) {
      finalEvents = await tx.ballEvent.findMany({ where: { inningsId }, orderBy: { sequence: 'asc' } });
    }
    const snapshot = replayInnings(toScoringEvents(finalEvents), replayOpts);
    await this.persistProjection(tx, inningsId, snapshot);
    await this.rules.evaluateInnings(tx, matchId, inningsId);
    if (innings.match.status === MatchStatus.COMPLETED) {
      await this.stats.revert(tx, matchId);
      await this.recomputeCompletedMatchResult(tx, matchId);
      await this.stats.persist(tx, matchId);
      await this.stats.persistStandings(tx, matchId);
    }
    return snapshot;
  }

  /**
   * Recomputes an already-COMPLETED match's result from its innings' current totals — reusing the
   * exact same result functions the first-time completion path uses, just without any of the
   * "which state should we move to" branching (the match is already terminal and stays that way).
   * Deliberately does NOT re-run `knockout.advanceAfterResult` — if a correction flips a knockout
   * winner after a downstream bracket match has already been fed/played, that cascade needs a
   * human decision, not a silent rewrite.
   */
  private async recomputeCompletedMatchResult(tx: Prisma.TransactionClient, matchId: string) {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) return;
    const allInns = await tx.innings.findMany({ where: { matchId }, orderBy: { inningsNumber: 'asc' } });
    const mainInns = allInns.filter((i) => !i.isSuperOver);

    if (mainInns.length < 2) return; // nothing to recompute a result from

    let computed: { resultType: MatchResultType; winnerTeamId: string | null; marginType: MatchMarginType | null; marginValue: number | null };
    if (match.format === MatchFormat.TEST) {
      computed = computeTestMatchResult({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        maxWickets: match.maxWickets,
        innings: mainInns.map((i) => ({
          inningsNumber: i.inningsNumber,
          battingTeamId: i.battingTeamId,
          totalRuns: i.totalRuns,
          totalWickets: i.totalWickets,
          status: i.status,
        })),
      });
    } else {
      const resultInns = await this.rules.resultInnings(
        tx,
        matchId,
        mainInns.map((i) => ({
          id: i.id,
          inningsNumber: i.inningsNumber,
          battingTeamId: i.battingTeamId,
          totalRuns: i.totalRuns,
          totalWickets: i.totalWickets,
          status: InningsStatus.COMPLETED,
        })),
      );
      computed = computeMatchResult({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        maxWickets: match.maxWickets,
        innings: resultInns,
      });
    }
    await tx.match.update({
      where: { id: matchId },
      data: {
        resultType: computed.resultType,
        resultWinnerTeamId: computed.winnerTeamId,
        marginType: computed.marginType,
        marginValue: computed.marginValue,
      },
    });
  }

  async correctEvent(user: AuthUser, eventId: string, body: unknown) {
    const input = correctionSchema.parse(body);
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.ballEvent.findUnique({ where: { id: eventId } });
      if (!event) throw Errors.notFound('NOT_FOUND', 'Ball not found');
      const innings = await tx.innings.findUnique({ where: { id: event.inningsId }, include: { match: true } });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      this.assertCorrectable(innings.match);

      const strikerId = input.strikerId ?? event.strikerId;
      const nonStrikerId = input.nonStrikerId ?? event.nonStrikerId;
      const bowlerId = input.bowlerId ?? event.bowlerId;
      const batsmanRuns = input.batsmanRuns ?? event.batsmanRuns;
      const extraType = (input.extraType ?? event.extraType) as ExtraType;
      let extraRuns = input.extraRuns ?? event.extraRuns;
      if (input.extraType !== undefined && input.extraRuns === undefined) {
        extraRuns = extraType === 'WIDE' || extraType === 'NO_BALL' ? 1 : extraType === 'NONE' || extraType === 'PENALTY' ? 0 : extraRuns;
      }
      const isWicket = input.isWicket ?? event.isWicket;
      const dismissalType = input.dismissalType !== undefined ? input.dismissalType : event.dismissalType;
      const fielderId = input.fielderId !== undefined ? input.fielderId : event.fielderId;
      const dismissedPlayerId = isWicket
        ? (input.dismissedPlayerId !== undefined ? input.dismissedPlayerId : event.dismissedPlayerId) ?? strikerId
        : null;
      const penaltyReason = extraType === 'PENALTY' ? (input.penaltyReason ?? event.penaltyReason ?? 'OTHER') : null;

      if (strikerId === nonStrikerId) throw Errors.invalidDelivery('Striker and non-striker must differ');
      if (isWicket && !dismissalType) throw Errors.invalidWicket('Dismissal type required');

      const [batRows, bowlRows] = await Promise.all([
        tx.teamPlayer.findMany({ where: { teamId: innings.battingTeamId }, select: { playerId: true } }),
        tx.teamPlayer.findMany({ where: { teamId: innings.bowlingTeamId }, select: { playerId: true } }),
      ]);
      const personnel = deliveryPersonnelError({
        strikerId, nonStrikerId, bowlerId,
        battingPlayerIds: batRows.map((r) => r.playerId),
        bowlingPlayerIds: bowlRows.map((r) => r.playerId),
      });
      if (personnel) throw Errors.invalidDelivery(personnel);

      const before = {
        strikerId: event.strikerId, nonStrikerId: event.nonStrikerId, bowlerId: event.bowlerId,
        batsmanRuns: event.batsmanRuns, extraType: event.extraType, extraRuns: event.extraRuns,
        isWicket: event.isWicket, dismissalType: event.dismissalType, dismissedPlayerId: event.dismissedPlayerId,
        fielderId: event.fielderId, penaltyReason: event.penaltyReason,
      };
      const after = {
        strikerId, nonStrikerId, bowlerId, batsmanRuns, extraType, extraRuns,
        isWicket, dismissalType, dismissedPlayerId, fielderId, penaltyReason,
      };

      await tx.ballEvent.update({
        where: { id: eventId },
        data: { ...after, totalRuns: batsmanRuns + extraRuns },
      });

      const snapshot = await this.finishCorrection(tx, event.inningsId, innings.matchId);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BALL_CORRECTED',
          entity: 'BallEvent',
          entityId: eventId,
          meta: {
            matchId: innings.matchId, inningsId: innings.id, inningsNumber: innings.inningsNumber,
            sequence: event.sequence, overNumber: event.overNumber, ballInOver: event.ballInOver,
            before, after, reason: input.reason,
          },
        },
      });
      return { snapshot, matchId: innings.matchId };
    });
    const dto = await this.publicLive.compose(result.matchId);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.scoreUpdated, dto);
    return result;
  }

  async deleteEvent(user: AuthUser, eventId: string, body: unknown) {
    const input = deleteBallSchema.parse(body);
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.ballEvent.findUnique({ where: { id: eventId } });
      if (!event) throw Errors.notFound('NOT_FOUND', 'Ball not found');
      if (event.isUndone) throw Errors.invalidState('This ball has already been removed.');
      const innings = await tx.innings.findUnique({ where: { id: event.inningsId }, include: { match: true } });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      this.assertCorrectable(innings.match);

      await tx.ballEvent.update({ where: { id: eventId }, data: { isUndone: true } });
      const snapshot = await this.finishCorrection(tx, event.inningsId, innings.matchId);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BALL_DELETED',
          entity: 'BallEvent',
          entityId: eventId,
          meta: {
            matchId: innings.matchId, inningsId: innings.id, inningsNumber: innings.inningsNumber,
            sequence: event.sequence, overNumber: event.overNumber, ballInOver: event.ballInOver,
            before: {
              strikerId: event.strikerId, nonStrikerId: event.nonStrikerId, bowlerId: event.bowlerId,
              batsmanRuns: event.batsmanRuns, extraType: event.extraType, extraRuns: event.extraRuns,
              isWicket: event.isWicket, dismissalType: event.dismissalType,
            },
            after: null,
            reason: input.reason,
          },
        },
      });
      return { snapshot, matchId: innings.matchId };
    });
    const dto = await this.publicLive.compose(result.matchId);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.scoreUpdated, dto);
    return result;
  }

  /**
   * Inserts a ball the scorer missed entirely, at an arbitrary chronological position (right
   * after `afterEventId`, or at the very start when null). `sequence` isn't a DB auto-increment
   * (see `applyEvent`'s `max+1`), so renumbering the whole innings is a plain, safe integer
   * update — done via a two-phase bump to dodge the `[inningsId, sequence]` unique constraint.
   */
  async insertEvent(user: AuthUser, inningsId: string, body: unknown) {
    const input = insertBallSchema.parse(body);
    const result = await this.prisma.$transaction(async (tx) => {
      const innings = await tx.innings.findUnique({
        where: { id: inningsId },
        include: { match: true, events: { orderBy: { sequence: 'asc' } } },
      });
      if (!innings) throw Errors.notFound('MATCH_NOT_FOUND', 'Innings not found');
      this.assertCorrectable(innings.match);

      if (input.strikerId === input.nonStrikerId) throw Errors.invalidDelivery('Striker and non-striker must differ');
      if (input.isWicket && !input.dismissalType) throw Errors.invalidWicket('Dismissal type required');
      const [batRows, bowlRows] = await Promise.all([
        tx.teamPlayer.findMany({ where: { teamId: innings.battingTeamId }, select: { playerId: true } }),
        tx.teamPlayer.findMany({ where: { teamId: innings.bowlingTeamId }, select: { playerId: true } }),
      ]);
      const personnel = deliveryPersonnelError({
        strikerId: input.strikerId, nonStrikerId: input.nonStrikerId, bowlerId: input.bowlerId,
        battingPlayerIds: batRows.map((r) => r.playerId),
        bowlingPlayerIds: bowlRows.map((r) => r.playerId),
      });
      if (personnel) throw Errors.invalidDelivery(personnel);

      const ordered = innings.events; // already sorted by sequence asc
      if (input.afterEventId && !ordered.some((e) => e.id === input.afterEventId)) {
        throw Errors.notFound('NOT_FOUND', 'Reference ball not found in this innings');
      }
      const insertAt = input.afterEventId ? ordered.findIndex((e) => e.id === input.afterEventId) + 1 : 0;
      const newOrder = [...ordered.slice(0, insertAt).map((e) => e.id), '__NEW__', ...ordered.slice(insertAt).map((e) => e.id)];

      // Two-phase renumber: bump everything out of the way first so intermediate writes never collide
      // with the unique (inningsId, sequence) constraint, then assign final 1..N sequence values.
      await tx.ballEvent.updateMany({ where: { inningsId }, data: { sequence: { increment: 1_000_000 } } });
      let newEventId = '';
      for (let i = 0; i < newOrder.length; i++) {
        const finalSequence = i + 1;
        if (newOrder[i] === '__NEW__') {
          const extraType = (input.extraType ?? 'NONE') as ExtraType;
          const extraRuns = input.extraRuns ?? (extraType === 'WIDE' || extraType === 'NO_BALL' ? 1 : 0);
          const created = await tx.ballEvent.create({
            data: {
              inningsId,
              matchId: innings.matchId,
              sequence: finalSequence,
              idempotencyKey: `correction-insert-${randomUUID()}`,
              overNumber: 0,
              ballInOver: 0,
              strikerId: input.strikerId,
              nonStrikerId: input.nonStrikerId,
              bowlerId: input.bowlerId,
              batsmanRuns: input.batsmanRuns,
              extraRuns,
              totalRuns: input.batsmanRuns + extraRuns,
              extraType,
              isWicket: Boolean(input.isWicket),
              dismissalType: input.dismissalType ?? null,
              dismissedPlayerId: input.isWicket ? (input.dismissedPlayerId ?? input.strikerId) : null,
              fielderId: input.fielderId ?? null,
              penaltyReason: extraType === 'PENALTY' ? input.penaltyReason ?? 'OTHER' : null,
              commentary: this.commentary(input.batsmanRuns, extraType, extraRuns, Boolean(input.isWicket), input.dismissalType),
            },
          });
          newEventId = created.id;
        } else {
          await tx.ballEvent.update({ where: { id: newOrder[i]! }, data: { sequence: finalSequence } });
        }
      }

      const snapshot = await this.finishCorrection(tx, inningsId, innings.matchId);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BALL_INSERTED',
          entity: 'BallEvent',
          entityId: newEventId,
          meta: {
            matchId: innings.matchId, inningsId, inningsNumber: innings.inningsNumber, afterEventId: input.afterEventId,
            before: null,
            after: {
              strikerId: input.strikerId, nonStrikerId: input.nonStrikerId, bowlerId: input.bowlerId,
              batsmanRuns: input.batsmanRuns, extraType: input.extraType ?? 'NONE', extraRuns: input.extraRuns ?? null,
              isWicket: Boolean(input.isWicket), dismissalType: input.dismissalType ?? null,
            },
            reason: input.reason,
          },
        },
      });
      return { snapshot, matchId: innings.matchId };
    });
    const dto = await this.publicLive.compose(result.matchId);
    this.realtime.emitMatch(result.matchId, LIVE_SOCKET.scoreUpdated, dto);
    return result;
  }

  async listCorrections(matchId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'Match', entityId: matchId, action: { in: ['SCORECARD_UNLOCKED', 'SCORECARD_LOCKED'] } },
          { entity: 'BallEvent', action: { in: ['BALL_CORRECTED', 'BALL_DELETED', 'BALL_INSERTED'] }, meta: { path: ['matchId'], equals: matchId } },
        ],
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async live(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    const innings = [...match.innings].reverse().find((i) => i.status === InningsStatus.IN_PROGRESS) ?? match.innings[match.innings.length - 1] ?? null;
    const viewerCount = this.realtime.publicViewerCount(matchId);
    if (!innings) return { match, innings: null, snapshot: null, customRules: null, mvp: [], viewerCount };
    const { snapshot } = await this.snapshotForInnings(innings.id);
    const customRules = await this.rules.liveOverlay(matchId);
    const mvp = await this.matchMvp(matchId);
    return { match, innings: { ...innings, snapshot }, snapshot, customRules, mvp, viewerCount };
  }

  /**
   * Playing XI (MatchPlayer) isn't required before scoring starts, so it can be empty even
   * though real players already have deliveries recorded against them. Reused by the scorecard
   * PDF export so it never falls back to printing a raw player id — same fallback as `matchMvp`.
   */
  async namesForMatch(matchId: string): Promise<Map<string, string>> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: { include: { player: true } },
        innings: { include: { events: true } },
      },
    });
    if (!match) return new Map();
    const names = new Map(match.players.map((p) => [p.playerId, p.player.name]));
    const referencedIds = new Set<string>();
    for (const inn of match.innings) {
      for (const e of inn.events) {
        referencedIds.add(e.strikerId);
        referencedIds.add(e.nonStrikerId);
        referencedIds.add(e.bowlerId);
        if (e.dismissedPlayerId) referencedIds.add(e.dismissedPlayerId);
        if (e.fielderId) referencedIds.add(e.fielderId);
      }
    }
    const missingIds = [...referencedIds].filter((id) => !names.has(id));
    if (missingIds.length) {
      const extra = await this.prisma.player.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
      for (const p of extra) names.set(p.id, p.name);
    }
    return names;
  }

  async scorecard(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    const innings = await Promise.all(
      match.innings.map(async (inn) => {
        const { snapshot } = await this.snapshotForInnings(inn.id);
        return { ...inn, snapshot };
      }),
    );
    const mvp = await this.matchMvp(matchId);
    return { match, innings, mvp };
  }

  /**
   * Scorer name + tournament club, for the PDF report only — deliberately not folded
   * into `scorecard()`, since that method also backs the public scorecard API and
   * shouldn't leak the match creator's identity there.
   */
  async reportMeta(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        createdBy: { select: { name: true } },
        tournament: { select: { club: { select: { name: true } } } },
      },
    });
    return {
      scorerName: match?.createdBy?.name ?? null,
      tournamentClubName: match?.tournament?.club?.name ?? null,
    };
  }

  /** Configured hattrick bonus value for the PDF's "Match Rules" block, if any. */
  async hattrickBonusRuns(matchId: string): Promise<number | null> {
    const info = await this.rules.matchRules(matchId);
    if (!info.enabled) return null;
    const rule = info.rules.find((r) => r.condition === 'HATTRICK' && r.enabled && r.action === 'WICKET_BONUS');
    if (!rule) return null;
    return Math.abs(Number(rule.actionConfig?.runs ?? 0));
  }

  /** Configured hattrick penalty value (against the batting team) for the PDF's "Match Rules" block, if any. */
  async hattrickPenaltyRuns(matchId: string): Promise<number | null> {
    const info = await this.rules.matchRules(matchId);
    if (!info.enabled) return null;
    const rule = info.rules.find(
      (r) => r.condition === 'HATTRICK' && r.enabled && (r.action === 'WICKET_PENALTY' || r.action === 'SUBTRACT_PENALTY' || r.action === 'SUBTRACT_RUNS'),
    );
    if (!rule) return null;
    return Math.abs(Number(rule.actionConfig?.runs ?? 0));
  }

  async matchMvp(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          orderBy: { inningsNumber: 'asc' },
          include: { events: { orderBy: { sequence: 'asc' } }, battingTeam: true, bowlingTeam: true },
        },
        ruleSnapshot: true,
        players: { include: { player: true } },
      },
    });
    if (!match) return [];
    const names = new Map(match.players.map((p) => [p.playerId, p.player.name]));
    // Playing XI (MatchPlayer) isn't required before scoring starts, so it can be empty even
    // though real players already have deliveries recorded against them — fall back to every
    // player id actually referenced by a ball event so names never fall through to "Player".
    const referencedIds = new Set<string>();
    for (const inn of match.innings) {
      for (const e of inn.events) {
        referencedIds.add(e.strikerId);
        referencedIds.add(e.nonStrikerId);
        referencedIds.add(e.bowlerId);
        if (e.dismissedPlayerId) referencedIds.add(e.dismissedPlayerId);
        if (e.fielderId) referencedIds.add(e.fielderId);
      }
    }
    const missingIds = [...referencedIds].filter((id) => !names.has(id));
    if (missingIds.length) {
      const extra = await this.prisma.player.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
      for (const p of extra) names.set(p.id, p.name);
    }
    const config = mvpConfigFromSnapshot(parseRuleSnapshot(match.ruleSnapshot?.rulesJson));
    const slices = match.innings.map((inn) => {
      const snap = replayInnings(toScoringEvents(inn.events), this.replayOptions(match, inn));
      return {
        battingTeamName: inn.battingTeam.name,
        bowlingTeamName: inn.bowlingTeam.name,
        batters: snap.batters,
        bowlers: snap.bowlers,
        wickets: inn.events.filter((e) => e.isWicket && !e.isUndone).map((e) => ({
          dismissalType: e.dismissalType,
          fielderId: e.fielderId,
          bowlerId: e.bowlerId,
        })),
        names,
      };
    });
    return computeMatchMvp(mvpInputsFromInnings(slices), config);
  }

  async listEvents(inningsId: string) {
    return this.prisma.ballEvent.findMany({ where: { inningsId, isUndone: false }, orderBy: { sequence: 'asc' } });
  }

  private commentary(runs: number, extra: ExtraType, extraRuns: number, wicket: boolean, dismissal?: string) {
    if (wicket) return `${dismissal ?? 'WICKET'}${runs ? ` + ${runs}` : ''}`;
    if (extra === 'WIDE') return extraRuns > 1 ? `Wide + ${extraRuns - 1}` : 'Wide';
    if (extra === 'NO_BALL') return runs ? `No ball + ${runs}` : 'No ball';
    if (extra === 'BYE') return `${extraRuns} bye`;
    if (extra === 'LEG_BYE') return `${extraRuns} leg bye`;
    if (extra === 'PENALTY') return extraRuns < 0 ? `Penalty -${Math.abs(extraRuns)}` : `Bonus ${extraRuns}`;
    if (runs === 0) return 'Dot';
    if (runs === 4) return 'FOUR';
    if (runs === 6) return 'SIX';
    return `${runs}`;
  }
}
