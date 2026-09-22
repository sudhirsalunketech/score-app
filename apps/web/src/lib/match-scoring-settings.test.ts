import { describe, expect, it } from 'vitest';
import { parseMatchScoringSettings } from './match-scoring-settings';

describe('parseMatchScoringSettings', () => {
  it('uses safe defaults', () => {
    const s = parseMatchScoringSettings(null);
    expect(s.wagonWheel).toBe(true);
    expect(s.addExtrasToWide).toBe(true);
    expect(s.addWideToBatsman).toBe(false);
    expect(s.hattrickBattingBonusRuns).toBe(1);
    expect(s.hattrickWicketPenaltyRuns).toBe(1);
  });

  it('reads stored scoring preferences', () => {
    const s = parseMatchScoringSettings({
      addWideToBatsman: true,
      hattrickWicketPenalty: true,
      hattrickWicketPenaltyRuns: 5,
    });
    expect(s.addWideToBatsman).toBe(true);
    expect(s.hattrickWicketPenalty).toBe(true);
    expect(s.hattrickWicketPenaltyRuns).toBe(5);
  });
});
