import { Inject, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, ExtraType as PrismaExtraType } from '@prisma/client';
import { z } from 'zod';
import { defaultOverRuleName, evaluateOverRule, overActuals, type ExtraType, type OverRuleType } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';

type RawBallEvent = {
  id: string;
  sequence: number;
  overNumber: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraRuns: number;
  isWicket: boolean;
  extraType: ExtraType;
  isUndone?: boolean;
};

function overRuleEventKey(overNumber: number, ruleType: string): string {
  return `over-rule-${overNumber}-${ruleType}`;
}

const TERMINAL_STATUSES: MatchStatus[] = [MatchStatus.COMPLETED, MatchStatus.ABANDONED, MatchStatus.CANCELLED];

const targetConfigSchema = z.object({
  target: z.number().int().min(0).max(999),
  achievedBonus: z.number().int().min(0).max(999),
  notAchievedPenalty: z.number().int().min(0).max(999),
});
const mappingRowSchema = z.object({
  kind: z.enum(['RUN', 'WICKET', 'OTHER']),
  count: z.number().int().min(0).max(999),
  value: z.number().int().min(1).max(999),
});
const mappingConfigSchema = z.object({ mapping: z.array(mappingRowSchema).max(50) });
const customConfigSchema = z.object({
  bonusRuns: z.number().int().min(0).max(999),
  penaltyRuns: z.number().int().min(0).max(999),
});

export const overRuleUpsertSchema = z.discriminatedUnion('ruleType', [
  z.object({ ruleType: z.literal('TARGET'), name: z.string().trim().max(80).optional().nullable(), enabled: z.boolean().optional(), config: targetConfigSchema }),
  z.object({ ruleType: z.literal('MAPPING'), name: z.string().trim().max(80).optional().nullable(), enabled: z.boolean().optional(), config: mappingConfigSchema }),
  z.object({ ruleType: z.literal('CUSTOM'), name: z.string().trim().max(80).optional().nullable(), enabled: z.boolean().optional(), config: customConfigSchema }),
]);

export type OverRuleAppliedEvent = {
  overNumber: number;
  ruleName: string;
  message: string;
  bonusRuns: number;
  penaltyRuns: number;
};

/**
 * Per-over "Power Over"/"Target Over"/etc rule configuration and evaluation — additive and
 * fully separate from the tournament-wide TournamentRule engine (`rules.service.ts`) and from
 * player statistics. Gated match-by-match behind `Match.overWiseRulesEnabled` (default false),
 * so it is a strict no-op for every existing match. An over may carry up to one rule of each
 * type (TARGET, MAPPING, CUSTOM) simultaneously — each is evaluated and scored independently,
 * so e.g. a Target Rule and a Mapping rule can both fire on the same over and their net runs
 * simply add together in the official score.
 */
@Injectable()
export class OverRulesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  private async getMatchOr404(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    return match;
  }

  private assertNotFinished(match: { status: MatchStatus }) {
    if (TERMINAL_STATUSES.includes(match.status)) {
      throw Errors.invalidState('Over-wise rules are locked once the match is finished.');
    }
  }

  private async assertOverEditable(matchId: string, overNumber: number) {
    const existingResult = await this.prisma.overRuleResult.findFirst({ where: { matchId, overNumber } });
    if (existingResult) {
      throw Errors.invalidState(`Over ${overNumber + 1} has already been completed — its rule result is locked.`);
    }
  }

  async list(matchId: string) {
    const match = await this.getMatchOr404(matchId);
    const [rules, results] = await Promise.all([
      this.prisma.overRule.findMany({ where: { matchId }, orderBy: [{ overNumber: 'asc' }, { ruleType: 'asc' }] }),
      this.prisma.overRuleResult.findMany({ where: { matchId }, orderBy: [{ overNumber: 'asc' }, { ruleType: 'asc' }] }),
    ]);
    const completedOvers = new Set(results.map((r) => r.overNumber));
    return {
      enabled: match.overWiseRulesEnabled,
      overs: match.overs,
      rules: rules.map((r) => ({
        overNumber: r.overNumber,
        name: r.name,
        displayName: r.name?.trim() || defaultOverRuleName(r.overNumber),
        ruleType: r.ruleType,
        config: r.config,
        enabled: r.enabled,
        locked: completedOvers.has(r.overNumber),
      })),
      results: results.map((r) => ({
        inningsId: r.inningsId,
        overNumber: r.overNumber,
        ruleName: r.ruleName,
        ruleType: r.ruleType,
        actualRuns: r.actualRuns,
        actualWickets: r.actualWickets,
        bonusRuns: r.bonusRuns,
        penaltyRuns: r.penaltyRuns,
      })),
    };
  }

  /** Upserts the ONE rule of `body.ruleType` configured for this over — other rule types already
   * configured on the same over (if any) are untouched. */
  async upsertRule(user: AuthUser, matchId: string, overNumber: number, body: unknown) {
    await this.access.assertMatch(user, matchId, 'MATCH_EDIT');
    const match = await this.getMatchOr404(matchId);
    this.assertNotFinished(match);
    if (!Number.isInteger(overNumber) || overNumber < 0 || overNumber >= match.overs) {
      throw Errors.validation('Over number is out of range for this match.');
    }
    await this.assertOverEditable(matchId, overNumber);
    const input = overRuleUpsertSchema.parse(body);
    return this.prisma.overRule.upsert({
      where: { matchId_overNumber_ruleType: { matchId, overNumber, ruleType: input.ruleType } },
      create: {
        matchId,
        overNumber,
        name: input.name ?? null,
        ruleType: input.ruleType,
        config: input.config as Prisma.InputJsonValue,
        enabled: input.enabled ?? true,
      },
      update: {
        name: input.name ?? null,
        config: input.config as Prisma.InputJsonValue,
        enabled: input.enabled ?? true,
      },
    });
  }

  /** Clears one rule type from this over (`ruleType` given), or every rule configured on it
   * (`ruleType` omitted). */
  async clearRule(user: AuthUser, matchId: string, overNumber: number, ruleType?: string) {
    await this.access.assertMatch(user, matchId, 'MATCH_EDIT');
    const match = await this.getMatchOr404(matchId);
    this.assertNotFinished(match);
    await this.assertOverEditable(matchId, overNumber);
    await this.prisma.overRule.deleteMany({ where: { matchId, overNumber, ...(ruleType ? { ruleType } : {}) } });
    return { ok: true };
  }

  /** Copies the FULL set of rules configured on `fromOver` onto `toOver`, replacing whatever
   * `toOver` had configured. */
  async copyRule(user: AuthUser, matchId: string, fromOver: number, toOver: number) {
    await this.access.assertMatch(user, matchId, 'MATCH_EDIT');
    const match = await this.getMatchOr404(matchId);
    this.assertNotFinished(match);
    if (!Number.isInteger(toOver) || toOver < 0 || toOver >= match.overs) {
      throw Errors.validation('Target over number is out of range for this match.');
    }
    await this.assertOverEditable(matchId, toOver);
    const sources = await this.prisma.overRule.findMany({ where: { matchId, overNumber: fromOver } });
    if (!sources.length) throw Errors.notFound('OVER_RULE_NOT_FOUND', 'The source over has no rule configured.');
    await this.prisma.overRule.deleteMany({ where: { matchId, overNumber: toOver } });
    await this.prisma.overRule.createMany({
      data: sources.map((s) => ({
        matchId,
        overNumber: toOver,
        name: s.name,
        ruleType: s.ruleType,
        config: s.config as Prisma.InputJsonValue,
        enabled: s.enabled,
      })),
    });
    return this.prisma.overRule.findMany({ where: { matchId, overNumber: toOver } });
  }

  /**
   * Re-derives every configured rule's outcome for this innings, purely from raw ball events —
   * never from a previously-applied bonus/penalty. Called inside the same DB transaction as
   * every ball mutation (score, correct, insert, delete, undo), so replay/reconnect/correction
   * can only ever converge on the same row per (innings, over, rule type) — never duplicate one.
   * Returns only the (over, rule) pairs whose result is brand new this call, for the live
   * "rule applied" toast.
   *
   * The net bonus/penalty of EACH rule is also applied to the OFFICIAL score independently: for
   * every (over, ruleType) whose outcome is new or has changed, its own auto-generated
   * `PENALTY`-extraType ball event (net runs, can be negative) is created/updated/undone under a
   * deterministic idempotency key so it can be found again on the next correction — mirroring
   * exactly how the tournament rule engine's hattrick/six bonuses already affect the real score
   * (see `applyEvent`'s `autoExtras`). When an over carries more than one rule, each gets its own
   * ball event, so their net runs simply add together in the replay. None of them ever counts as
   * a legal ball or credits an individual batter/bowler, and — since `overActuals` explicitly
   * skips PENALTY-extraType events — none can ever compound into a later over's own evaluation.
   * Callers must re-read ball events from `tx` after calling this before doing their own final
   * replay, so the adjustment is reflected in the persisted innings total.
   */
  async evaluateOverCompletion(
    tx: Prisma.TransactionClient,
    match: { id: string; overWiseRulesEnabled: boolean; overs: number; ballsPerOver: number; settings: Prisma.JsonValue | null },
    inningsId: string,
    events: RawBallEvent[],
  ): Promise<OverRuleAppliedEvent[]> {
    if (!match.overWiseRulesEnabled) return [];
    const rules = await tx.overRule.findMany({ where: { matchId: match.id, enabled: true } });
    if (!rules.length) return [];
    const rulesByOver = new Map<number, typeof rules>();
    for (const r of rules) {
      const list = rulesByOver.get(r.overNumber) ?? [];
      list.push(r);
      rulesByOver.set(r.overNumber, list);
    }
    const existing = await tx.overRuleResult.findMany({ where: { inningsId } });
    const existingByKey = new Map(existing.map((r) => [`${r.overNumber}:${r.ruleType}`, r]));
    // A running counter, not a per-rule `events.reduce(...)` — several rule types can fire for the
    // same over in one call, and each needs its own new ball event with a distinct sequence.
    let nextSequence = events.reduce((max, e) => Math.max(max, e.sequence), 0) + 1;
    const settings = (match.settings ?? {}) as Record<string, unknown>;
    const legalBallOptions = {
      widesCountAsLegal: Boolean(settings.widesCountAsLegal),
      noBallsCountAsLegal: Boolean(settings.noBallsCountAsLegal),
    };

    const applied: OverRuleAppliedEvent[] = [];
    for (let overNumber = 0; overNumber < match.overs; overNumber++) {
      const overRules = rulesByOver.get(overNumber) ?? [];
      const actuals = overActuals(events, overNumber, match.ballsPerOver, legalBallOptions);

      // Un-apply results (and their score-affecting ball events) for any rule type that no longer
      // applies to this over — either the over itself isn't complete (yet, or any more, after a
      // correction), or that specific rule type was cleared while others on the over remain.
      const stalePriors = existing.filter(
        (r) => r.overNumber === overNumber && (!actuals.isOverComplete || !overRules.some((rr) => rr.ruleType === r.ruleType)),
      );
      for (const stale of stalePriors) {
        await tx.overRuleResult.delete({ where: { id: stale.id } });
        const key = overRuleEventKey(overNumber, stale.ruleType);
        const staleBall = await tx.ballEvent.findUnique({ where: { inningsId_idempotencyKey: { inningsId, idempotencyKey: key } } });
        if (staleBall && !staleBall.isUndone) await tx.ballEvent.update({ where: { id: staleBall.id }, data: { isUndone: true } });
      }
      if (!actuals.isOverComplete || !overRules.length) continue;

      for (const rule of overRules) {
        const prior = existingByKey.get(`${overNumber}:${rule.ruleType}`);
        const outcome = evaluateOverRule(
          { ruleType: rule.ruleType as OverRuleType, name: rule.name, config: rule.config as Record<string, unknown> },
          actuals.actualRuns,
          actuals.actualWickets,
        );
        const ruleName = rule.name?.trim() || defaultOverRuleName(overNumber);
        const changed =
          !prior ||
          prior.bonusRuns !== outcome.bonusRuns ||
          prior.penaltyRuns !== outcome.penaltyRuns ||
          prior.actualRuns !== actuals.actualRuns ||
          prior.actualWickets !== actuals.actualWickets;
        if (changed) {
          await tx.overRuleResult.upsert({
            where: { inningsId_overNumber_ruleType: { inningsId, overNumber, ruleType: rule.ruleType } },
            create: {
              matchId: match.id,
              inningsId,
              overNumber,
              ruleId: rule.id,
              ruleName,
              ruleType: rule.ruleType,
              actualRuns: actuals.actualRuns,
              actualWickets: actuals.actualWickets,
              bonusRuns: outcome.bonusRuns,
              penaltyRuns: outcome.penaltyRuns,
            },
            update: {
              ruleId: rule.id,
              ruleName,
              actualRuns: actuals.actualRuns,
              actualWickets: actuals.actualWickets,
              bonusRuns: outcome.bonusRuns,
              penaltyRuns: outcome.penaltyRuns,
            },
          });

          const netRuns = outcome.bonusRuns - outcome.penaltyRuns;
          const idempotencyKey = overRuleEventKey(overNumber, rule.ruleType);
          const existingBall = await tx.ballEvent.findUnique({ where: { inningsId_idempotencyKey: { inningsId, idempotencyKey } } });
          if (netRuns === 0) {
            if (existingBall && !existingBall.isUndone) {
              await tx.ballEvent.update({ where: { id: existingBall.id }, data: { isUndone: true } });
            }
          } else if (existingBall) {
            await tx.ballEvent.update({
              where: { id: existingBall.id },
              data: { extraRuns: netRuns, totalRuns: netRuns, isUndone: false, commentary: outcome.message },
            });
          } else {
            const anchor = [...events]
              .filter((e) => !e.isUndone && e.overNumber === overNumber && e.extraType !== 'PENALTY')
              .sort((a, b) => b.sequence - a.sequence)[0];
            if (anchor) {
              await tx.ballEvent.create({
                data: {
                  inningsId,
                  matchId: match.id,
                  sequence: nextSequence++,
                  idempotencyKey,
                  overNumber,
                  ballInOver: match.ballsPerOver,
                  strikerId: anchor.strikerId,
                  nonStrikerId: anchor.nonStrikerId,
                  bowlerId: anchor.bowlerId,
                  batsmanRuns: 0,
                  extraRuns: netRuns,
                  totalRuns: netRuns,
                  extraType: PrismaExtraType.PENALTY,
                  isWicket: false,
                  penaltyReason: 'OTHER',
                  commentary: outcome.message,
                  isAutoGenerated: true,
                },
              });
            }
          }
        }
        if (!prior) {
          applied.push({ overNumber, ruleName, message: outcome.message, bonusRuns: outcome.bonusRuns, penaltyRuns: outcome.penaltyRuns });
        }
      }
    }
    return applied;
  }
}
