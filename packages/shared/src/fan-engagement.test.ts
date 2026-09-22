import { describe, expect, it } from 'vitest';
import {
  answerIsCorrect,
  badgesForStats,
  boundFanPoints,
  isDuplicateChat,
  isFanQuizComingSoon,
  isFanQuizPlayable,
  liveTemplateVisible,
  rankFanRows,
  FAN_REACT_EMOJIS,
  sanitizeChatBody,
  shouldShowFanQuiz,
} from './fan-engagement';

describe('sanitizeChatBody', () => {
  it('strips HTML, trims, and caps length', () => {
    expect(sanitizeChatBody('  <b>Six!</b>  ')).toBe('Six!');
    expect(sanitizeChatBody('   ')).toBe('');
    expect(sanitizeChatBody('x'.repeat(400)).length).toBe(300);
  });
});

describe('boundFanPoints', () => {
  it('keeps points between 1 and 50', () => {
    expect(boundFanPoints(0)).toBe(1);
    expect(boundFanPoints(999)).toBe(50);
    expect(boundFanPoints(10)).toBe(10);
  });
});

describe('fan reactions', () => {
  it('allows only the five broadcast-safe emojis', () => {
    expect([...FAN_REACT_EMOJIS]).toEqual(['🔥', '👏', '❤️', '😂', '🏏']);
  });
});

describe('chat duplicates', () => {
  it('detects repeated messages', () => {
    expect(isDuplicateChat('What a six!', 'what a six!')).toBe(true);
    expect(isDuplicateChat('a', 'b')).toBe(false);
  });
});

describe('answerIsCorrect', () => {
  it('matches single choice and exact numbers', () => {
    expect(answerIsCorrect({ type: 'TEAM', optionIds: ['a'], correctOptionIds: ['a'] })).toBe(true);
    expect(answerIsCorrect({ type: 'TEAM', optionIds: ['b'], correctOptionIds: ['a'] })).toBe(false);
    expect(answerIsCorrect({ type: 'NUMBER', optionIds: [], numberValue: 82, correctOptionIds: [], correctNumber: 82 })).toBe(true);
    expect(answerIsCorrect({ type: 'NUMBER', optionIds: [], numberValue: 80, correctOptionIds: [], correctNumber: 82 })).toBe(false);
  });
});

describe('rankFanRows', () => {
  it('breaks ties by correct predictions then quizzes then earlier score', () => {
    const ranked = rankFanRows([
      { userId: 'b', points: 10, correctPredictions: 1, correctQuizzes: 0, firstPointAt: '2026-01-02' },
      { userId: 'a', points: 10, correctPredictions: 2, correctQuizzes: 0, firstPointAt: '2026-01-03' },
      { userId: 'c', points: 20, correctPredictions: 0, correctQuizzes: 0, firstPointAt: '2026-01-01' },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(['c', 'a', 'b']);
    expect(ranked[0]?.rank).toBe(1);
  });
});

describe('shouldShowFanQuiz', () => {
  const now = new Date('2026-08-15T12:00:00.000Z');
  const base = {
    matchExists: true,
    tournamentId: 'tn1',
    settings: { quizzesEnabled: true, quizStatus: 'ACTIVE' as const },
    now,
  };

  it('hides quiz when the tournament has no quiz configured', () => {
    expect(shouldShowFanQuiz({ matchExists: true, tournamentId: 'tn1', settings: null, now })).toBe(false);
    expect(shouldShowFanQuiz({ ...base, settings: { quizzesEnabled: false, quizStatus: 'ACTIVE' } })).toBe(false);
    expect(shouldShowFanQuiz({ ...base, settings: { quizzesEnabled: true, quizStatus: 'DRAFT' } })).toBe(false);
  });

  it('hides quiz when there is no tournament', () => {
    expect(shouldShowFanQuiz({ ...base, tournamentId: null })).toBe(false);
    expect(shouldShowFanQuiz({ ...base, matchExists: false })).toBe(false);
  });

  it('shows an active quiz inside its window', () => {
    expect(shouldShowFanQuiz(base)).toBe(true);
    expect(isFanQuizPlayable(base)).toBe(true);
    expect(
      shouldShowFanQuiz({
        ...base,
        settings: {
          quizzesEnabled: true,
          quizStatus: 'ACTIVE',
          quizStartAt: '2026-08-01T00:00:00.000Z',
          quizEndAt: '2026-08-20T00:00:00.000Z',
        },
      }),
    ).toBe(true);
  });

  it('hides an active quiz outside its dates', () => {
    expect(
      shouldShowFanQuiz({
        ...base,
        settings: { quizzesEnabled: true, quizStatus: 'ACTIVE', quizStartAt: '2026-08-16T00:00:00.000Z' },
      }),
    ).toBe(false);
    expect(
      shouldShowFanQuiz({
        ...base,
        settings: { quizzesEnabled: true, quizStatus: 'ACTIVE', quizEndAt: '2026-08-14T00:00:00.000Z' },
      }),
    ).toBe(false);
  });

  it('shows coming soon only when the organizer scheduled the quiz', () => {
    const scheduled = {
      ...base,
      settings: { quizzesEnabled: true, quizStatus: 'SCHEDULED', quizStartAt: '2026-08-16T00:00:00.000Z' },
    };
    expect(shouldShowFanQuiz(scheduled)).toBe(true);
    expect(isFanQuizComingSoon(scheduled)).toBe(true);
    expect(isFanQuizPlayable(scheduled)).toBe(false);
    expect(shouldShowFanQuiz({ ...base, settings: { quizzesEnabled: true, quizStatus: 'COMPLETED' } })).toBe(false);
  });
});

describe('liveTemplateVisible', () => {
  it('hides next-ball templates when not live', () => {
    expect(liveTemplateVisible('NEXT_WICKET', { status: 'SCHEDULED', wickets: 0, live: false })).toBe(false);
    expect(liveTemplateVisible('NEXT_WICKET', { status: 'LIVE', wickets: 0, live: true })).toBe(true);
    expect(liveTemplateVisible('FIRST_WICKET', { status: 'LIVE', wickets: 1, live: true })).toBe(false);
  });
});

describe('badgesForStats', () => {
  it('awards cosmetic badges from stats', () => {
    expect(
      badgesForStats({
        correctPredictions: 12,
        correctQuizzes: 6,
        fastQuizzes: 1,
        tournamentCorrect: 1,
        matchPerfect: true,
        globalRank: 4,
        points: 200,
      }),
    ).toEqual(expect.arrayContaining(['HOT_PREDICTOR', 'PREDICTION_MASTER', 'QUIZ_KING', 'TOP_10_FAN']));
  });
});
