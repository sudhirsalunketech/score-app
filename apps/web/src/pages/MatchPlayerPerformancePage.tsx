import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';

type MatchPlayerStats = {
  match: {
    id: string;
    title: string;
    status: string;
    date: string;
    venue: string | null;
    result: string | null;
    homeTeam: { id: string; name: string; logoUrl: string | null };
    awayTeam: { id: string; name: string; logoUrl: string | null };
    tournament: { id: string; name: string; season: string | null } | null;
  };
  player: { id: string; name: string; photoUrl: string | null; profileCode: string };
  batting: { runs: number; balls: number; fours: number; sixes: number; sr: number; dismissal: string | null; dismissedBy: string | null } | null;
  bowling: { overs: string; runs: number; maidens: number; wickets: number; eco: number } | null;
  fielding: { catches: number; stumpings: number; runOuts: number };
  mvp: { batting: number; bowling: number; fielding: number; total: number };
  balls: Array<{
    sequence: number;
    overNumber: number;
    ballInOver: number;
    batsmanRuns: number;
    extraType: string;
    isWicket: boolean;
    role: string;
    isUndone: boolean;
  }>;
};

export function MatchPlayerPerformancePage() {
  const { id = '', playerId = '' } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.matchPlayerStats(id, playerId),
    queryFn: () => api<MatchPlayerStats>(`/api/v1/matches/${id}/players/${playerId}/statistics`),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const s = q.data;
  const balls = s.balls.filter((b) => !b.isUndone);
  return (
    <div className="px-[var(--gutter)] py-4">
      <p className="text-xs font-bold uppercase text-text-secondary">{t('playerHome.playerPerformance')}</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={s.player.name} src={s.player.photoUrl} size={56} />
        <div>
          <h1 className="text-xl font-bold">{s.player.name}</h1>
          <p className="text-sm text-text-secondary">{s.match.title}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('common.tournaments')}</dt>
          <dd>{s.match.tournament?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('playerHome.date')}</dt>
          <dd>{new Date(s.match.date).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('playerHome.venue')}</dt>
          <dd>{s.match.venue ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('playerHome.result')}</dt>
          <dd>{s.match.result ?? s.match.status}</dd>
        </div>
      </dl>

      <h2 className="mt-6 text-sm font-bold uppercase text-primary">{t('profile.batting')}</h2>
      <StatGrid
        rows={[
          [t('profile.runs'), s.batting?.runs ?? 0],
          [t('profile.ballsFaced'), s.batting?.balls ?? 0],
          [t('profile.fours'), s.batting?.fours ?? 0],
          [t('profile.sixes'), s.batting?.sixes ?? 0],
          [t('profile.strikeRate'), s.batting?.sr ?? 0],
          [t('playerHome.dismissal'), s.batting?.dismissal ?? '—'],
          [t('playerHome.dismissedBy'), s.batting?.dismissedBy ?? '—'],
        ]}
      />

      <h2 className="mt-6 text-sm font-bold uppercase text-primary">{t('profile.bowling')}</h2>
      <StatGrid
        rows={[
          [t('profile.overs'), s.bowling?.overs ?? '0.0'],
          [t('profile.maidens'), s.bowling?.maidens ?? 0],
          [t('profile.runs'), s.bowling?.runs ?? 0],
          [t('profile.wickets'), s.bowling?.wickets ?? 0],
          [t('profile.economy'), s.bowling?.eco ?? 0],
        ]}
      />

      <h2 className="mt-6 text-sm font-bold uppercase text-primary">{t('profile.fielding')}</h2>
      <StatGrid
        rows={[
          [t('profile.catches'), s.fielding.catches],
          [t('profile.runouts'), s.fielding.runOuts],
          [t('profile.stumpings'), s.fielding.stumpings],
        ]}
      />

      <h2 className="mt-6 text-sm font-bold uppercase text-primary">{t('home.mvpPoints')}</h2>
      <p className="mt-2 text-2xl font-bold text-primary">{s.mvp.total}</p>
      <p className="text-xs text-text-secondary">
        {s.mvp.batting} {t('profile.bat')} · {s.mvp.bowling} {t('profile.bowl')} · {s.mvp.fielding} {t('profile.field')}
      </p>

      {balls.length ? (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase">{t('playerHome.relevantBalls')}</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {balls.map((b) => (
              <li key={`${b.sequence}-${b.role}`} className="flex justify-between py-2">
                <span>
                  {b.overNumber}.{b.ballInOver} · {b.role}
                </span>
                <span className="font-semibold">
                  {b.isWicket ? t('match.wicket') : b.batsmanRuns}
                  {b.extraType !== 'NONE' ? ` ${b.extraType}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Link to={`/matches/${s.match.id}/centre`} className="mt-6 inline-block text-sm font-bold text-primary">
        {t('match.view')}
      </Link>
    </div>
  );
}

function StatGrid({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border p-3">
          <dt className="text-[11px] uppercase text-text-secondary">{label}</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
