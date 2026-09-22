const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function youtubeEmbedSrc(videoId: string | null | undefined): string | null {
  if (!videoId || !VIDEO_ID.test(videoId)) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function publicLivePath(slug: string): string {
  return `/live/${slug}`;
}

export function publicMatchPath(slug: string): string {
  return `/match/${slug}`;
}

export function publicTournamentPath(slug: string): string {
  return `/tournament/${slug}`;
}

export function publicLiveUrl(slug: string): string {
  return `${window.location.origin}${publicLivePath(slug)}`;
}

export function publicMatchUrl(slug: string): string {
  return `${window.location.origin}${publicMatchPath(slug)}`;
}

export function publicTournamentUrl(slug: string): string {
  return `${window.location.origin}${publicTournamentPath(slug)}`;
}

export function overlayLiveUrl(slug: string, query = ''): string {
  const q = !query ? '' : query.startsWith('?') ? query : `?${query}`;
  return `${window.location.origin}/live/match/${slug}/overlay${q}`;
}

export function setPageMeta(input: {
  title: string;
  description: string;
  url: string;
  image?: string;
  robots?: string;
}) {
  document.title = input.title;
  const set = (attr: 'name' | 'property', key: string, value: string) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  };
  set('name', 'description', input.description);
  set('name', 'robots', input.robots ?? 'index,follow');
  set('property', 'og:title', input.title);
  set('property', 'og:description', input.description);
  set('property', 'og:type', 'website');
  set('property', 'og:url', input.url);
  if (input.image) set('property', 'og:image', input.image);
  set('name', 'twitter:card', 'summary_large_image');
  set('name', 'twitter:title', input.title);
  set('name', 'twitter:description', input.description);
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', input.url);
}
