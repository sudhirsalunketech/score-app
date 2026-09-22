const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

function validId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return VIDEO_ID.test(trimmed) ? trimmed : null;
}

/** Extract a YouTube video id from a URL or raw 11-character id. Rejects untrusted hosts. */
export function extractYoutubeVideoId(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (/^(javascript|data|vbscript):/i.test(raw)) return null;
  if (VIDEO_ID.test(raw)) return raw;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;
    if (host === 'youtu.be') {
      return validId(url.pathname.split('/').filter(Boolean)[0]);
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v') {
      return validId(parts[1]);
    }
    return validId(url.searchParams.get('v'));
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoId: string): string {
  const id = validId(videoId);
  if (!id) throw new Error('Invalid YouTube video id');
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

export function isTrustedYoutubeHost(host: string): boolean {
  return YOUTUBE_HOSTS.has(host.toLowerCase());
}
