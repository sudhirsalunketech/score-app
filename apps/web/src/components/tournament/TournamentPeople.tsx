import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import type { Team, TournamentDashboard } from '@/types/api';

export function TournamentPlayersTab({ tournamentId, dash }: { tournamentId: string; dash: TournamentDashboard }) {
  const { t } = useTranslation();
  if (!dash.players.length) {
    return <EmptyState title={t('tournaments.noPlayerStats')} hint={t('tournaments.statsAfterMatches')} />;
  }
  return (
    <div className="grid gap-3 p-[var(--gutter)] sm:grid-cols-2 lg:grid-cols-3">
      {dash.players.map((p) => (
        <Link
          key={p.playerId}
          to={`/tournaments/${tournamentId}/players/${p.playerId}`}
          className="flex items-center gap-3 rounded-xl border border-border p-3"
        >
          <Avatar name={p.playerName} src={p.photoUrl} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{p.playerName}</p>
            <p className="text-xs uppercase text-text-secondary">{p.teamName}</p>
            <p className="text-xs text-text-secondary">
              {p.runs} {t('profile.runs').toLowerCase()} · {p.wickets} {t('profile.wickets').toLowerCase()}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function TournamentTeamsTab({
  tournamentId,
  dash,
  teams,
  canTeams,
  onAddTeam,
  onCreateTeam,
}: {
  tournamentId: string;
  dash: TournamentDashboard | undefined;
  teams: Team[];
  canTeams: boolean;
  onAddTeam: () => void;
  onCreateTeam: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="p-[var(--gutter)]">
      {canTeams ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="primaryDark" onClick={onAddTeam}>
            {t('tournaments.addTeam')}
          </Button>
          <Button variant="outline" onClick={onCreateTeam}>
            {t('teams.create')}
          </Button>
        </div>
      ) : null}
      {teams.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const stats = dash?.teams.find((x) => x.teamId === team.id);
            return (
              <Link
                key={team.id}
                to={`/tournaments/${tournamentId}/teams/${team.id}`}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={team.name} src={team.logoUrl} kind="team" size={56} />
                  <div>
                    <p className="font-bold uppercase">{team.name}</p>
                    {team.club?.name ? <p className="text-xs text-text-secondary">{team.club.name}</p> : null}
                  </div>
                </div>
                {stats ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    {t('tournaments.played')}: {stats.matches} · {t('tournaments.won')}: {stats.won} · {t('tournaments.pts')}:{' '}
                    {stats.points}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title={t('tournaments.noTeams')} hint={canTeams ? t('tournaments.addTeamHint') : undefined} info={t('info.tournament.noTeams')} />
      )}
    </div>
  );
}
