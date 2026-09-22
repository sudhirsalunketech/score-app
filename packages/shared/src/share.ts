export const SHARE_VISIBILITIES = ['PUBLIC', 'UNLISTED', 'PRIVATE'] as const;
export type ShareVisibility = (typeof SHARE_VISIBILITIES)[number];

export type ShareFeature = 'live' | 'scorecard' | 'stats' | 'mvp';

export function isLinkShareable(visibility: string | null | undefined): boolean {
  return visibility === 'PUBLIC' || visibility === 'UNLISTED';
}

export function isPublicListed(visibility: string | null | undefined): boolean {
  return visibility === 'PUBLIC';
}

export function canAnonymousViewShare(input: {
  visibility: string | null | undefined;
  feature: ShareFeature;
  publicLiveEnabled?: boolean;
  publicScorecardEnabled?: boolean;
  publicStatsEnabled?: boolean;
  publicMvpEnabled?: boolean;
}): boolean {
  if (!isLinkShareable(input.visibility)) return false;
  if (input.feature === 'live') return input.publicLiveEnabled === true;
  if (input.feature === 'scorecard') return input.publicScorecardEnabled !== false;
  if (input.feature === 'stats') return input.publicStatsEnabled !== false;
  return input.publicMvpEnabled !== false;
}

export type MatchShareInput = {
  homeName: string;
  awayName: string;
  tournamentName?: string | null;
  status: string;
  runs?: number;
  wickets?: number;
  overs?: string;
  winnerName?: string | null;
  margin?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  url: string;
};

export type ShareCopy = {
  liveNow: string;
  vs: string;
  overs: string;
  watchLive: string;
  watchLiveOf?: string;
  matchResult: string;
  wonBy: string;
  won: string;
  completed: string;
  viewScorecard: string;
  upcoming: string;
  viewMatch: string;
  liveScores: string;
  fixtures: string;
  pointsTable: string;
  stats: string;
  mvp: string;
  viewTournament: string;
  playerProfile: string;
};

export const DEFAULT_SHARE_COPY: ShareCopy = {
  liveNow: '🏏 LIVE NOW',
  vs: 'vs',
  overs: 'Overs',
  watchLive: 'Watch live:',
  watchLiveOf: 'Watch the live score of {home} vs {away}',
  matchResult: '🏏 MATCH RESULT',
  wonBy: 'won by',
  won: 'won',
  completed: 'Match completed',
  viewScorecard: 'View scorecard:',
  upcoming: '🏏 UPCOMING MATCH',
  viewMatch: 'View match:',
  liveScores: 'Live scores',
  fixtures: 'Fixtures',
  pointsTable: 'Points table',
  stats: 'Stats',
  mvp: 'MVP',
  viewTournament: 'View tournament:',
  playerProfile: 'View player:',
};

function compactLines(lines: string[]) {
  return lines
    .filter((line, i, arr) => line !== '' || (arr[i - 1] !== '' && i !== 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function matchShareText(input: MatchShareInput, copy: ShareCopy = DEFAULT_SHARE_COPY): string {
  const live = input.status === 'LIVE' || input.status === 'INNINGS_BREAK';
  const done = input.status === 'COMPLETED' || input.status === 'ABANDONED' || input.status === 'CANCELLED';
  if (live) {
    const watch =
      copy.watchLiveOf?.replace('{home}', input.homeName).replace('{away}', input.awayName) ??
      `${copy.watchLive} ${input.homeName} ${copy.vs} ${input.awayName}`;
    return compactLines([
      copy.liveNow,
      '',
      watch,
      '',
      `${input.homeName} ${input.runs ?? 0}/${input.wickets ?? 0}`,
      `${input.overs ?? '0.0'} ${copy.overs}`,
      input.tournamentName || '',
      '',
      copy.watchLive,
      input.url,
    ]);
  }
  if (done) {
    const result =
      input.winnerName && input.margin
        ? `${input.winnerName} ${copy.wonBy} ${input.margin}`
        : input.winnerName
          ? `${input.winnerName} ${copy.won}`
          : copy.completed;
    return compactLines([
      copy.matchResult,
      '',
      `${input.homeName} ${copy.vs} ${input.awayName}`,
      '',
      result,
      '',
      copy.viewScorecard,
      input.url,
    ]);
  }
  return compactLines([
    copy.upcoming,
    '',
    `${input.homeName} ${copy.vs} ${input.awayName}`,
    input.scheduledAt || '',
    input.venue || '',
    '',
    copy.viewMatch,
    input.url,
  ]);
}

export function tournamentShareText(
  input: { name: string; season?: string | null; url: string },
  copy: ShareCopy = DEFAULT_SHARE_COPY,
): string {
  return compactLines([
    `🏆 ${input.name}`,
    input.season || '',
    '',
    copy.liveScores,
    copy.fixtures,
    copy.pointsTable,
    copy.stats,
    copy.mvp,
    '',
    copy.viewTournament,
    input.url,
  ]);
}

export function playerShareText(
  input: {
    name: string;
    teamName?: string | null;
    url: string;
    headline?: string;
    matches?: number;
    runs?: number;
    wickets?: number;
    best?: string | number;
    strikeRate?: number;
  },
  copy: ShareCopy = DEFAULT_SHARE_COPY,
): string {
  const career = [
    input.matches != null ? `Matches ${input.matches}` : '',
    input.runs != null ? `Runs ${input.runs}` : '',
    input.wickets != null ? `Wickets ${input.wickets}` : '',
    input.best != null ? `Best ${input.best}` : '',
    input.strikeRate != null ? `Strike Rate ${input.strikeRate}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return compactLines([input.headline || input.name, input.teamName || '', career, '', copy.playerProfile, input.url]);
}

export function ogMatchTitle(home: string, away: string, status: string): string {
  const live = status === 'LIVE' || status === 'INNINGS_BREAK';
  const done = status === 'COMPLETED';
  if (live) return `${home} vs ${away} — Live Score`;
  if (done) return `${home} vs ${away} — Match Result`;
  return `${home} vs ${away} — Upcoming Match`;
}

export function ogMatchDescription(input: {
  tournamentName?: string | null;
  runs?: number;
  wickets?: number;
  overs?: string;
  status: string;
}): string {
  const live = input.status === 'LIVE' || input.status === 'INNINGS_BREAK';
  const score = live ? `${input.runs ?? 0}/${input.wickets ?? 0} in ${input.overs ?? '0.0'} overs. ` : '';
  return `${score}Follow the live score, scorecard, stats and MVP.${input.tournamentName ? ` ${input.tournamentName}.` : ''}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function socialPreviewHtml(input: {
  title: string;
  description: string;
  url: string;
  image?: string;
  heading: string;
}): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const url = escapeHtml(input.url);
  const image = escapeHtml(input.image || '');
  const heading = escapeHtml(input.heading);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<meta name="description" content="${description}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${url}"/>
<meta property="og:site_name" content="CrickScore"/>
${image ? `<meta property="og:image" content="${image}"/>` : ''}
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
${image ? `<meta name="twitter:image" content="${image}"/>` : ''}
<link rel="canonical" href="${url}"/>
<meta http-equiv="refresh" content="0;url=${url}"/>
</head>
<body>
<h1>${heading}</h1>
<p>${description}</p>
<p><a href="${url}">Open in CrickScore</a></p>
</body>
</html>`;
}
