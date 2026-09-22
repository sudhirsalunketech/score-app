import { Inject, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  DEFAULT_RULE_AFFECTS,
  DEFAULT_MVP_CONFIG,
  evaluateInningsRules,
  isAllowedAction,
  isAllowedCondition,
  parseRuleSnapshot,
  previewTournamentRule,
  publicRuleSummary,
  rulesAffect,
  sanitizeDelta,
  sanitizeMultiplier,
  sanitizeMvpConfig,
  type RuleSetSnapshot,
  type TournamentRule,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';

const affectsSchema = z.object({
  matchResult: z.boolean().optional(),
  tournamentPoints: z.boolean().optional(),
  nrr: z.boolean().optional(),
  playerStats: z.boolean().optional(),
  teamStats: z.boolean().optional(),
  displayOnly: z.boolean().optional(),
});

const ruleBodySchema = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(['OVER_RULE', 'BALL_RULE', 'RUN_RULE', 'WICKET_RULE', 'TARGET_RULE', 'PENALTY_RULE']),
  scope: z.enum(['TOURNAMENT', 'MATCH', 'INNINGS', 'OVER', 'BALL']),
  condition: z.string(),
  conditionConfig: z.record(z.unknown()).optional(),
  action: z.string(),
  actionConfig: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
  affects: affectsSchema.optional(),
});

const saveBodySchema = z.object({
  rules: z.array(ruleBodySchema).max(40),
  mvp: z.unknown().optional(),
});

function toEngineRule(row: {
  id: string;
  name: string;
  category: string;
  scope: string;
  condition: string;
  conditionConfig: Prisma.JsonValue;
  action: string;
  actionConfig: Prisma.JsonValue;
  priority: number;
  enabled: boolean;
  affectsMatchResult: boolean;
  affectsTournamentPoints: boolean;
  affectsNrr: boolean;
  affectsPlayerStats: boolean;
  affectsTeamStats: boolean;
  displayOnly: boolean;
}): TournamentRule {
  const condition = isAllowedCondition(row.condition) ? row.condition : 'ALWAYS';
  const action = isAllowedAction(row.action) ? row.action : 'COUNT_NORMAL';
  const conditionConfig = (row.conditionConfig ?? {}) as TournamentRule['conditionConfig'];
  const actionConfig = (row.actionConfig ?? {}) as TournamentRule['actionConfig'];
  return {
    id: row.id,
    name: row.name,
    category: row.category as TournamentRule['category'],
    scope: row.scope as TournamentRule['scope'],
    condition,
    conditionConfig,
    action,
    actionConfig: {
      ...actionConfig,
      multiplier: actionConfig.multiplier != null ? sanitizeMultiplier(actionConfig.multiplier) : undefined,
      runs: actionConfig.runs != null ? sanitizeDelta(actionConfig.runs) : undefined,
    },
    priority: row.priority,
    enabled: row.enabled,
    affects: {
      matchResult: row.affectsMatchResult,
      tournamentPoints: row.affectsTournamentPoints,
      nrr: row.affectsNrr,
      playerStats: row.affectsPlayerStats,
      teamStats: row.affectsTeamStats,
      displayOnly: row.displayOnly,
    },
  };
}

export function snapshotFromJson(value: Prisma.JsonValue | null | undefined): RuleSetSnapshot | null {
  return parseRuleSnapshot(value);
}

@Injectable()
export class TournamentRulesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async assertCanManage(user: AuthUser, tournamentId: string) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_RULES');
    return this.prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { createdById: true } });
  }

  async getBundle(tournamentId: string) {
    const tn = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const versions = await this.prisma.tournamentRuleSet.findMany({
      where: { tournamentId },
      include: { rules: { orderBy: { priority: 'asc' } }, snapshots: { take: 1, select: { id: true } } },
      orderBy: { version: 'desc' },
    });
    const liveOrDone = await this.prisma.match.count({
      where: { tournamentId, status: { in: [MatchStatus.LIVE, MatchStatus.INNINGS_BREAK, MatchStatus.COMPLETED, MatchStatus.ABANDONED] } },
    });
    const current = versions.find((v) => v.enabled) ?? versions[0] ?? null;
    return {
      current: current ? this.dto(current) : { enabled: false, version: 0, rules: [] },
      versions: versions.map((v) => this.dto(v)),
      hasLiveOrCompletedMatches: liveOrDone > 0,
    };
  }

  private dto(set: {
    id: string;
    version: number;
    enabled: boolean;
    mvpJson?: Prisma.JsonValue | null;
    rules: Parameters<typeof toEngineRule>[0][];
    snapshots?: { id: string }[];
  }) {
    return {
      id: set.id,
      version: set.version,
      enabled: set.enabled,
      locked: Boolean(set.snapshots?.length),
      rules: set.rules.map(toEngineRule),
      mvp: sanitizeMvpConfig(set.mvpJson ?? DEFAULT_MVP_CONFIG),
    };
  }

  async createVersion(user: AuthUser, tournamentId: string) {
    await this.assertCanManage(user, tournamentId);
    const latest = await this.prisma.tournamentRuleSet.findFirst({
      where: { tournamentId },
      include: { rules: true },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await this.prisma.tournamentRuleSet.create({
      data: {
        tournamentId,
        version,
        enabled: false,
        createdById: user.id,
        mvpJson: (latest?.mvpJson as Prisma.InputJsonValue | undefined) ?? (DEFAULT_MVP_CONFIG as unknown as Prisma.InputJsonValue),
        rules: latest
          ? {
              create: latest.rules.map((r) => ({
                name: r.name,
                category: r.category,
                scope: r.scope,
                condition: r.condition,
                conditionConfig: r.conditionConfig as Prisma.InputJsonValue,
                action: r.action,
                actionConfig: r.actionConfig as Prisma.InputJsonValue,
                priority: r.priority,
                enabled: r.enabled,
                affectsMatchResult: r.affectsMatchResult,
                affectsTournamentPoints: r.affectsTournamentPoints,
                affectsNrr: r.affectsNrr,
                affectsPlayerStats: r.affectsPlayerStats,
                affectsTeamStats: r.affectsTeamStats,
                displayOnly: r.displayOnly,
              })),
            }
          : undefined,
      },
      include: { rules: true, snapshots: { take: 1, select: { id: true } } },
    });
    return this.dto(created);
  }

  private async requireUnlocked(tournamentId: string, version: number) {
    const set = await this.prisma.tournamentRuleSet.findUnique({
      where: { tournamentId_version: { tournamentId, version } },
      include: { rules: true, snapshots: { take: 1, select: { id: true } } },
    });
    if (!set) throw Errors.notFound('NOT_FOUND', 'Rule version not found');
    if (set.snapshots.length) {
      throw Errors.invalidState('This rule version is locked by existing matches. Create a new version.');
    }
    return set;
  }

  async saveRules(user: AuthUser, tournamentId: string, version: number, body: unknown) {
    await this.assertCanManage(user, tournamentId);
    const input = saveBodySchema.parse(body);
    const set = await this.requireUnlocked(tournamentId, version);
    for (const rule of input.rules) {
      if (!isAllowedCondition(rule.condition)) throw Errors.validation('Unsupported rule condition');
      if (!isAllowedAction(rule.action)) throw Errors.validation('Unsupported rule action');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tournamentRule.deleteMany({ where: { ruleSetId: set.id } });
      if (input.rules.length) {
        await tx.tournamentRule.createMany({
          data: input.rules.map((rule, index) => {
            const affects = { ...DEFAULT_RULE_AFFECTS, ...rule.affects };
            const actionConfig = {
              ...(rule.actionConfig ?? {}),
              multiplier: rule.actionConfig?.multiplier != null ? sanitizeMultiplier(rule.actionConfig.multiplier) : undefined,
              runs: rule.actionConfig?.runs != null ? sanitizeDelta(rule.actionConfig.runs) : undefined,
            };
            return {
              ruleSetId: set.id,
              name: rule.name,
              category: rule.category,
              scope: rule.scope,
              condition: rule.condition,
              conditionConfig: (rule.conditionConfig ?? {}) as Prisma.InputJsonValue,
              action: rule.action,
              actionConfig: actionConfig as Prisma.InputJsonValue,
              priority: rule.priority ?? index,
              enabled: rule.enabled ?? true,
              affectsMatchResult: affects.matchResult,
              affectsTournamentPoints: affects.tournamentPoints,
              affectsNrr: affects.nrr,
              affectsPlayerStats: affects.playerStats,
              affectsTeamStats: affects.teamStats,
              displayOnly: affects.displayOnly,
            };
          }),
        });
      }
      return tx.tournamentRuleSet.update({
        where: { id: set.id },
        data: {
          mvpJson: sanitizeMvpConfig(input.mvp ?? DEFAULT_MVP_CONFIG) as unknown as Prisma.InputJsonValue,
        },
        include: { rules: true, snapshots: { take: 1, select: { id: true } } },
      });
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'TOURNAMENT_RULES_SAVED', entity: 'Tournament', entityId: tournamentId, meta: { version } },
    });
    return this.dto(updated);
  }

  async activate(user: AuthUser, tournamentId: string, version: number, enabled: boolean) {
    await this.assertCanManage(user, tournamentId);
    const set = await this.prisma.tournamentRuleSet.findUnique({
      where: { tournamentId_version: { tournamentId, version } },
      include: { rules: true },
    });
    if (!set) throw Errors.notFound('NOT_FOUND', 'Rule version not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentRuleSet.updateMany({ where: { tournamentId }, data: { enabled: false } });
      await tx.tournamentRuleSet.update({ where: { id: set.id }, data: { enabled } });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: enabled ? 'TOURNAMENT_RULES_ACTIVATED' : 'TOURNAMENT_RULES_DISABLED',
        entity: 'Tournament',
        entityId: tournamentId,
        meta: { version },
      },
    });
    return this.getBundle(tournamentId);
  }

  async preview(user: AuthUser, tournamentId: string, body: unknown) {
    await this.assertCanManage(user, tournamentId);
    const input = z
      .object({
        over: z.number().int().min(1).max(90),
        ball: z.number().int().min(1).max(8),
        actualRuns: z.number().int().min(0).max(13),
        isWicket: z.boolean().optional(),
        version: z.number().int().optional(),
        rules: z.array(ruleBodySchema).max(40).optional(),
      })
      .parse(body);
    let snapshot: RuleSetSnapshot;
    if (input.rules) {
      snapshot = {
        enabled: true,
        version: input.version ?? 0,
        rules: input.rules.map((rule, index) => ({
          id: `preview-${index}`,
          name: rule.name,
          category: rule.category,
          scope: rule.scope,
          condition: isAllowedCondition(rule.condition) ? rule.condition : 'ALWAYS',
          conditionConfig: rule.conditionConfig ?? {},
          action: isAllowedAction(rule.action) ? rule.action : 'COUNT_NORMAL',
          actionConfig: {
            ...(rule.actionConfig ?? {}),
            multiplier: rule.actionConfig?.multiplier != null ? sanitizeMultiplier(rule.actionConfig.multiplier) : undefined,
            runs: rule.actionConfig?.runs != null ? sanitizeDelta(rule.actionConfig.runs) : undefined,
          },
          priority: rule.priority ?? index,
          enabled: rule.enabled ?? true,
          affects: { ...DEFAULT_RULE_AFFECTS, ...rule.affects },
        })),
      };
    } else {
      const set = input.version
        ? await this.prisma.tournamentRuleSet.findUnique({
            where: { tournamentId_version: { tournamentId, version: input.version } },
            include: { rules: true },
          })
        : await this.prisma.tournamentRuleSet.findFirst({
            where: { tournamentId, enabled: true },
            include: { rules: true },
            orderBy: { version: 'desc' },
          });
      snapshot = set
        ? { enabled: true, version: set.version, rules: set.rules.map(toEngineRule) }
        : { enabled: false, version: 0, rules: [] };
    }
    return previewTournamentRule({
      snapshot,
      over: input.over,
      ball: input.ball,
      actualRuns: input.actualRuns,
      isWicket: input.isWicket,
    });
  }

  async snapshotForMatch(tx: Prisma.TransactionClient, matchId: string) {
    const existing = await tx.matchRuleSnapshot.findUnique({ where: { matchId } });
    if (existing) return existing;
    const match = await tx.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
    if (!match?.tournamentId) return null;
    const active = await tx.tournamentRuleSet.findFirst({
      where: { tournamentId: match.tournamentId, enabled: true },
      include: { rules: true },
      orderBy: { version: 'desc' },
    });
    const latest =
      active ??
      (await tx.tournamentRuleSet.findFirst({
        where: { tournamentId: match.tournamentId },
        include: { rules: true },
        orderBy: { version: 'desc' },
      }));
    if (!latest) return null;
    const payload: RuleSetSnapshot = {
      enabled: latest.enabled,
      version: latest.version,
      rules: latest.rules.map(toEngineRule),
      mvp: sanitizeMvpConfig(latest.mvpJson ?? DEFAULT_MVP_CONFIG),
    };
    return tx.matchRuleSnapshot.create({
      data: {
        matchId,
        ruleSetId: latest.id,
        version: latest.version,
        enabled: latest.enabled,
        rulesJson: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  engineSnapshot(row: { enabled: boolean; version: number; rulesJson: Prisma.JsonValue } | null): RuleSetSnapshot | null {
    if (!row?.enabled) return null;
    return snapshotFromJson(row.rulesJson);
  }

  async evaluateInnings(tx: Prisma.TransactionClient, matchId: string, inningsId: string) {
    const snap = await tx.matchRuleSnapshot.findUnique({ where: { matchId } });
    const snapshot = this.engineSnapshot(snap);
    if (!snapshot?.enabled) return null;
    const innings = await tx.innings.findUnique({
      where: { id: inningsId },
      include: { events: { orderBy: { sequence: 'asc' } } },
    });
    if (!innings) return null;
    const evaluation = evaluateInningsRules(
      snapshot,
      innings.events.map((e) => ({
        sequence: e.sequence,
        overNumber: e.overNumber + 1,
        ballInOver: e.ballInOver + 1,
        actualRuns: e.totalRuns,
        extraType: e.extraType,
        isWicket: e.isWicket,
        isUndone: e.isUndone,
        bowlerId: e.bowlerId,
      })),
    );
    await tx.ballRuleEvaluation.deleteMany({ where: { inningsId } });
    const liveEvents = innings.events.filter((e) => !e.isUndone);
    const bySequence = new Map(liveEvents.map((e) => [e.sequence, e]));
    const rows = evaluation.balls
      .map((b) => {
        const event = bySequence.get(b.sequence);
        if (!event) return null;
        return {
          matchId,
          inningsId,
          ballEventId: event.id,
          originalRuns: b.originalRuns,
          countedRuns: b.countedRuns,
          penaltyRuns: b.penaltyRuns,
          bonusRuns: b.bonusRuns,
          multiplier: b.multiplier,
          reason: b.reason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (rows.length) {
      await tx.ballRuleEvaluation.createMany({ data: rows });
    }
    const allInns = await tx.innings.findMany({ where: { matchId }, orderBy: { inningsNumber: 'asc' } });
    const derived = {
      innings: await Promise.all(
        allInns.map(async (inn) => {
          if (inn.id === inningsId) {
            return { inningsNumber: inn.inningsNumber, actualRuns: evaluation.actualTotal, countedRuns: evaluation.countedTotal, wickets: inn.totalWickets };
          }
          const rows = await tx.ballRuleEvaluation.findMany({ where: { inningsId: inn.id } });
          return {
            inningsNumber: inn.inningsNumber,
            actualRuns: inn.totalRuns,
            countedRuns: rows.length ? rows.reduce((s, r) => s + r.countedRuns, 0) : inn.totalRuns,
            wickets: inn.totalWickets,
          };
        }),
      ),
    };
    await tx.matchRuleSnapshot.update({
      where: { matchId },
      data: { derivedJson: derived as unknown as Prisma.InputJsonValue },
    });
    return { evaluation, snapshot };
  }

  async countedTotal(tx: Prisma.TransactionClient, matchId: string, inningsId: string, fallback: number) {
    const snap = await tx.matchRuleSnapshot.findUnique({ where: { matchId } });
    const snapshot = this.engineSnapshot(snap);
    if (!snapshot || !rulesAffect(snapshot, 'matchResult')) return fallback;
    const rows = await tx.ballRuleEvaluation.findMany({ where: { inningsId } });
    if (!rows.length) return fallback;
    return rows.reduce((s, r) => s + r.countedRuns, 0);
  }

  async resultInnings(
    tx: Prisma.TransactionClient,
    matchId: string,
    innings: Array<{ id: string; inningsNumber: number; battingTeamId: string; totalRuns: number; totalWickets: number; status: string }>,
  ) {
    const snap = await tx.matchRuleSnapshot.findUnique({ where: { matchId } });
    const snapshot = this.engineSnapshot(snap);
    const useAdjusted = rulesAffect(snapshot, 'matchResult');
    return Promise.all(
      innings.map(async (i) => ({
        inningsNumber: i.inningsNumber,
        battingTeamId: i.battingTeamId,
        totalRuns: useAdjusted ? await this.countedTotal(tx, matchId, i.id, i.totalRuns) : i.totalRuns,
        totalWickets: i.totalWickets,
        isComplete: i.status === 'COMPLETED',
      })),
    );
  }

  async matchRules(matchId: string, opts?: { includeRules?: boolean }) {
    const snap = await this.prisma.matchRuleSnapshot.findUnique({ where: { matchId } });
    if (!snap) return { enabled: false, version: 0, rules: [], evaluations: [], summary: [], affectsMatchResult: false };
    const evaluations = await this.prisma.ballRuleEvaluation.findMany({
      where: { matchId },
      include: { ballEvent: { select: { sequence: true } } },
    });
    evaluations.sort((a, b) => a.ballEvent.sequence - b.ballEvent.sequence);
    const snapshot = this.engineSnapshot(snap);
    return {
      enabled: Boolean(snapshot?.enabled),
      version: snap.version,
      locked: true,
      summary: publicRuleSummary(snapshot),
      rules: opts?.includeRules === false ? [] : snapshot?.rules ?? [],
      derived: snap.derivedJson,
      affectsMatchResult: rulesAffect(snapshot, 'matchResult'),
      evaluations: evaluations.map((e) => ({
        ballEventId: e.ballEventId,
        sequence: e.ballEvent.sequence,
        originalRuns: e.originalRuns,
        countedRuns: e.countedRuns,
        penaltyRuns: e.penaltyRuns,
        bonusRuns: e.bonusRuns,
        multiplier: e.multiplier,
        reason: e.reason,
      })),
    };
  }

  async liveOverlay(matchId: string) {
    const full = await this.matchRules(matchId, { includeRules: false });
    if (!full.enabled || full.summary.length === 0) return null;
    const last = full.evaluations.at(-1);
    const derived = full.derived as { innings?: Array<{ inningsNumber: number; actualRuns: number; countedRuns: number; wickets?: number }> } | null;
    const current = derived?.innings?.at(-1);
    return {
      active: true,
      version: full.version,
      summary: full.summary,
      lastBall:
        last && last.originalRuns !== last.countedRuns
          ? { actual: last.originalRuns, counted: last.countedRuns, reason: last.reason }
          : null,
      score: current ? { actual: current.actualRuns, counted: current.countedRuns } : null,
      affectsMatchResult: full.affectsMatchResult,
      innings: derived?.innings ?? [],
      evaluations: full.evaluations.map((e) => ({
        ballEventId: e.ballEventId,
        sequence: e.sequence,
        originalRuns: e.originalRuns,
        countedRuns: e.countedRuns,
        reason: e.reason,
      })),
    };
  }

  publicOverlay(snap: { enabled: boolean; version: number; rulesJson: Prisma.JsonValue; derivedJson: Prisma.JsonValue | null } | null, last?: { originalRuns: number; countedRuns: number; display?: string; reason: string } | null) {
    const snapshot = this.engineSnapshot(snap);
    const summary = publicRuleSummary(snapshot);
    if (!snapshot?.enabled || summary.length === 0) return null;
    const derived = snap?.derivedJson as { innings?: Array<{ inningsNumber: number; actualRuns: number; countedRuns: number }> } | null;
    const current = derived?.innings?.at(-1);
    return {
      active: true,
      summary,
      lastBall:
        last && last.originalRuns !== last.countedRuns
          ? { actual: last.originalRuns, counted: last.countedRuns, reason: last.reason }
          : null,
      score: current ? { actual: current.actualRuns, counted: current.countedRuns } : null,
      affectsMatchResult: rulesAffect(snapshot, 'matchResult'),
    };
  }
}
