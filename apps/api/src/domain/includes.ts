export const teamInclude = {
  club: true,
  stats: true,
  players: { where: { leftAt: null }, include: { player: { include: { profile: true } } } },
  _count: { select: { players: { where: { leftAt: null } } } },
} as const;

export const matchInclude = {
  homeTeam: { include: teamInclude },
  awayTeam: { include: teamInclude },
  resultWinner: { select: { id: true, name: true, logoUrl: true } },
  innings: { orderBy: { inningsNumber: 'asc' as const } },
  players: {
    orderBy: { battingOrder: 'asc' as const },
    include: { player: { include: { profile: true } } },
  },
      tournament: {
        select: {
          id: true,
          name: true,
          season: true,
          coverImageUrl: true,
          createdById: true,
          publicSlug: true,
          visibility: true,
          groups: {
        select: {
          id: true,
          name: true,
          teams: { select: { teamId: true } },
        },
      },
    },
  },
} as const;

export const tournamentInclude = {
  club: true,
  groups: {
    orderBy: { sortOrder: 'asc' as const },
    include: { teams: { include: { team: { include: teamInclude } } } },
  },
  matches: { include: matchInclude, orderBy: { scheduledAt: 'desc' as const } },
  _count: { select: { matches: true } },
} as const;
