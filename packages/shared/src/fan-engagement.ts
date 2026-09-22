export const FAN_SOCKET = {
  chatMessage: 'fan:chat:message',
  chatDeleted: 'fan:chat:deleted',
  chatModerated: 'fan:chat:moderated',
  presence: 'fan:presence:update',
  predictionLocked: 'prediction:locked',
  predictionSettled: 'prediction:settled',
  quizLocked: 'quiz:locked',
  leaderboardUpdated: 'leaderboard:updated',
} as const;

export const FAN_POINT_MAX = 50;
export const FAN_CHAT_MAX = 300;
export const FAN_CHAT_RATE = { windowMs: 10_000, max: 5 } as const;
export const FAN_REACT_EMOJIS = ['🔥', '👏', '❤️', '😂', '🏏'] as const;
export const FAN_REACT_RATE = { windowMs: 10_000, max: 20 } as const;

export const BADGE_KEYS = [
  'HOT_PREDICTOR',
  'PREDICTION_MASTER',
  'QUIZ_KING',
  'TOURNAMENT_EXPERT',
  'FAST_THINKER',
  'TOP_FAN',
  'CENTURY_PREDICTOR',
  'PERFECT_MATCH',
  'TOP_10_FAN',
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export function sanitizeChatBody(raw: unknown): string {
  const text = String(raw ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, FAN_CHAT_MAX);
}

export function boundFanPoints(value: unknown, fallback = 10): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(FAN_POINT_MAX, Math.max(1, Math.round(n)));
}

export function isDuplicateChat(previous: string | null | undefined, next: string): boolean {
  return Boolean(previous && previous.trim().toLowerCase() === next.trim().toLowerCase());
}

export type FanRankRow = {
  userId: string;
  points: number;
  correctPredictions: number;
  correctQuizzes: number;
  firstPointAt: Date | string | null;
};

export function rankFanRows(rows: FanRankRow[]): Array<FanRankRow & { rank: number }> {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.correctPredictions !== a.correctPredictions) return b.correctPredictions - a.correctPredictions;
    if (b.correctQuizzes !== a.correctQuizzes) return b.correctQuizzes - a.correctQuizzes;
    const at = a.firstPointAt ? new Date(a.firstPointAt).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.firstPointAt ? new Date(b.firstPointAt).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function answerIsCorrect(input: {
  type: string;
  optionIds: string[];
  numberValue?: number | null;
  correctOptionIds: string[];
  correctNumber?: number | null;
}): boolean {
  if (input.type === 'NUMBER') {
    return input.correctNumber != null && input.numberValue === input.correctNumber;
  }
  const got = [...input.optionIds].sort();
  const want = [...input.correctOptionIds].sort();
  return got.length > 0 && got.length === want.length && got.every((id, i) => id === want[i]);
}

export type MatchTemplateKey =
  | 'MATCH_WINNER'
  | 'MOST_RUNS'
  | 'FIRST_WICKET'
  | 'MOST_SIXES'
  | 'POTM'
  | 'TOTAL_RUNS'
  | 'TOTAL_WICKETS'
  | 'NEXT_BOUNDARY'
  | 'NEXT_WICKET'
  | 'NEXT_BATSMAN_OUT'
  | 'NEXT_OVER_BOUNDARY'
  | 'NEXT_OVER_10';

export type TournamentTemplateKey =
  | 'TOURNAMENT_WINNER'
  | 'TOURNAMENT_FINALISTS'
  | 'TOP_GROUP'
  | 'TOURNAMENT_MOST_RUNS'
  | 'TOURNAMENT_MOST_WICKETS'
  | 'TOURNAMENT_MVP';

export const MATCH_PREDICTION_TEMPLATES: Array<{
  key: MatchTemplateKey;
  kind: 'PREDICTION' | 'QUIZ';
  type: 'SINGLE_CHOICE' | 'NUMBER' | 'YES_NO' | 'PLAYER' | 'TEAM';
  points: number;
  title: string;
}> = [
  { key: 'MATCH_WINNER', kind: 'PREDICTION', type: 'TEAM', points: 10, title: 'Who will win this match?' },
  { key: 'MOST_RUNS', kind: 'PREDICTION', type: 'PLAYER', points: 20, title: 'Who will score the most runs?' },
  { key: 'FIRST_WICKET', kind: 'PREDICTION', type: 'PLAYER', points: 20, title: 'Who will take the first wicket?' },
  { key: 'MOST_SIXES', kind: 'PREDICTION', type: 'PLAYER', points: 20, title: 'Who will hit the most sixes?' },
  { key: 'POTM', kind: 'PREDICTION', type: 'PLAYER', points: 20, title: 'Who will be Player of the Match?' },
  { key: 'TOTAL_RUNS', kind: 'PREDICTION', type: 'NUMBER', points: 20, title: 'How many total runs will be scored?' },
  { key: 'TOTAL_WICKETS', kind: 'PREDICTION', type: 'NUMBER', points: 10, title: 'How many wickets will fall?' },
  { key: 'NEXT_BOUNDARY', kind: 'PREDICTION', type: 'PLAYER', points: 30, title: 'Who will score the next boundary?' },
  { key: 'NEXT_WICKET', kind: 'PREDICTION', type: 'PLAYER', points: 30, title: 'Who will take the next wicket?' },
  { key: 'NEXT_BATSMAN_OUT', kind: 'PREDICTION', type: 'PLAYER', points: 30, title: 'Who will be the next batsman out?' },
  { key: 'NEXT_OVER_BOUNDARY', kind: 'PREDICTION', type: 'YES_NO', points: 20, title: 'Will the next over contain a boundary?' },
  { key: 'NEXT_OVER_10', kind: 'PREDICTION', type: 'YES_NO', points: 20, title: 'Will the team score 10+ runs in the next over?' },
];

export const TOURNAMENT_PREDICTION_TEMPLATES: Array<{
  key: TournamentTemplateKey;
  type: 'TEAM' | 'PLAYER' | 'MULTIPLE_CHOICE';
  points: number;
  title: string;
}> = [
  { key: 'TOURNAMENT_WINNER', type: 'TEAM', points: 50, title: 'Who will win the tournament?' },
  { key: 'TOURNAMENT_FINALISTS', type: 'MULTIPLE_CHOICE', points: 30, title: 'Who will reach the final?' },
  { key: 'TOP_GROUP', type: 'TEAM', points: 20, title: 'Who will finish top of the group?' },
  { key: 'TOURNAMENT_MOST_RUNS', type: 'PLAYER', points: 20, title: 'Who will have the highest run scorer?' },
  { key: 'TOURNAMENT_MOST_WICKETS', type: 'PLAYER', points: 20, title: 'Who will take the most wickets?' },
  { key: 'TOURNAMENT_MVP', type: 'PLAYER', points: 30, title: 'Who will be MVP?' },
];

export const MATCH_QUIZ_TEMPLATES: Array<{ key: string; title: string; points: number }> = [
  { key: 'QUIZ_FIRST_BOUNDARY', title: 'Who scored the first boundary?', points: 5 },
  { key: 'QUIZ_FIRST_WICKET', title: 'Who took the first wicket?', points: 5 },
  { key: 'QUIZ_MOST_RUNS', title: 'Who scored the most runs?', points: 5 },
  { key: 'QUIZ_MOST_SIXES', title: 'Who hit the most sixes?', points: 5 },
  { key: 'QUIZ_WINNER', title: 'Who won this match?', points: 10 },
  { key: 'QUIZ_HIGHEST_TEAM', title: 'Which team scored the most runs?', points: 5 },
  { key: 'QUIZ_WICKETS', title: 'How many wickets fell?', points: 5 },
  { key: 'QUIZ_POTM', title: 'Who was Player of the Match?', points: 10 },
];

export const TOURNAMENT_QUIZ_TEMPLATES: Array<{ key: string; title: string; points: number }> = [
  { key: 'QUIZ_TOURNAMENT_WINNER', title: 'Who will win the tournament?', points: 10 },
  { key: 'QUIZ_TOURNAMENT_BEST_BATSMAN', title: 'Who will be the best batsman of the tournament?', points: 10 },
  { key: 'QUIZ_TOURNAMENT_BEST_BOWLER', title: 'Who will be the best bowler of the tournament?', points: 10 },
];

export const FAN_QUIZ_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED'] as const;
export type FanQuizStatus = (typeof FAN_QUIZ_STATUSES)[number];

export type FanQuizSettingsLike = {
  quizzesEnabled?: boolean | null;
  quizStatus?: string | null;
  quizStartAt?: string | Date | null;
  quizEndAt?: string | Date | null;
};

export type FanQuizVisibilityInput = {
  matchExists?: boolean;
  tournamentId?: string | null;
  settings?: FanQuizSettingsLike | null;
  now?: Date;
};

function asDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveFanQuizState(input: FanQuizVisibilityInput): 'hidden' | 'coming_soon' | 'active' {
  if (input.matchExists === false) return 'hidden';
  if (!input.tournamentId) return 'hidden';
  const settings = input.settings;
  if (!settings?.quizzesEnabled) return 'hidden';
  const status = (settings.quizStatus ?? 'DRAFT') as FanQuizStatus;
  if (status === 'DRAFT' || status === 'COMPLETED') return 'hidden';
  const now = input.now ?? new Date();
  const start = asDate(settings.quizStartAt);
  const end = asDate(settings.quizEndAt);
  if (end && now > end) return 'hidden';
  if (status === 'SCHEDULED') {
    if (start && now >= start) return 'active';
    return 'coming_soon';
  }
  if (status === 'ACTIVE') {
    if (start && now < start) return 'hidden';
    return 'active';
  }
  return 'hidden';
}

/** Single reusable check: show any Fan Quiz entry point (icon, tab, card, notification). */
export function shouldShowFanQuiz(input: FanQuizVisibilityInput): boolean {
  return resolveFanQuizState(input) !== 'hidden';
}

export function isFanQuizComingSoon(input: FanQuizVisibilityInput): boolean {
  return resolveFanQuizState(input) === 'coming_soon';
}

export function isFanQuizPlayable(input: FanQuizVisibilityInput): boolean {
  return resolveFanQuizState(input) === 'active';
}

export function liveTemplateVisible(key: string, state: { status: string; wickets: number; live: boolean }): boolean {
  if (key === 'FIRST_WICKET' && state.wickets > 0) return false;
  if (['NEXT_BOUNDARY', 'NEXT_WICKET', 'NEXT_BATSMAN_OUT', 'NEXT_OVER_BOUNDARY', 'NEXT_OVER_10'].includes(key)) {
    return state.live;
  }
  if (key.startsWith('QUIZ_') && state.status !== 'COMPLETED') return false;
  return true;
}

export function badgesForStats(stats: {
  correctPredictions: number;
  correctQuizzes: number;
  fastQuizzes: number;
  tournamentCorrect: number;
  matchPerfect: boolean;
  globalRank: number | null;
  points: number;
}): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (stats.correctPredictions >= 3) out.push('HOT_PREDICTOR');
  if (stats.correctPredictions >= 10) out.push('PREDICTION_MASTER');
  if (stats.correctQuizzes >= 5) out.push('QUIZ_KING');
  if (stats.tournamentCorrect >= 1) out.push('TOURNAMENT_EXPERT');
  if (stats.fastQuizzes >= 1) out.push('FAST_THINKER');
  if (stats.globalRank === 1) out.push('TOP_FAN');
  if (stats.correctPredictions >= 100) out.push('CENTURY_PREDICTOR');
  if (stats.matchPerfect) out.push('PERFECT_MATCH');
  if (stats.globalRank != null && stats.globalRank <= 10) out.push('TOP_10_FAN');
  return out;
}
