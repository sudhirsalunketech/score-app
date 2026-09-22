import { useTranslation } from 'react-i18next';
import { IconTrophy } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { resultHeadline } from '@/lib/match-result';
import { cn } from '@/lib/cn';

export type ResultView = {
  status: string;
  resultType?: string | null;
  winnerTeamId?: string | null;
  marginType?: string | null;
  marginValue?: number | null;
  home: { teamId: string; name: string };
  away: { teamId: string; name: string };
  innings: Array<{ battingTeamId: string; runs: number; wickets: number; overs: string }>;
};

function scoreFor(teamId: string, innings: ResultView['innings']) {
  const inn = [...innings].reverse().find((i) => i.battingTeamId === teamId) ?? innings.find((i) => i.battingTeamId === teamId);
  if (!inn) return '—';
  return `${inn.runs}/${inn.wickets}`;
}

export function MatchResultBanner({
  result,
  className,
  actions,
}: {
  result: ResultView;
  className?: string;
  actions?: boolean | { onScorecard?: () => void; onCentre?: () => void; onShare?: () => void };
}) {
  const { t } = useTranslation();
  const finished = result.status === 'COMPLETED' || result.status === 'ABANDONED' || result.status === 'CANCELLED';
  if (!finished && !result.resultType) return null;
  const winnerName =
    result.winnerTeamId === result.home.teamId ? result.home.name : result.winnerTeamId === result.away.teamId ? result.away.name : null;
  const headline = resultHeadline({
    resultType: result.resultType,
    winnerName,
    marginType: result.marginType,
    marginValue: result.marginValue,
    labels: {
      completed: t('result.matchCompleted'),
      wonBy: t('result.wonBy'),
      runs: t('result.runs'),
      wickets: t('result.wickets'),
      tie: t('result.tie'),
      noResult: t('result.noResult'),
      abandoned: t('result.abandoned'),
      draw: t('result.draw'),
      innings: t('result.innings'),
    },
  });
  const showActions = actions && typeof actions === 'object';

  return (
    <section className={cn('px-[var(--gutter)] py-6 text-center', className)}>
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
        <IconTrophy size={16} />
        {result.status === 'ABANDONED' ? t('result.abandoned') : t('result.final')}
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-sm font-bold uppercase">{result.home.name}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{scoreFor(result.home.teamId, result.innings)}</p>
        </div>
        <p className="text-xs font-semibold uppercase text-text-secondary">vs</p>
        <div>
          <p className="text-sm font-bold uppercase">{result.away.name}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{scoreFor(result.away.teamId, result.innings)}</p>
        </div>
      </div>
      <p className="mt-5 text-base font-bold uppercase leading-snug text-primary">{headline}</p>
      {showActions ? (
        <div className="mt-6 grid gap-3">
          {actions.onScorecard ? (
            <Button className="h-12 w-full" onClick={actions.onScorecard}>
              {t('result.viewScorecard')}
            </Button>
          ) : null}
          {actions.onCentre ? (
            <Button className="h-12 w-full" variant="outline" onClick={actions.onCentre}>
              {t('match.centre')}
            </Button>
          ) : null}
          {actions.onShare ? (
            <Button className="h-12 w-full" variant="outline" onClick={actions.onShare}>
              {t('result.share')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function inningsScore(teamId: string, innings: ResultView['innings']) {
  return scoreFor(teamId, innings);
}
