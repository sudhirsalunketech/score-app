export type MatchScoringSettings = {
  wagonWheel: boolean;
  addExtrasToWide: boolean;
  addExtrasToNoBall: boolean;
  maxBallsPerOverWithExtras: number;
  limitMaxBallsWithExtras: boolean;
  addWideBallsToBatsman: boolean;
  addWideToBatsman: boolean;
  addNoBallToBatsman: boolean;
  hattrickBattingBonus: boolean;
  hattrickBattingBonusRuns: number;
  hattrickWicketPenalty: boolean;
  hattrickWicketPenaltyRuns: number;
};

function bool(raw: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof raw[key] === 'boolean' ? raw[key] : fallback;
}

function int(raw: Record<string, unknown>, key: string, fallback: number, min: number, max: number) {
  const n = typeof raw[key] === 'number' ? raw[key] : Number(raw[key]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function parseMatchScoringSettings(raw: unknown): MatchScoringSettings {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    wagonWheel: bool(s, 'wagonWheel', true),
    addExtrasToWide: bool(s, 'addExtrasToWide', true),
    addExtrasToNoBall: bool(s, 'addExtrasToNoBall', true),
    maxBallsPerOverWithExtras: int(s, 'maxBallsPerOverWithExtras', 8, 6, 12),
    limitMaxBallsWithExtras: bool(s, 'limitMaxBallsWithExtras', false),
    addWideBallsToBatsman: bool(s, 'addWideBallsToBatsman', false),
    addWideToBatsman: bool(s, 'addWideToBatsman', false),
    addNoBallToBatsman: bool(s, 'addNoBallToBatsman', false),
    hattrickBattingBonus: bool(s, 'hattrickBattingBonus', false),
    hattrickBattingBonusRuns: int(s, 'hattrickBattingBonusRuns', 1, 1, 13),
    hattrickWicketPenalty: bool(s, 'hattrickWicketPenalty', false),
    hattrickWicketPenaltyRuns: int(s, 'hattrickWicketPenaltyRuns', 1, 1, 13),
  };
}
