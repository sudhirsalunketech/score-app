import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconNews, IconPencil, IconPerson, IconShare, IconTrophy } from '@/components/ui/Icons';
import { API_URL, api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { allMatchPlayers, playerName, teamById } from '@/lib/format';
import { resultHeadline } from '@/lib/match-result';
import {
  inningsScoreLine,
  playerOfTheMatchId,
  potmAchievementLine,
  topBatterHighlights,
  topBowlerHighlights,
} from '@/lib/match-summary-highlights';
import { hasMatchPerm } from '@/lib/access';
import { PotmSelectSheet } from '@/components/centre/PotmSelectSheet';
import type { Innings, Match, MvpPlayerRow } from '@/types/api';

export function CompletedMatchSummary({
  match,
  innings,
  mvp = [],
}: {
  match: Match;
  innings: Innings[];
  mvp?: MvpPlayerRow[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'report' | 'summary' | null>(null);
  const [potmOpen, setPotmOpen] = useState(false);
  const ordered = [...innings].filter((inn) => !inn.isSuperOver).sort((a, b) => a.inningsNumber - b.inningsNumber);
  const isTest = match.format === 'TEST';
  const storedPotmId = playerOfTheMatchId(match.settings);
  const potm = mvp.find((row) => row.playerId === storedPotmId) ?? mvp[0] ?? null;
  const potmAchievement = potm ? potmAchievementLine(ordered, potm.playerId) : null;
  const canEdit = hasMatchPerm(match, 'MATCH_MANAGE_RESULT') || hasMatchPerm(match, 'MATCH_SCORE');
  const photos = Object.fromEntries(allMatchPlayers(match).map((p) => [p.id, p.photoUrl]));
  const savePotm = useMutation({
    mutationFn: (playerId: string) =>
      api(`/api/v1/matches/${match.id}`, { method: 'PATCH', body: { settings: { playerOfTheMatchId: playerId } } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(match.id) });
      void qc.invalidateQueries({ queryKey: keys.match(match.id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(match.id) });
    },
  });
  const winnerName =
    match.resultWinnerTeamId === match.homeTeamId
      ? match.homeTeam.name
      : match.resultWinnerTeamId === match.awayTeamId
        ? match.awayTeam.name
        : null;
  const headline = resultHeadline({
    resultType: match.resultType,
    winnerName,
    marginType: match.marginType,
    marginValue: match.marginValue,
    labels: {
      completed: t('result.matchCompleted'),
      wonBy: t('result.wonBy'),
      runs: t('result.runs'),
      wickets: t('result.wickets'),
      tie: t('result.tie'),
      noResult: t('result.noResult'),
      abandoned: t('result.abandoned'),
    },
  });

  const sharePdf = async (kind: 'report' | 'summary') => {
    setBusy(kind);
    try {
      const token = localStorage.getItem('cs.access');
      const qs = kind === 'summary' ? '?variant=summary' : '';
      const res = await fetch(`${API_URL}/api/v1/matches/${match.id}/scorecard.pdf${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        window.print();
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], kind === 'summary' ? `Match_Summary.pdf` : `Match_Report.pdf`, {
        type: 'application/pdf',
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: match.title });
        return;
      }
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } finally {
      setBusy(null);
    }
  };

  const shareSummary = () => sharePdf('summary');
  const shareReport = () => sharePdf('report');

  return (
    <div className="bg-bg pb-10">
      {ordered.length === 0 ? (
        <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('common.empty')}</p>
      ) : (
        ordered.map((inn, idx) => {
          const batting = teamById(match, inn.battingTeamId);
          const overs =
            inn.snapshot?.oversDisplay ??
            `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`;
          const batters = topBatterHighlights(inn.snapshot?.batters ?? [], (id) => playerName(match, id));
          const bowlers = topBowlerHighlights(inn.snapshot?.bowlers ?? [], (id) => playerName(match, id));
          const toss = match.tossWinnerTeamId === inn.battingTeamId;
          const teamInningsOrdinal = ordered.slice(0, idx + 1).filter((row) => row.battingTeamId === inn.battingTeamId).length;
          const declared = inn.status === 'DECLARED';
          return (
            <section key={inn.id ?? inn.inningsNumber} className="border-b border-border px-[var(--gutter)] py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[15px] font-bold uppercase leading-snug text-primary">
                  {batting?.name ?? '—'}
                  {isTest && ordered.length > 2 ? (
                    <span className="ms-1.5 text-xs font-normal normal-case text-text-secondary">
                      · {teamInningsOrdinal >= 2 ? t('match.secondInnings') : t('match.firstInnings')}
                    </span>
                  ) : null}
                </p>
                <p className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-bold tabular-nums text-primary">
                  {inningsScoreLine(inn.totalRuns, inn.totalWickets, overs)}
                  {declared ? <span className="text-xs font-semibold normal-case text-text-secondary">d</span> : null}
                  {toss ? (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-text-secondary text-[10px] font-bold text-on-dark"
                      title={t('match.toss')}
                      aria-label={t('match.toss')}
                    >
                      T
                    </span>
                  ) : null}
                </p>
              </div>
              {batters.length || bowlers.length ? (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <ul className="min-w-0 space-y-1">
                    {batters.map((row) => (
                      <li key={row.id} className="flex min-w-0 justify-between gap-2">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="shrink-0 tabular-nums text-text-secondary">{row.line}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="min-w-0 space-y-1">
                    {bowlers.map((row) => (
                      <li key={row.id} className="flex min-w-0 justify-between gap-2">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="shrink-0 tabular-nums text-text-secondary">{row.line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })
      )}

      <div className="px-[var(--gutter)]">
        <AwardRow
          icon={
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gold text-dark-chrome">
              <IconTrophy size={22} />
            </span>
          }
          label={t('match.winner')}
          value={headline}
        />
        <AwardRow
          icon={
            potm ? (
              <Avatar name={potm.playerName} src={photos[potm.playerId]} size={44} />
            ) : (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-text-secondary">
                <IconPerson size={22} />
              </span>
            )
          }
          label={t('match.playerOfTheMatch')}
          value={potm?.playerName ?? null}
          subtitle={potmAchievement}
          onClick={() => setPotmOpen(true)}
          action={
            canEdit ? (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-text-secondary">
                <IconPencil size={18} />
              </span>
            ) : null
          }
        />

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-bg text-sm font-semibold"
            disabled={busy === 'report'}
            onClick={() => void shareReport()}
          >
            <IconNews size={20} />
            {t('match.shareMatchReport')}
          </button>
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-bg text-sm font-semibold"
            disabled={busy === 'summary'}
            onClick={() => void shareSummary()}
          >
            <IconShare size={20} />
            {t('match.shareMatchSummary')}
          </button>
        </div>
      </div>
      <PotmSelectSheet
        open={potmOpen}
        rows={mvp}
        innings={ordered}
        suggestedId={mvp[0]?.playerId ?? null}
        selectedId={storedPotmId}
        photos={photos}
        canSelect={canEdit && !savePotm.isPending}
        onClose={() => setPotmOpen(false)}
        onSelect={(playerId) => {
          savePotm.mutate(playerId);
          setPotmOpen(false);
        }}
      />
    </div>
  );
}

function AwardRow({
  icon,
  label,
  value,
  subtitle,
  action,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  subtitle?: string | null;
  action?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {icon}
      <div className="min-w-0 flex-1 text-start">
        <p className="text-xs text-text-secondary">{label}</p>
        {value ? <p className="mt-0.5 text-sm font-bold leading-snug">{value}</p> : null}
        {subtitle ? <p className="mt-0.5 text-xs tabular-nums text-text-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-3 border-b border-border py-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return <div className="flex items-center gap-3 border-b border-border py-4">{body}</div>;
}
