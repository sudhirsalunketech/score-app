import { Inject, Injectable } from '@nestjs/common';
import { KnockoutRound, MatchFormat, MatchStatus, Prisma, TournamentLifecycle, TournamentStageType } from '@prisma/client';
import { z } from 'zod';
import { buildKnockoutPlan, groupKnockoutSlots, type KnockoutPairing } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';
import { PublicLiveService } from '../public-live/public-live.service';
const generateSchema = z.object({
  teamIds: z.array(z.string()).min(2).max(16).optional(),
  pairing: z.enum(['SEEDED', 'ADJACENT', 'MANUAL']).optional(),
  includeThirdPlace: z.boolean().optional(),
  fromGroups: z.boolean().optional(),
  qualifyPerGroup: z.number().int().min(1).max(8).optional(),
  venueText: z.string().max(120).optional(),
  scheduledAt: z.string().optional(),
  overs: z.number().int().min(1).max(90).optional(),
  maxWickets: z.number().int().min(1).max(10).optional(),
  ballsPerOver: z.number().int().min(4).max(8).optional(),
  manualPairs: z.array(z.tuple([z.string(), z.string()])).optional(),
});

@Injectable()
export class KnockoutService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(PublicLiveService) private readonly live: PublicLiveService,
  ) {}

  async getBracket(tournamentId: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        championTeam: { select: { id: true, name: true, logoUrl: true } },
        runnerUpTeam: { select: { id: true, name: true, logoUrl: true } },
        matches: {
          where: { knockoutRound: { not: null } },
          include: {
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
            resultWinner: { select: { id: true, name: true, logoUrl: true } },
          },
          orderBy: [{ knockoutRound: 'asc' }, { knockoutSlot: 'asc' }],
        },
      },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    return {
      stageType: tn.stageType,
      lifecycle: tn.lifecycle,
      pairingMode: tn.pairingMode,
      knockoutTeamCount: tn.knockoutTeamCount,
      includeThirdPlace: tn.includeThirdPlace,
      champion: tn.championTeam,
      runnerUp: tn.runnerUpTeam,
      rounds: groupKnockoutSlots(tn.matches),
    };
  }

  async generate(user: AuthUser, tournamentId: string, body: unknown) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_MATCHES');
    const input = generateSchema.parse(body ?? {});
    const tn = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { groups: { include: { teams: true } }, matches: { where: { knockoutRound: { not: null } } } },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (tn.matches.some((m) => m.status === MatchStatus.LIVE || m.status === MatchStatus.COMPLETED)) {
      throw Errors.invalidState('Knockout fixtures are locked because matches have already started.');
    }
    const teamIds = input.fromGroups
      ? await this.qualifyFromGroups(tournamentId, input.qualifyPerGroup ?? 2)
      : input.teamIds ?? tn.groups.flatMap((g) => g.teams.map((row) => row.teamId));
    const unique = [...new Set(teamIds)];
    const plan = buildKnockoutPlan({
      teamIds: unique,
      pairing: (input.pairing ?? tn.pairingMode) as KnockoutPairing,
      includeThirdPlace: input.includeThirdPlace ?? tn.includeThirdPlace,
      manualPairs: input.manualPairs,
    });

    await this.prisma.$transaction(async (tx) => {
      if (tn.matches.length) {
        await tx.match.deleteMany({
          where: {
            tournamentId,
            knockoutRound: { not: null },
            status: { in: [MatchStatus.DRAFT, MatchStatus.SCHEDULED, MatchStatus.TOSS_PENDING] },
          },
        });
      }
      const matchByKey = new Map<string, string>();
      for (const slot of plan) {
        const homeId = slot.homeTeamId ?? (await this.placeholder(tx, user.id, `${slot.title} home`)).id;
        const awayId = slot.awayTeamId ?? (await this.placeholder(tx, user.id, `${slot.title} away`)).id;
        const home = await tx.team.findUniqueOrThrow({ where: { id: homeId } });
        const away = await tx.team.findUniqueOrThrow({ where: { id: awayId } });
        const slug = await this.live.uniqueSlug(home.name, away.name);
        const row = await tx.match.create({
          data: {
            title: slot.round === 'FINAL' ? `${tn.name} Final` : `${slot.title}: ${home.name} vs ${away.name}`,
            status: MatchStatus.SCHEDULED,
            format: MatchFormat.T10,
            overs: input.overs ?? tn.defaultOvers ?? 5,
            maxWickets: input.maxWickets ?? tn.defaultMaxWickets ?? 7,
            ballsPerOver: input.ballsPerOver ?? tn.defaultBallsPerOver ?? 6,
            venueText: input.venueText,
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            tournamentId,
            knockoutRound: slot.round as KnockoutRound,
            knockoutSlot: slot.slot,
            homeTeamId: homeId,
            awayTeamId: awayId,
            createdById: user.id,
            publicSlug: slug,
            settings: {
              knockoutKey: slot.key,
              knockoutPlaceholder: !slot.homeTeamId || !slot.awayTeamId,
              homeSourceKey: slot.homeSourceKey,
              awaySourceKey: slot.awaySourceKey,
              loserHomeSourceKey: slot.round === 'THIRD_PLACE' ? slot.homeSourceKey : null,
              loserAwaySourceKey: slot.round === 'THIRD_PLACE' ? slot.awaySourceKey : null,
              widesCountAsLegal: tn.defaultWidesCountAsLegal,
              noBallsCountAsLegal: tn.defaultNoBallsCountAsLegal,
            } as Prisma.InputJsonValue,
          },
        });
        matchByKey.set(slot.key, row.id);
      }
      for (const slot of plan) {
        if (!slot.feedsIntoKey || !slot.feedsIntoSide) continue;
        const id = matchByKey.get(slot.key);
        const next = matchByKey.get(slot.feedsIntoKey);
        if (id && next) {
          await tx.match.update({
            where: { id },
            data: { feedsIntoMatchId: next, feedsIntoSide: slot.feedsIntoSide },
          });
        }
      }
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          stageType:
            tn.groups.length && tn.stageType === TournamentStageType.GROUP_STAGE
              ? TournamentStageType.GROUP_AND_KNOCKOUT
              : tn.stageType === TournamentStageType.GROUP_AND_KNOCKOUT
                ? TournamentStageType.GROUP_AND_KNOCKOUT
                : TournamentStageType.KNOCKOUT,
          lifecycle: TournamentLifecycle.ACTIVE,
          knockoutTeamCount: unique.length,
          includeThirdPlace: input.includeThirdPlace ?? tn.includeThirdPlace,
          pairingMode: input.pairing ?? tn.pairingMode,
        },
      });
      return [...matchByKey.values()];
    });
    return this.getBracket(tournamentId);
  }

  async advanceAfterResult(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match?.tournamentId || match.status !== MatchStatus.COMPLETED || !match.resultWinnerTeamId) return null;
    const winnerId = match.resultWinnerTeamId;
    const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    if (match.feedsIntoMatchId && match.feedsIntoSide) {
      await this.fillSide(match.feedsIntoMatchId, match.feedsIntoSide, winnerId);
    }
    const settings = (match.settings ?? {}) as Record<string, unknown>;
    const key = typeof settings.knockoutKey === 'string' ? settings.knockoutKey : null;
    if (key && match.knockoutRound === KnockoutRound.SEMI_FINAL) {
      const third = await this.prisma.match.findFirst({
        where: { tournamentId: match.tournamentId, knockoutRound: KnockoutRound.THIRD_PLACE },
      });
      if (third) {
        const thirdSettings = (third.settings ?? {}) as Record<string, unknown>;
        if (thirdSettings.loserHomeSourceKey === key) await this.fillSide(third.id, 'HOME', loserId);
        if (thirdSettings.loserAwaySourceKey === key) await this.fillSide(third.id, 'AWAY', loserId);
      }
    }
    if (match.knockoutRound === KnockoutRound.FINAL) {
      await this.prisma.tournament.update({
        where: { id: match.tournamentId },
        data: {
          lifecycle: TournamentLifecycle.COMPLETED,
          championTeamId: winnerId,
          runnerUpTeamId: loserId,
        },
      });
    }
    return this.getBracket(match.tournamentId);
  }

  private async fillSide(matchId: string, side: string, teamId: string) {
    const next = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!next) return;
    if (next.status !== MatchStatus.DRAFT && next.status !== MatchStatus.SCHEDULED && next.status !== MatchStatus.TOSS_PENDING) {
      return;
    }
    const homeTeamId = side === 'HOME' ? teamId : next.homeTeamId;
    const awayTeamId = side === 'AWAY' ? teamId : next.awayTeamId;
    if (homeTeamId === awayTeamId) return;
    const [home, away] = await Promise.all([
      this.prisma.team.findUniqueOrThrow({ where: { id: homeTeamId } }),
      this.prisma.team.findUniqueOrThrow({ where: { id: awayTeamId } }),
    ]);
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        homeTeamId,
        awayTeamId,
        title: next.knockoutRound === KnockoutRound.FINAL ? next.title.replace(/:.+$/, `: ${home.name} vs ${away.name}`) : `${home.name} vs ${away.name}`,
      },
    });
  }

  private async placeholder(tx: Prisma.TransactionClient, userId: string, label: string) {
    return tx.team.create({
      data: {
        name: `TBD · ${label}`,
        createdById: userId,
      },
    });
  }

  private async qualifyFromGroups(tournamentId: string, perGroup: number) {
    const points = await this.prisma.tournamentPoint.findMany({
      where: { tournamentId },
      orderBy: [{ points: 'desc' }, { nrr: 'desc' }],
    });
    const groups = await this.prisma.tournamentGroup.findMany({
      where: { tournamentId },
      include: { teams: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!groups.length) return points.slice(0, Math.max(2, perGroup * 2)).map((p) => p.teamId);
    const picked: string[] = [];
    for (const group of groups) {
      const ids = new Set(group.teams.map((t) => t.teamId));
      const ranked = points.filter((p) => ids.has(p.teamId)).slice(0, perGroup);
      picked.push(...ranked.map((p) => p.teamId));
    }
    return picked;
  }

  async patchConfig(user: AuthUser, tournamentId: string, body: unknown) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_EDIT');
    const input = z
      .object({
        stageType: z.nativeEnum(TournamentStageType).optional(),
        knockoutTeamCount: z.number().int().min(2).max(16).optional(),
        includeThirdPlace: z.boolean().optional(),
        pairingMode: z.enum(['SEEDED', 'ADJACENT', 'MANUAL']).optional(),
      })
      .parse(body ?? {});
    const live = await this.prisma.match.count({
      where: { tournamentId, knockoutRound: { not: null }, status: { in: [MatchStatus.LIVE, MatchStatus.COMPLETED] } },
    });
    if (live && (input.knockoutTeamCount != null || input.includeThirdPlace != null || input.pairingMode)) {
      throw Errors.invalidState('Knockout rules are locked because matches have started.');
    }
    await this.prisma.tournament.update({ where: { id: tournamentId }, data: input });
    return this.getBracket(tournamentId);
  }
}
