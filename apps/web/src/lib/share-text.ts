import {
  DEFAULT_SHARE_COPY,
  matchShareText as sharedMatchShareText,
  playerShareText as sharedPlayerShareText,
  tournamentShareText as sharedTournamentShareText,
  type MatchShareInput,
  type ShareCopy,
} from '@crickscore/shared';
import i18n from '@/i18n';

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function shareCopy(): ShareCopy {
  const t = i18n.t.bind(i18n);
  return {
    liveNow: t('share.body.liveNow'),
    vs: t('share.body.vs'),
    overs: t('share.body.overs'),
    watchLive: t('share.body.watchLive'),
    watchLiveOf: t('share.body.watchLiveOf'),
    matchResult: t('share.body.matchResult'),
    wonBy: t('share.body.wonBy'),
    won: t('share.body.won'),
    completed: t('share.body.completed'),
    viewScorecard: t('share.body.viewScorecard'),
    upcoming: t('share.body.upcoming'),
    viewMatch: t('share.body.viewMatch'),
    liveScores: t('share.body.liveScores'),
    fixtures: t('share.body.fixtures'),
    pointsTable: t('share.body.pointsTable'),
    stats: t('share.body.stats'),
    mvp: t('share.body.mvp'),
    viewTournament: t('share.body.viewTournament'),
    playerProfile: t('share.body.playerProfile'),
  };
}

export function matchShareText(input: MatchShareInput) {
  return sharedMatchShareText(input, i18n.isInitialized ? shareCopy() : DEFAULT_SHARE_COPY);
}

export function tournamentShareText(input: { name: string; season?: string | null; url: string }) {
  return sharedTournamentShareText(input, i18n.isInitialized ? shareCopy() : DEFAULT_SHARE_COPY);
}

export function playerShareText(input: {
  name: string;
  teamName?: string | null;
  url: string;
  headline?: string;
  matches?: number;
  runs?: number;
  wickets?: number;
  best?: string | number;
  strikeRate?: number;
}) {
  return sharedPlayerShareText(
    { ...input, headline: input.headline ?? (i18n.isInitialized ? i18n.t('share.body.checkOutPlayer', { name: input.name }) : undefined) },
    i18n.isInitialized ? shareCopy() : DEFAULT_SHARE_COPY,
  );
}
