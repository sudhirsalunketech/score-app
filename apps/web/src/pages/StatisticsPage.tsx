import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { MvpConfig, Page, StatRow } from '@/types/api';
import type { MyTournamentCard } from '@/pages/MyTournamentsPage';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DEFAULT_MVP_CONFIG, MvpPointsTable } from '@/components/tournament/MvpPointsTable';

const CATEGORIES = [
  'mostRuns',
  'mostWickets',
  'highestScore',
  'bestBowl',
  'bestEconomy',
  'mostMaidens',
  'bowlDots',
  'fastest50',
  'fastest100',
  'bestPartnership',
  'mostBalls',
  'mvp',
] as const;

export function StatisticsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? 'mostRuns';
  const tournamentId = params.get('tournamentId') ?? undefined;
  const [rulesOpen, setRulesOpen] = useState(false);
  const tournamentsQ = useQuery({
    queryKey: keys.myTournaments,
    queryFn: () => api<Page<MyTournamentCard>>('/api/v1/users/me/tournaments?limit=50'),
  });
  const setTournament = (next: string) => setParams(next ? { category, tournamentId: next } : { category });
  const q = useQuery({
    queryKey: keys.statistics(category, tournamentId),
    queryFn: () =>
      api<StatRow[] | { rows: StatRow[]; mvp?: MvpConfig }>(
        `/api/v1/statistics?category=${category}${tournamentId ? `&tournamentId=${tournamentId}` : ''}`,
      ),
    retry: false,
  });

  const rows = useMemo(() => {
    const d = q.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.rows)) return d.rows;
    return [];
  }, [q.data]);
  const mvpConfig = !Array.isArray(q.data) && q.data?.mvp ? q.data.mvp : DEFAULT_MVP_CONFIG;

  return (
    <div className="bg-primary min-h-[30vh] text-on-dark">
      <div className="flex flex-wrap items-center justify-between gap-2 px-[var(--gutter)] py-4">
        <h1 className="text-xl font-bold">{t('statistics.title')}</h1>
        <select
          className="min-h-touch rounded-pill border border-on-dark/30 bg-on-dark/10 px-3 text-sm text-on-dark"
          value={tournamentId ?? ''}
          onChange={(e) => setTournament(e.target.value)}
          aria-label={t('common.tournaments')}
        >
          <option value="" className="text-text">
            {t('profile.allTournaments')}
          </option>
          {(tournamentsQ.data?.items ?? []).map((tn) => (
            <option key={tn.id} value={tn.id} className="text-text">
              {tn.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] pb-3 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(
              'min-h-touch shrink-0 border-b-2 pb-1 text-sm font-semibold',
              category === c ? 'border-on-dark' : 'border-transparent opacity-70',
            )}
            onClick={() => setParams(tournamentId ? { category: c, tournamentId } : { category: c })}
          >
            {t(`statistics.${c}`)}
          </button>
        ))}
      </div>
      <div className="min-h-[50vh] rounded-t-card-lg bg-bg px-[var(--gutter)] py-4 text-text">
        {category === 'mvp' ? (
          <button type="button" className="mb-4 min-h-touch text-sm font-bold uppercase text-primary" onClick={() => setRulesOpen(true)}>
            {t('mvp.rules')}
          </button>
        ) : null}
        {q.isLoading ? <Spinner label={t('statistics.fetching')} /> : null}
        {q.isError ? <ErrorRetry message={t('statistics.empty')} onRetry={() => void q.refetch()} /> : null}
        {!q.isLoading && !q.isError && rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-secondary">{t('statistics.empty')}</p>
        ) : null}
        <ol>
          {rows.map((row, i) =>
            category === 'bestPartnership' && row.partnerName ? (
              <li key={i} className="mb-3 flex items-center justify-between gap-2 rounded-card bg-muted p-3">
                <span className="w-24 text-end text-sm font-semibold">{row.playerName}</span>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-dark">
                  {row.value}
                </span>
                <span className="w-24 text-sm font-semibold">{row.partnerName}</span>
              </li>
            ) : (
              <li key={i} className="flex items-center gap-3 border-b border-border py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-dark">
                  {row.rank ?? i + 1}
                </span>
                <Avatar name={row.playerName} size={40} />
                <div className="flex-1">
                  <p className="font-semibold">{row.playerName}</p>
                  <p className="text-xs uppercase text-text-secondary">{row.teamName}</p>
                  {row.breakdown ? (
                    <p className="text-xs text-text-secondary">
                      {t('mvp.bat')} {Number(row.breakdown.bat ?? 0).toFixed(1)}, {t('mvp.bowl')}{' '}
                      {Number(row.breakdown.bowl ?? 0).toFixed(1)}, {t('mvp.field')} {Number(row.breakdown.field ?? 0).toFixed(1)}
                    </p>
                  ) : null}
                </div>
                <p className="text-lg font-bold">
                  {category === 'mvp' && typeof row.value === 'number' ? row.value.toFixed(1) : row.value}
                  {row.starred ? '*' : ''}
                </p>
              </li>
            ),
          )}
        </ol>
      </div>
      <BottomSheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={t('mvp.pointsSystem')}>
        <MvpPointsTable config={mvpConfig} readOnly />
      </BottomSheet>
    </div>
  );
}
