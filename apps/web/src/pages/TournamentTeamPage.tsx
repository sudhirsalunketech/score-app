import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { TournamentDashboard } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { IconBack } from '@/components/ui/Icons';
import { EmptyStats } from '@/components/tournament/dash-ui';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';

export function TournamentTeamPage() {
  const { id = '', teamId = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: keys.tournamentDashboard(id),
    queryFn: () => api<TournamentDashboard>(`/api/v1/tournaments/${id}/dashboard`),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const team = q.data.teams.find((x) => x.teamId === teamId);
  if (!team) {
    return (
      <div className="p-[var(--gutter)]">
        <EmptyStats title={t('tournaments.noTeams')} />
      </div>
    );
  }
  const rows = [
    { label: t('profile.matches'), value: team.matches },
    { label: t('tournaments.won'), value: team.won },
    { label: t('tournaments.lost'), value: team.lost },
    { label: t('tournaments.tied'), value: team.tied },
    { label: t('tournaments.noResult'), value: team.noResult },
    { label: t('tournaments.pts'), value: team.points },
    { label: t('tournaments.runsScored'), value: team.runsScored },
    { label: t('tournaments.runsConceded'), value: team.runsConceded },
    { label: t('profile.wickets'), value: team.wickets },
  ];
  return (
    <div className="px-[var(--gutter)] py-4">
      <button type="button" className="touch-target inline-flex items-center gap-1" onClick={() => nav(-1)}>
        <IconBack />
        <span className="text-sm font-semibold">{t('common.back')}</span>
      </button>
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={team.teamName} src={team.logoUrl} kind="team" size={64} />
        <div>
          <h1 className="text-xl font-bold uppercase">{team.teamName}</h1>
          <p className="text-sm text-text-secondary">{q.data.header.name}</p>
          <p className="text-xs text-text-secondary">{t('tournaments.teamScope')}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border p-3">
            <dt className="text-[11px] uppercase text-text-secondary">{row.label}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {team.bestBatsman ? (
        <Link to={`/tournaments/${id}/players/${team.bestBatsman.playerId}`} className="mt-4 block rounded-xl border border-border p-3">
          <p className="text-xs uppercase text-text-secondary">{t('tournaments.bestBatsman')}</p>
          <p className="font-bold">
            {team.bestBatsman.playerName} · {team.bestBatsman.runs}
          </p>
        </Link>
      ) : null}
      {team.bestBowler ? (
        <Link to={`/tournaments/${id}/players/${team.bestBowler.playerId}`} className="mt-3 block rounded-xl border border-border p-3">
          <p className="text-xs uppercase text-text-secondary">{t('tournaments.bestBowler')}</p>
          <p className="font-bold">
            {team.bestBowler.playerName} · {team.bestBowler.wickets}
          </p>
        </Link>
      ) : null}
      <Link to={`/teams/${teamId}`} className="mt-6 inline-block text-sm font-semibold text-primary">
        {t('tournaments.viewTeamProfile')}
      </Link>
    </div>
  );
}
