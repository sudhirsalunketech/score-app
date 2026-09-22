/** Screenshot-derived design tokens. Components must import these — never scatter hex values. */
export const colors = {
  primary: '#00897B',
  primaryDark: '#00695C',
  primaryLight: '#A5D6D1',
  scoring: '#FF9800',
  scoringOn: '#1A1A1A',
  success: '#16A34A',
  danger: '#DC2626',
  live: '#E53935',
  bg: '#FFFFFF',
  muted: '#F5F5F5',
  text: '#111111',
  textSecondary: '#757575',
  border: '#E0E0E0',
  darkChrome: '#1C232B',
  gold: '#FDC02F',
  clubCard: '#1E1E1E',
  onDark: '#FFFFFF',
  battingHeader: '#96706F',
  battingBody: '#FCD8DA',
  bowlingHeader: '#6F967B',
  bowlingBody: '#D8FCDA',
  fieldingHeader: '#6F8B96',
  fieldingBody: '#D8ECFC',
} as const;

export const spacing = {
  gutter: 16,
  section: 24,
  card: 16,
  touchMin: 44,
  touchScoring: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  card: '0 1px 3px rgba(0,0,0,0.08)',
  drawer: '0 8px 24px rgba(0,0,0,0.18)',
} as const;

export const breakpoints = {
  mobile: 360,
  mobileLg: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1440,
  ultra: 1920,
} as const;

export const zIndex = {
  overlay: 1000,
  sheet: 1100,
  toast: 1200,
} as const;

export const motion = {
  defaultMs: 200,
} as const;

export const typography = {
  display: { size: 40, weight: 700 },
  stat: { size: 32, weight: 700 },
  heading: { size: 20, weight: 700 },
  subheading: { size: 16, weight: 600 },
  body: { size: 14, weight: 400 },
  caption: { size: 12, weight: 400 },
  button: { size: 14, weight: 700 },
} as const;
