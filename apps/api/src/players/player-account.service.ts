import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { computeStreetMvp, formatOvers } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { toPublicPlayer } from '../catalog/public-player';
import { PlayerProfileService } from '../statistics/player-profile.service';
import { presentSlice } from '../statistics/player-profile-stats';
import { buildTournamentDashboard, playerStatsFromDashboard } from '../tournaments/tournament-dashboard';
import { ScoringService } from '../scoring/scoring.service';
import { matchInclude } from '../domain/includes';
import { matchDiscoveryWhere, tournamentDiscoveryWhere } from '../share/visibility';
import {
  dateRangeWhere,
  isCurrentTeamMember,
  matchInvolvesPlayer,
  paginated,
  parsePageLimit,
  statusesForGroup,
  type HistoryQuery,
} from './player-account.helpers';

@Injectable()
export class PlayerAccountService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PlayerProfileService) private readonly profiles: PlayerProfileService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
  ) {}

  async ensurePlayer(user: AuthUser) {
    const existing = await this.prisma.player.findUnique({ where: { userId: user.id } });
    if (existing) return existing;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await this.prisma.player.create({
          data: {
            userId: user.id,
            name: user.name,
            profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });
      } catch {
        /* profileCode collision */
      }
    }
    return this.prisma.player.findUnique({ where: { userId: user.id } });
  }

  async requireLinkedPlayer(user: AuthUser) {
    const player = await this.ensurePlayer(user);
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player profile not found');
    return player;
  }

  async mePlayer(user: AuthUser) {
    const linked = await this.requireLinkedPlayer(user);
    return this.publicPlayer(linked.id);
  }

  async publicPlayer(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        profile: true,
        careerStats: true,
        teams: {
          include: { team: { include: { club: true } } },
        },
      },
    });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const city =
      player.profile?.country ??
      player.teams.find((row) => row.team.location)?.team.location ??
      player.teams.find((row) => row.team.club?.city)?.team.club?.city ??
      null;
    return { ...toPublicPlayer(player), city };
  }

  async scopeForUser(user: AuthUser) {
    const player = await this.requireLinkedPlayer(user);
    return this.scopeForPlayer(player.id);
  }

  async scopeForPlayer(playerId: string) {
    const [memberships, appearances] = await Promise.all([
      this.prisma.teamPlayer.findMany({
        where: { playerId },
        select: { teamId: true, leftAt: true },
      }),
      this.prisma.matchPlayer.findMany({
        where: { playerId },
        select: { matchId: true, teamId: true },
      }),
    ]);
    return {
      playerId,
      currentTeamIds: memberships.filter((row) => isCurrentTeamMember(row.leftAt)).map((row) => row.teamId),
      allTeamIds: [...new Set([...memberships.map((row) => row.teamId), ...appearances.map((row) => row.teamId)])],
      playedMatchIds: appearances.map((row) => row.matchId),
    };
  }

  async meTeams(user: AuthUser) {
    const player = await this.requireLinkedPlayer(user);
    return this.playerTeams(player.id);
  }

  async playerTeams(playerId: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const rows = await this.prisma.teamPlayer.findMany({
      where: { playerId },
      include: {
        team: {
          include: {
            club: true,
            stats: true,
            _count: { select: { players: { where: { leftAt: null } } } },
            groupTeams: { include: { group: { include: { tournament: { select: { id: true, name: true, season: true } } } } } },
          },
        },
      },
      orderBy: [{ leftAt: 'asc' }, { joinedAt: 'desc' }],
    });
    return rows.map((row) => {
      const seasons = row.team.groupTeams.map((gt) => gt.group.tournament.season).filter(Boolean);
      return {
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName,
        logoUrl: row.team.logoUrl,
        club: row.team.club ? { id: row.team.club.id, name: row.team.club.name, city: row.team.club.city } : null,
        season: seasons[0] ?? null,
        players: row.team._count.players,
        matches: row.team.stats?.matches ?? 0,
        wins: row.team.stats?.wins ?? 0,
        losses: row.team.stats?.losses ?? 0,
        current: isCurrentTeamMember(row.leftAt),
        joinedAt: row.joinedAt.toISOString(),
        leftAt: row.leftAt?.toISOString() ?? null,
        role: row.role,
      };
    });
  }

  async mePlayedMatches(user: AuthUser, query?: HistoryQuery) {
    const player = await this.requireLinkedPlayer(user);
    return this.playerMatches(player.id, query);
  }

  historyWhere(query?: HistoryQuery): Prisma.MatchWhereInput[] {
    const statuses = statusesForGroup(query?.status);
    return [
      query?.tournamentId ? { tournamentId: query.tournamentId } : {},
      query?.teamId ? { OR: [{ homeTeamId: query.teamId }, { awayTeamId: query.teamId }] } : {},
      query?.season ? { tournament: { season: query.season } } : {},
      statuses ? { status: { in: statuses as Prisma.EnumMatchStatusFilter['in'] } } : {},
      dateRangeWhere(query?.from, query?.to),
    ];
  }

  async playerMatches(playerId: string, query?: HistoryQuery) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const scope = await this.scopeForPlayer(playerId);
    const participation = [
      ...(scope.playedMatchIds.length ? [{ id: { in: scope.playedMatchIds } }] : []),
      ...(scope.allTeamIds.length
        ? [{ homeTeamId: { in: scope.allTeamIds } }, { awayTeamId: { in: scope.allTeamIds } }]
        : []),
    ];
    const { page, limit, skip } = parsePageLimit(query?.page, query?.limit);
    if (!participation.length) return paginated([], 0, page, limit);
    const where: Prisma.MatchWhereInput = { AND: [{ OR: participation }, ...this.historyWhere(query)] };
    const [total, rows, appearances, profile] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        include: matchInclude,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.matchPlayer.findMany({ where: { playerId }, select: { matchId: true, teamId: true } }),
      this.profiles.build(playerId),
    ]);
    const byId = new Map(profile.view.matches.map((m) => [m.matchId, m]));
    const teamByMatch = new Map(appearances.map((row) => [row.matchId, row.teamId]));
    return paginated(
      rows.map((m) => {
        const teamId = teamByMatch.get(m.id) ?? (scope.allTeamIds.includes(m.homeTeamId) ? m.homeTeamId : m.awayTeamId);
        const team = teamId === m.homeTeamId ? m.homeTeam : m.awayTeam;
        const opponent = teamId === m.homeTeamId ? m.awayTeam : m.homeTeam;
        const perf = byId.get(m.id);
        return {
          match: m,
          tournament: m.tournament,
          team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
          opponent: { id: opponent.id, name: opponent.name, logoUrl: opponent.logoUrl },
          status: m.status,
          result: m.resultWinner?.name ?? m.resultType ?? m.status,
          playerPerformance: perf
            ? {
                runs: perf.batting?.runs ?? 0,
                balls: perf.batting?.balls ?? 0,
                wickets: perf.bowling?.wickets ?? 0,
                mvp: perf.mvp.total,
                batting: perf.batting,
                bowling: perf.bowling,
                fielding: perf.fielding,
              }
            : null,
        };
      }),
      total,
      page,
      limit,
    );
  }

  async meTournaments(user: AuthUser, query?: HistoryQuery) {
    const player = await this.requireLinkedPlayer(user);
    return this.playerTournaments(player.id, query);
  }

  async playerTournaments(playerId: string, query?: HistoryQuery) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const scope = await this.scopeForPlayer(playerId);
    const [fromMatches, fromTeams, fromTeamMatches] = await Promise.all([
      this.prisma.matchPlayer.findMany({
        where: { playerId, match: { tournamentId: { not: null } } },
        include: {
          match: {
            select: {
              tournamentId: true,
              tournament: { select: { id: true, name: true, season: true, coverImageUrl: true } },
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.teamPlayer.findMany({
        where: { playerId },
        include: {
          team: {
            include: {
              groupTeams: {
                include: { group: { include: { tournament: { select: { id: true, name: true, season: true, coverImageUrl: true } } } } },
              },
            },
          },
        },
      }),
      scope.allTeamIds.length
        ? this.prisma.match.findMany({
            where: {
              tournamentId: { not: null },
              OR: [{ homeTeamId: { in: scope.allTeamIds } }, { awayTeamId: { in: scope.allTeamIds } }],
            },
            select: {
              homeTeamId: true,
              awayTeamId: true,
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
              tournament: { select: { id: true, name: true, season: true, coverImageUrl: true } },
            },
            take: 80,
          })
        : Promise.resolve([]),
    ]);
    const map = new Map<
      string,
      { id: string; name: string; season: string | null; coverImageUrl: string | null; teamName: string | null }
    >();
    for (const row of fromMatches) {
      const tn = row.match.tournament;
      if (!tn) continue;
      if (query?.season && tn.season !== query.season) continue;
      const teamName = row.teamId === row.match.homeTeam.id ? row.match.homeTeam.name : row.match.awayTeam.name;
      map.set(tn.id, { id: tn.id, name: tn.name, season: tn.season, coverImageUrl: tn.coverImageUrl, teamName });
    }
    for (const row of fromTeams) {
      for (const gt of row.team.groupTeams) {
        const tn = gt.group.tournament;
        if (query?.season && tn.season !== query.season) continue;
        if (!map.has(tn.id)) {
          map.set(tn.id, {
            id: tn.id,
            name: tn.name,
            season: tn.season,
            coverImageUrl: tn.coverImageUrl,
            teamName: row.team.name,
          });
        }
      }
    }
    for (const match of fromTeamMatches) {
      const tn = match.tournament;
      if (!tn) continue;
      if (query?.season && tn.season !== query.season) continue;
      const teamName = scope.allTeamIds.includes(match.homeTeamId) ? match.homeTeam.name : match.awayTeam.name;
      if (!map.has(tn.id)) {
        map.set(tn.id, { id: tn.id, name: tn.name, season: tn.season, coverImageUrl: tn.coverImageUrl, teamName });
      }
    }
    const listed = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    const { page, limit, skip } = parsePageLimit(query?.page, query?.limit);
    const slice = listed.slice(skip, skip + limit);
    const items = [];
    for (const tn of slice) {
      const stats = await this.tournamentStatistics(playerId, tn.id);
      items.push({
        ...tn,
        team: stats.player.teamName || tn.teamName,
        matches: stats.matches,
        runs: stats.runs,
        wickets: stats.wickets,
        mvpPoints: stats.mvpPoints,
        rank: stats.mvpRank,
      });
    }
    return paginated(items, listed.length, page, limit);
  }

  async tournamentStatistics(playerId: string, tournamentId: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, season: true, coverImageUrl: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const dash = await buildTournamentDashboard(this.prisma, this.scoring, tournamentId);
    if (!dash) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const fromDash = playerStatsFromDashboard(dash, playerId);
    const profile = await this.profiles.build(playerId, { tournamentId });
    const slice = presentSlice(profile.overall);
    const ranked = [...dash.players].sort((a, b) => {
      const left = dash.batting.find((p) => p.playerId === a.playerId);
      const right = dash.batting.find((p) => p.playerId === b.playerId);
      return (right?.runs ?? 0) - (left?.runs ?? 0) || a.playerName.localeCompare(b.playerName);
    });
    const mvpSorted = [...dash.players]
      .map((p) => {
        const bat = dash.batting.find((row) => row.playerId === p.playerId);
        const bowl = dash.bowling.find((row) => row.playerId === p.playerId);
        const field = dash.fielding.find((row) => row.playerId === p.playerId);
        const mvp = computeStreetMvp({
          runs: bat?.runs ?? 0,
          ballsFaced: bat?.balls ?? 0,
          wickets: bowl?.wickets ?? 0,
          maidenOvers: bowl?.maidens ?? 0,
          catches: field?.catches ?? 0,
          stumpings: field?.stumpings ?? 0,
          runOuts: field?.runOuts ?? 0,
        });
        return { playerId: p.playerId, total: mvp.total };
      })
      .sort((a, b) => b.total - a.total);
    const mvpRank = mvpSorted.findIndex((row) => row.playerId === playerId);
    const tournamentRank = ranked.findIndex((row) => row.playerId === playerId);
    const mvp = profile.mvp;
    return {
      tournamentId: tn.id,
      tournamentName: tn.name,
      season: tn.season,
      coverImageUrl: tn.coverImageUrl,
      scope: 'tournament' as const,
      player: fromDash?.player ?? {
        playerId,
        playerName: 'Player',
        photoUrl: null,
        teamName: '',
      },
      matches: slice.matches || fromDash?.matches || 0,
      innings: slice.innings || fromDash?.innings || 0,
      runs: slice.runs,
      balls: slice.balls,
      average: slice.average,
      strikeRate: slice.sr,
      highest: slice.highest,
      fours: slice.fours,
      sixes: slice.sixes,
      fifties: slice.fifties,
      hundreds: slice.hundreds,
      wickets: slice.wickets,
      overs: slice.bowlBalls ? formatOvers(slice.bowlBalls) : fromDash?.overs ?? '0.0',
      runsConceded: slice.bowlRuns,
      economy: slice.economy,
      bowlingAverage: slice.bowlAverage,
      bestBowling: slice.best !== '—' ? slice.best : fromDash?.bestBowling ?? null,
      maidens: slice.maidens,
      dots: slice.dots,
      catches: slice.catches,
      runOuts: slice.runOuts,
      stumpings: slice.stumpings,
      mvpPoints: mvp.total,
      mvpBatting: mvp.batting,
      mvpBowling: mvp.bowling,
      mvpFielding: mvp.fielding,
      mvpRank: mvpRank >= 0 ? mvpRank + 1 : null,
      tournamentRank: tournamentRank >= 0 ? tournamentRank + 1 : null,
      matchesDetail: profile.view.matches,
    };
  }

  async isTeamParticipant(user: AuthUser | null, teamId: string) {
    if (!user) return false;
    const player = await this.prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const row = await this.prisma.teamPlayer.findFirst({ where: { teamId, playerId: player.id }, select: { id: true } });
    return Boolean(row);
  }

  async teamMatches(teamId: string, user: AuthUser | null, query?: HistoryQuery) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    const member = await this.isTeamParticipant(user, teamId);
    const { page, limit, skip } = parsePageLimit(query?.page, query?.limit);
    const where: Prisma.MatchWhereInput = {
      AND: [
        { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        member ? {} : matchDiscoveryWhere(user),
        ...this.historyWhere(query),
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        include: {
          homeTeam: { select: { id: true, name: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, logoUrl: true } },
          tournament: { select: { id: true, name: true, season: true } },
          resultWinner: { select: { id: true, name: true } },
          innings: { select: { battingTeamId: true, totalRuns: true, totalWickets: true }, orderBy: { inningsNumber: 'asc' } },
        },
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return paginated(
      rows.map((m) => {
        const homeInn = m.innings.find((i) => i.battingTeamId === m.homeTeam.id);
        const awayInn = m.innings.find((i) => i.battingTeamId === m.awayTeam.id);
        return {
          id: m.id,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          date: m.scheduledAt?.toISOString() ?? null,
          tournament: m.tournament,
          status: m.status,
          result: m.resultWinner?.name ?? m.resultType ?? m.status,
          score: {
            home: homeInn ? `${homeInn.totalRuns}/${homeInn.totalWickets}` : null,
            away: awayInn ? `${awayInn.totalRuns}/${awayInn.totalWickets}` : null,
          },
        };
      }),
      total,
      page,
      limit,
    );
  }

  async teamTournaments(teamId: string, user: AuthUser | null, query?: HistoryQuery) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    const member = await this.isTeamParticipant(user, teamId);
    const { page, limit, skip } = parsePageLimit(query?.page, query?.limit);
    const groups = await this.prisma.tournamentGroupTeam.findMany({
      where: {
        teamId,
        group: {
          tournament: {
            AND: [
              member ? {} : tournamentDiscoveryWhere(user),
              query?.season ? { season: query.season } : {},
            ],
          },
        },
      },
      include: {
        group: { include: { tournament: { select: { id: true, name: true, season: true, coverImageUrl: true } } } },
      },
    });
    const unique = new Map(groups.map((row) => [row.group.tournament.id, row.group.tournament]));
    const listed = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    const slice = listed.slice(skip, skip + limit);
    const ids = slice.map((tn) => tn.id);
    const points = ids.length
      ? await this.prisma.tournamentPoint.findMany({ where: { teamId, tournamentId: { in: ids } } })
      : [];
    const allPoints = ids.length
      ? await this.prisma.tournamentPoint.findMany({ where: { tournamentId: { in: ids } } })
      : [];
    const rankOf = (tournamentId: string) => {
      const table = allPoints
        .filter((row) => row.tournamentId === tournamentId)
        .sort((a, b) => b.points - a.points || b.nrr - a.nrr);
      const idx = table.findIndex((row) => row.teamId === teamId);
      return idx >= 0 ? idx + 1 : null;
    };
    const items = slice.map((tn) => {
      const row = points.find((p) => p.tournamentId === tn.id);
      return {
        id: tn.id,
        name: tn.name,
        season: tn.season,
        coverImageUrl: tn.coverImageUrl,
        position: rankOf(tn.id),
        matches: row?.played ?? 0,
        wins: row?.won ?? 0,
        losses: row?.lost ?? 0,
        nrr: row?.nrr ?? 0,
        points: row?.points ?? 0,
      };
    });
    return paginated(items, listed.length, page, limit);
  }

  involvedMatches<T extends { id: string; homeTeamId: string; awayTeamId: string }>(
    matches: T[],
    currentTeamIds: string[],
    playedMatchIds: string[],
  ) {
    return matches.filter((m) => matchInvolvesPlayer(m, currentTeamIds, playedMatchIds));
  }
}
