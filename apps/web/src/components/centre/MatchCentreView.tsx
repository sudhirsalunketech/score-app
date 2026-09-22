import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { YoutubeEmbed } from '@/components/live/YoutubeEmbed';
import { MatchResultBanner, inningsScore } from '@/components/match/MatchResultBanner';
import { resultHeadline, shareResultText } from '@/lib/match-result';
import {
  BatsmanTable,
  BowlerTable,
  MatchStats,
  RecentOvers,
  ReconnectingBanner,
  ScoreHeader,
} from '@/components/centre/MatchSummary';
import { groupRecentOvers, type CentreModel } from '@/lib/centre-model';
import type { SocketConnection } from '@/lib/socket';
import { cn } from '@/lib/cn';
import { CustomRulesBanner } from '@/components/tournament/CustomRulesBanner';

export const MatchCentreView = memo(function MatchCentreView({
  model,
  className,
  connection,
}: {
  model: CentreModel;
  className?: string;
  connection?: SocketConnection;
}) {
  const { t } = useTranslation();
  const overs = groupRecentOvers(model.recentBalls).slice(0, 4);
  const video = model.youtubeEnabled && model.youtubeVideoId;
  const live = model.status === 'LIVE' || model.status === 'INNINGS_BREAK';
  const finished = model.status === 'COMPLETED' || model.status === 'ABANDONED' || model.status === 'CANCELLED';
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('cs.scoreMute') === '1';
    } catch {
      return false;
    }
  });

  const onMute = useCallback(() => {
    setMuted((cur) => {
      const next = !cur;
      try {
        localStorage.setItem('cs.scoreMute', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const onShare = useCallback(() => {
    const url = model.shareUrl ?? window.location.href;
    const headline = resultHeadline({
      resultType: model.resultType,
      winnerName:
        model.winnerTeamId === model.homeTeamId
          ? model.homeTeamName
          : model.winnerTeamId === model.awayTeamId
            ? model.awayTeamName
            : null,
      marginType: model.marginType,
      marginValue: model.marginValue,
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
    const text = finished
      ? shareResultText({
          title: model.title,
          homeName: model.homeTeamName,
          awayName: model.awayTeamName,
          homeScore: inningsScore(model.homeTeamId, model.inningsScores),
          awayScore: inningsScore(model.awayTeamId, model.inningsScores),
          headline,
          url,
        })
      : t('live.shareText', { title: model.title });
    if (navigator.share) {
      void navigator.share({ title: model.title, text, url });
      return;
    }
    void navigator.clipboard.writeText(finished ? text : url);
  }, [finished, model, t]);

  return (
    <div className={cn('pb-8', className)}>
      <ReconnectingBanner show={Boolean(live && connection && connection !== 'connected')} />
      {finished ? (
        <>
          <MatchResultBanner
            result={{
              status: model.status,
              resultType: model.resultType,
              winnerTeamId: model.winnerTeamId,
              marginType: model.marginType,
              marginValue: model.marginValue,
              home: { teamId: model.homeTeamId, name: model.homeTeamName },
              away: { teamId: model.awayTeamId, name: model.awayTeamName },
              innings: model.inningsScores,
            }}
          />
          <div className="px-[var(--gutter)] pb-4">
            <button type="button" className="min-h-touch w-full text-sm font-bold uppercase text-primary" onClick={onShare}>
              {t('result.share')}
            </button>
          </div>
        </>
      ) : (
        <ScoreHeader
          teamName={model.battingTeamName}
          inningsNumber={model.inningsNumber}
          runs={model.runs}
          wickets={model.wickets}
          maxWickets={model.maxWickets}
          muted={muted}
          onMute={onMute}
          onShare={onShare}
        />
      )}
      <CustomRulesBanner overlay={model.customRules} />
      {video ? (
        <section className="border-t border-border px-[var(--gutter)] py-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <span className="h-4 w-1 shrink-0 bg-primary" aria-hidden />
            {t('match.watchLive')}
          </h2>
          <YoutubeEmbed videoId={model.youtubeVideoId!} title={`${t('match.watchLive')} — ${model.title}`} />
        </section>
      ) : null}
      {finished ? null : (
        <MatchStats
          extras={model.extras}
          overs={model.overs}
          oversLimit={model.oversLimit}
          crr={model.crr}
          partnershipRuns={model.partnershipRuns}
          partnershipBalls={model.partnershipBalls}
        />
      )}
      <BatsmanTable rows={model.batsmen} />
      <BowlerTable bowler={model.bowler} />
      <RecentOvers
        overs={overs}
        allBalls={model.recentBalls}
        batsmen={model.batsmen}
        bowler={model.bowler}
        oversDisplay={model.overs}
        totalRuns={model.runs}
        wickets={model.wickets}
      />
    </div>
  );
});
