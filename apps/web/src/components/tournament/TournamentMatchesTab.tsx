import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Match, TournamentDashboard } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { MatchCard } from '@/components/home/MatchCard';
import { isLiveMatch, isUpcomingMatch } from '@/lib/roles';
import { resultHeadline } from '@/lib/match-result';
import { formatMatchWhen } from '@/lib/format';

type Filter = 'all' | 'upcoming' | 'live' | 'completed' | 'abandoned' | 'cancelled';

export function TournamentMatchesTab({
  matches,
  canStart,
  tournamentId,
}: {
  matches: Match[];
  canStart: boolean;
  tournamentId: string;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const list = matches.filter((m) => {
    if (filter === 'live') return isLiveMatch(m.status);
    if (filter === 'upcoming') return isUpcomingMatch(m.status);
    if (filter === 'completed') return m.status === 'COMPLETED';
    if (filter === 'abandoned') return m.status === 'ABANDONED';
    if (filter === 'cancelled') return m.status === 'CANCELLED';
    return true;
  });
  return (
    <div className="flex flex-col gap-3 p-[var(--gutter)]">
      <div className="flex flex-wrap gap-2">
        {(['all', 'upcoming', 'live', 'completed', 'abandoned', 'cancelled'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-touch rounded-pill px-3 text-sm font-semibold ${filter === id ? 'bg-primary text-on-dark' : 'bg-muted text-text-secondary'}`}
            onClick={() => setFilter(id)}
          >
            {id === 'all' ? t('match.filterAll') : t(`match.${id}`)}
          </button>
        ))}
        {canStart ? (
          <Link to={`/matches/new?tournamentId=${tournamentId}`} className="ms-auto">
            <Button variant="primaryDark">{t('drawer.startMatch')}</Button>
          </Link>
        ) : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        {list.length ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-text-secondary">
                <th className="py-2 text-start">{t('common.matches')}</th>
                <th className="py-2 text-start">{t('match.teams')}</th>
                <th className="py-2 text-start">{t('common.date')}</th>
                <th className="py-2 text-start">{t('match.status')}</th>
                <th className="py-2 text-start">{t('tournaments.result')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, i) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="py-2">
                    <Link to={`/matches/${m.id}/centre`} className="font-semibold text-primary">
                      {m.title || `${t('common.matches')} ${i + 1}`}
                    </Link>
                  </td>
                  <td className="py-2">
                    {m.homeTeam.name} vs {m.awayTeam.name}
                  </td>
                  <td className="py-2">{formatMatchWhen(m.scheduledAt)}</td>
                  <td className="py-2 uppercase">{m.status.replace('_', ' ')}</td>
                  <td className="py-2">{matchResult(m, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      <div className="grid gap-3 md:hidden">
        {list.map((m) => (
          <MatchCard key={m.id} match={m} layout="list" />
        ))}
      </div>
      {list.length === 0 ? <EmptyState title={t('home.noMatches')} info={t('info.match.noMatches')} /> : null}
    </div>
  );
}

export function TournamentScorecardsTab({ dash }: { dash: TournamentDashboard }) {
  const { t } = useTranslation();
  if (!dash.scorecards.length) {
    return <EmptyState title={t('tournaments.noScorecards')} hint={t('tournaments.statsAfterMatches')} />;
  }
  return (
    <div className="grid gap-3 p-[var(--gutter)] sm:grid-cols-2">
      {dash.scorecards.map((row, i) => (
        <article key={row.matchId} className="rounded-xl border border-border p-4">
          <p className="text-xs font-bold uppercase text-text-secondary">
            {t('common.matches')} {i + 1}
          </p>
          <p className="mt-1 font-bold">
            {row.homeName} vs {row.awayName}
          </p>
          {row.result ? <p className="text-sm text-text-secondary">{row.result}</p> : null}
          <Link to={`/matches/${row.matchId}/centre`} className="mt-3 inline-block text-sm font-semibold text-primary">
            {t('result.viewScorecard')}
          </Link>
        </article>
      ))}
    </div>
  );
}

function matchResult(m: Match, t: (k: string) => string) {
  if (m.status !== 'COMPLETED') return '—';
  const winner =
    m.resultWinnerTeamId === m.awayTeam.id ? m.awayTeam.name : m.resultWinnerTeamId === m.homeTeam.id ? m.homeTeam.name : null;
  return resultHeadline({
    resultType: m.resultType,
    winnerName: winner,
    marginType: m.marginType,
    marginValue: m.marginValue,
    labels: {
      completed: t('match.final'),
      wonBy: t('result.wonBy'),
      runs: t('result.runs'),
      wickets: t('result.wickets'),
      tie: t('result.tie'),
      noResult: t('result.noResult'),
      abandoned: t('result.abandoned'),
    },
  });
}
