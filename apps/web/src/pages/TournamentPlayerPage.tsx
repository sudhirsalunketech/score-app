import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { TournamentPlayerStats } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { IconBack } from '@/components/ui/Icons';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { fmtAvg } from '@/components/tournament/dash-ui';

export function TournamentPlayerPage() {
  const { id = '', playerId = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: keys.playerTournamentStats(playerId, id),
    queryFn: () => api<TournamentPlayerStats>(`/api/v1/players/${playerId}/tournaments/${id}/statistics`),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const s = q.data;
  const rows = [
    { label: t('profile.matches'), value: s.matches },
    { label: t('tournaments.innings'), value: s.innings },
    { label: t('profile.runs'), value: s.runs },
    { label: t('profile.ballsFaced'), value: s.balls },
    { label: t('tournaments.average'), value: fmtAvg(s.average) },
    { label: t('tournaments.strikeRate'), value: s.strikeRate.toFixed(1) },
    { label: t('tournaments.highest'), value: s.highest },
    { label: t('profile.fours'), value: s.fours ?? 0 },
    { label: t('profile.sixes'), value: s.sixes ?? 0 },
    { label: t('profile.fifties'), value: s.fifties ?? 0 },
    { label: t('profile.hundreds'), value: s.hundreds ?? 0 },
    { label: t('profile.wickets'), value: s.wickets },
    { label: t('profile.overs'), value: s.overs },
    { label: t('playerHome.runsConceded'), value: s.runsConceded ?? 0 },
    { label: t('tournaments.economy'), value: s.economy.toFixed(2) },
    { label: t('tournaments.bestBowling'), value: s.bestBowling ?? '—' },
    { label: t('tournaments.catches'), value: s.catches },
    { label: t('tournaments.runOuts'), value: s.runOuts },
    { label: t('home.mvpPoints'), value: s.mvpPoints ?? 0 },
    { label: t('playerHome.mvpRank'), value: s.mvpRank ?? '—' },
  ];
  return (
    <div className="px-[var(--gutter)] py-4">
      <button type="button" className="touch-target inline-flex items-center gap-1" onClick={() => nav(-1)}>
        <IconBack />
        <span className="text-sm font-semibold">{t('common.back')}</span>
      </button>
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={s.player.playerName} src={s.player.photoUrl} size={64} />
        <div>
          <h1 className="text-xl font-bold">{s.player.playerName}</h1>
          <p className="text-xs uppercase text-text-secondary">{s.player.teamName}</p>
          <p className="mt-1 text-sm font-semibold">{s.tournamentName}</p>
          {s.season ? <p className="text-xs text-text-secondary">{s.season}</p> : null}
          <p className="text-xs text-text-secondary">{t('tournaments.playerScope')}</p>
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
      {(s.matchesDetail ?? []).length ? (
        <div className="mt-8">
          <h2 className="text-sm font-bold uppercase">{t('playerHome.matchByMatch')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {s.matchesDetail!.map((m, i) => (
              <li key={m.matchId} className="rounded-xl border border-border p-3">
                <p className="text-xs font-bold uppercase text-text-secondary">{t('playerHome.matchN', { n: i + 1 })}</p>
                <Link to={`/matches/${m.matchId}/player/${playerId}`} className="mt-1 block font-semibold">
                  {m.homeName} vs {m.awayName}
                </Link>
                <p className="text-xs text-text-secondary">{m.when ? new Date(m.when).toLocaleDateString() : ''}</p>
                <p className="mt-2 text-sm">
                  {t('profile.batting')}: {m.batting ? `${m.batting.runs} (${m.batting.balls})` : '—'}
                </p>
                <p className="text-sm">
                  {t('profile.bowling')}: {m.bowling ? `${m.bowling.wickets}-${m.bowling.runs}` : '—'}
                </p>
                <p className="text-sm">
                  {t('profile.fielding')}: {m.fielding.catches} {t('profile.catches')}
                </p>
                <p className="text-sm font-semibold">
                  {t('home.mvpPoints')}: {m.mvp.total}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link to={`/players/${playerId}`} className="mt-6 inline-block text-sm font-semibold text-primary">
        {t('tournaments.viewGlobalProfile')}
      </Link>
    </div>
  );
}
