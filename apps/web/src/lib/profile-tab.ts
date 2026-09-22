export const PROFILE_TABS = ['overview', 'statistics', 'matches', 'teams', 'tournaments'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
export type StatsPanel = 'stats' | 'insights' | 'compare' | 'fan';

export function parseProfileTab(raw: string | null): ProfileTab {
  if (raw === 'stats' || raw === 'statistics' || raw === 'insights' || raw === 'compare' || raw === 'fan') return 'statistics';
  if (raw && (PROFILE_TABS as readonly string[]).includes(raw)) return raw as ProfileTab;
  return 'overview';
}

export function parseStatsPanel(panel: string | null, tab: string | null): StatsPanel {
  if (panel === 'insights' || tab === 'insights') return 'insights';
  if (panel === 'compare' || tab === 'compare') return 'compare';
  if (panel === 'fan' || tab === 'fan') return 'fan';
  return 'stats';
}

export function profileTabParam(tab: ProfileTab) {
  return tab;
}
