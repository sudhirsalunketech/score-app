import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatch(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return match;
}

const COLLAPSE_KEY = 'cs-sidebar-collapsed';

export function useSidebarCollapsed() {
  const tabletUp = useMediaQuery('(min-width: 768px)');
  const [pref, setPref] = useState<boolean | null>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch {
      /* ignore */
    }
    return null;
  });

  const collapsed = Boolean(tabletUp && pref);

  const toggle = () => {
    const next = !collapsed;
    setPref(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return { tabletUp, collapsed, toggle };
}
