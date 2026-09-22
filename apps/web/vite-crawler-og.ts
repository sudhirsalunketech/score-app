const CRAWLER_UA =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Googlebot|bingbot|Applebot|Iframely|SkypeUriPreview/i;

export function isSocialCrawler(userAgent: string | undefined): boolean {
  return Boolean(userAgent && CRAWLER_UA.test(userAgent));
}

/** Map SPA share URLs to public preview HTML. `/live/match/:slug` is not treated as slug "match". */
export function socialPreviewApiPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? pathname;
  const liveMatch = path.match(/^\/live\/match\/([^/]+)\/?(?:overlay)?\/?$/);
  if (liveMatch?.[1] && liveMatch[1] !== 'match') return `/api/v1/public/matches/${liveMatch[1]}/preview`;
  const live = path.match(/^\/live\/([^/]+)\/?$/);
  if (live?.[1] && live[1] !== 'match') return `/api/v1/public/matches/${live[1]}/preview`;
  const match = path.match(/^\/match\/([^/]+)\/?$/);
  if (match?.[1]) return `/api/v1/public/matches/${match[1]}/preview`;
  const tournament = path.match(/^\/tournament\/([^/]+)\/?$/);
  if (tournament?.[1]) return `/api/v1/public/tournaments/${tournament[1]}/preview`;
  return null;
}
