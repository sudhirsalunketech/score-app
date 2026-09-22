import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { ManualStandingInput } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';

const RESULTS = ['WON', 'LOST', 'TIED', 'NO_RESULT'] as const;

const manualMatchSchema = z.object({
  title: z.string().trim().min(1).max(120),
  playedAt: z.string(),
  result: z.enum(RESULTS),
  runsScored: z.number().int().min(0).max(9999),
  runsConceded: z.number().int().min(0).max(9999),
  ballsFaced: z.number().int().min(0).max(9999),
  ballsBowled: z.number().int().min(0).max(9999),
  ballsPerOver: z.number().int().min(4).max(8).optional(),
});

const qualifyStatusSchema = z.object({ status: z.enum(['QUALIFIED', 'ELIMINATED']).nullable() });

type ManualMatchClient = { tournamentManualMatch: { findMany: (args: { where: { tournamentId: string } }) => Promise<Array<{
  teamId: string;
  result: string;
  runsScored: number;
  runsConceded: number;
  ballsFaced: number;
  ballsBowled: number;
  ballsPerOver: number;
}>> } };

/** Every manual match a team has logged in this tournament, folded into one `ManualStandingInput`
 * per team — the additive contribution `computeGroupStandings` combines with real matches. */
export async function manualStandingInputs(prisma: ManualMatchClient, tournamentId: string): Promise<ManualStandingInput[]> {
  const rows = await prisma.tournamentManualMatch.findMany({ where: { tournamentId } });
  const byTeam = new Map<string, ManualStandingInput>();
  for (const row of rows) {
    const acc =
      byTeam.get(row.teamId) ??
      ({ teamId: row.teamId, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, runsFor: 0, runsAgainst: 0, oversFaced: 0, oversBowled: 0 } as ManualStandingInput);
    acc.played += 1;
    if (row.result === 'WON') acc.won += 1;
    else if (row.result === 'LOST') acc.lost += 1;
    else if (row.result === 'TIED') acc.tied += 1;
    else acc.noResult += 1;
    acc.runsFor += row.runsScored;
    acc.runsAgainst += row.runsConceded;
    const bpo = Math.max(1, row.ballsPerOver);
    acc.oversFaced += row.ballsFaced / bpo;
    acc.oversBowled += row.ballsBowled / bpo;
    byTeam.set(row.teamId, acc);
  }
  return [...byTeam.values()];
}

/**
 * Manual "Match Wise Points" entry — a fixture never scored through this app's live engine,
 * typed in by an admin so it still counts toward a team's Points/NRR. Additive only: real
 * completed `Match` rows stay fully automatic and are never edited through this path. See
 * `ManualStandingInput` (packages/shared) for how these fold into `computeGroupStandings`.
 */
@Injectable()
export class ManualMatchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  private async assertTeamInTournament(tournamentId: string, teamId: string) {
    const row = await this.prisma.tournamentGroupTeam.findFirst({ where: { teamId, group: { tournamentId } } });
    if (!row) throw Errors.notFound('TEAM_NOT_IN_TOURNAMENT', 'This team is not in this tournament.');
    return row;
  }

  async list(tournamentId: string, teamId: string) {
    return this.prisma.tournamentManualMatch.findMany({
      where: { tournamentId, teamId },
      orderBy: { playedAt: 'desc' },
    });
  }

  /** Returns the created row; caller is responsible for refreshing the cached `TournamentPoint` standings afterward. */
  async create(user: AuthUser, tournamentId: string, teamId: string, body: unknown) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_TEAMS');
    await this.assertTeamInTournament(tournamentId, teamId);
    const input = manualMatchSchema.parse(body);
    return this.prisma.tournamentManualMatch.create({
      data: {
        tournamentId,
        teamId,
        title: input.title,
        playedAt: new Date(input.playedAt),
        result: input.result,
        runsScored: input.runsScored,
        runsConceded: input.runsConceded,
        ballsFaced: input.ballsFaced,
        ballsBowled: input.ballsBowled,
        ballsPerOver: input.ballsPerOver ?? 6,
        createdById: user.id,
      },
    });
  }

  /** See `create` — caller refreshes cached standings afterward. */
  async update(user: AuthUser, tournamentId: string, teamId: string, matchId: string, body: unknown) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_TEAMS');
    const existing = await this.prisma.tournamentManualMatch.findFirst({ where: { id: matchId, tournamentId, teamId } });
    if (!existing) throw Errors.notFound('NOT_FOUND', 'Manual match not found');
    const input = manualMatchSchema.parse(body);
    return this.prisma.tournamentManualMatch.update({
      where: { id: matchId },
      data: {
        title: input.title,
        playedAt: new Date(input.playedAt),
        result: input.result,
        runsScored: input.runsScored,
        runsConceded: input.runsConceded,
        ballsFaced: input.ballsFaced,
        ballsBowled: input.ballsBowled,
        ballsPerOver: input.ballsPerOver ?? existing.ballsPerOver,
      },
    });
  }

  /** See `create` — caller refreshes cached standings afterward. */
  async remove(user: AuthUser, tournamentId: string, teamId: string, matchId: string) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_TEAMS');
    const existing = await this.prisma.tournamentManualMatch.findFirst({ where: { id: matchId, tournamentId, teamId } });
    if (!existing) throw Errors.notFound('NOT_FOUND', 'Manual match not found');
    await this.prisma.tournamentManualMatch.delete({ where: { id: matchId } });
    return { deleted: true };
  }

  async setQualifyStatus(user: AuthUser, tournamentId: string, teamId: string, body: unknown) {
    await this.access.assertTournament(user, tournamentId, 'TOURNAMENT_MANAGE_TEAMS');
    const { status } = qualifyStatusSchema.parse(body);
    const memberships = await this.prisma.tournamentGroupTeam.findMany({ where: { teamId, group: { tournamentId } } });
    if (!memberships.length) throw Errors.notFound('TEAM_NOT_IN_TOURNAMENT', 'This team is not in this tournament.');
    await this.prisma.tournamentGroupTeam.updateMany({
      where: { teamId, group: { tournamentId } },
      data: { qualifyStatus: status },
    });
    return { status };
  }

  /** Every manual match a team has logged, folded into one `ManualStandingInput` per team. */
  async standingInputs(tournamentId: string): Promise<ManualStandingInput[]> {
    return manualStandingInputs(this.prisma, tournamentId);
  }
}
