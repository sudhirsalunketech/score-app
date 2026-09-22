type TeamLite = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

type PublicPlayerInput = {
  id: string;
  name: string;
  photoUrl: string | null;
  role: string;
  profileCode: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  profile?: { jerseyNo: number | null; country?: string | null } | null;
  teams?: Array<{ jerseyNo: number | null; leftAt?: Date | string | null; team: TeamLite & { location?: string | null; club?: { city: string | null } | null } }>;
  careerStats?: Record<string, unknown> | null;
};

export function toPublicPlayer(player: PublicPlayerInput) {
  const currentTeams = (player.teams ?? []).filter((row) => row.leftAt == null);
  const city =
    player.profile?.country ??
    currentTeams.find((row) => row.team.location)?.team.location ??
    currentTeams.find((row) => row.team.club?.city)?.team.club?.city ??
    null;
  return {
    id: player.id,
    name: player.name,
    photoUrl: player.photoUrl,
    role: player.role,
    profileCode: player.profileCode,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle,
    city,
    profile: { jerseyNo: player.profile?.jerseyNo ?? null },
    teams: currentTeams.map((row) => ({
      jerseyNo: row.jerseyNo,
      current: true,
      team: {
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName,
        logoUrl: row.team.logoUrl,
      },
    })),
    formerTeams: (player.teams ?? [])
      .filter((row) => row.leftAt != null)
      .map((row) => ({
        jerseyNo: row.jerseyNo,
        current: false,
        team: {
          id: row.team.id,
          name: row.team.name,
          shortName: row.team.shortName,
          logoUrl: row.team.logoUrl,
        },
      })),
    careerStats: player.careerStats ?? null,
  };
}
