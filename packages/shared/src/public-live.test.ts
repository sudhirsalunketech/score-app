import { describe, expect, it } from 'vitest';
import { extractYoutubeVideoId, isTrustedYoutubeHost, youtubeEmbedUrl } from './youtube';
import { slugifyMatchTitle, withSlugSuffix } from './slug';
import {
  ballFlash,
  ballLabel,
  buildPublicLiveScore,
  canJoinLiveRoom,
  publicBroadcastFromSettings,
  type PublicBallInput,
} from './public-live';

describe('extractYoutubeVideoId', () => {
  it('parses watch URLs', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses youtu.be', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses embed and nocookie', () => {
    expect(extractYoutubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('accepts a raw 11-character id', () => {
    expect(extractYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('rejects javascript and unknown hosts', () => {
    expect(extractYoutubeVideoId('javascript:alert(1)')).toBeNull();
    expect(extractYoutubeVideoId('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractYoutubeVideoId('<iframe src="https://youtube.com/embed/dQw4w9WgXcQ">')).toBeNull();
  });
  it('builds embed URLs only for valid ids', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
    expect(isTrustedYoutubeHost('youtu.be')).toBe(true);
    expect(isTrustedYoutubeHost('example.com')).toBe(false);
  });
});

describe('slugifyMatchTitle', () => {
  it('builds a public slug', () => {
    expect(slugifyMatchTitle('Alpha XI', 'Bhavin', 2026)).toBe('alpha-xi-vs-bhavin-2026');
  });
  it('appends a uniqueness suffix', () => {
    expect(withSlugSuffix('alpha-xi-vs-bhavin-2026', 'Ab12Cd')).toBe('alpha-xi-vs-bhavin-2026-ab12cd');
  });
});

describe('live access', () => {
  it('allows anonymous viewers only when public live is on', () => {
    expect(canJoinLiveRoom({ publicLiveEnabled: true, authenticated: false })).toBe(true);
    expect(canJoinLiveRoom({ publicLiveEnabled: false, authenticated: false })).toBe(false);
    expect(canJoinLiveRoom({ publicLiveEnabled: false, authenticated: true })).toBe(true);
  });
});

describe('ball labels', () => {
  const base: PublicBallInput = {
    sequence: 1,
    overNumber: 0,
    ballInOver: 1,
    batsmanRuns: 0,
    extraRuns: 0,
    extraType: 'NONE',
    isWicket: false,
  };
  it('labels scoring events', () => {
    expect(ballLabel({ ...base, batsmanRuns: 1 })).toBe('1');
    expect(ballLabel({ ...base, batsmanRuns: 4 })).toBe('4');
    expect(ballFlash({ ...base, batsmanRuns: 4 })).toBe('FOUR');
    expect(ballFlash({ ...base, batsmanRuns: 6 })).toBe('SIX');
    expect(ballLabel({ ...base, isWicket: true })).toBe('W');
    expect(ballLabel({ ...base, extraType: 'WIDE', extraRuns: 1 })).toBe('wd');
  });
});

describe('buildPublicLiveScore', () => {
  it('maps an authoritative snapshot without private fields', () => {
    const snapshot = {
      totalRuns: 6,
      totalWickets: 1,
      totalBallsLegal: 2,
      extras: 0,
      extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
      oversDisplay: '0.2',
      currentOver: 0,
      ballsInCurrentOver: 2,
      strikerId: 's',
      nonStrikerId: 'ns',
      bowlerId: 'b',
      currentRunRate: 18,
      partnership: { batterIds: ['s', 'ns'], runs: 6, balls: 1 },
      fallOfWickets: [],
      batters: [
        { playerId: 's', runs: 6, balls: 1, fours: 0, sixes: 1, isOut: false },
        { playerId: 'ns', runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
      ],
      bowlers: [{ playerId: 'b', balls: 2, runs: 6, wickets: 1, maidens: 0, dots: 0 }],
      isComplete: false,
      freeHitNext: false,
    };
    const dto = buildPublicLiveScore({
      matchId: 'm1',
      publicSlug: 'alpha-xi-vs-bhavin-2026',
      title: 'Alpha XI vs Bhavin',
      status: 'LIVE',
      venueText: 'Street',
      tournamentName: null,
      oversLimit: 5,
      maxWickets: 7,
      ballsPerOver: 6,
      homeTeam: { id: 'h', name: 'Alpha XI', shortName: 'AXI', logoUrl: null },
      awayTeam: { id: 'a', name: 'Bhavin', shortName: null, logoUrl: null },
      battingTeamId: 'h',
      bowlingTeamId: 'a',
      inningsId: 'inn',
      inningsNumber: 1,
      snapshot,
      players: [
        { id: 's', name: 'Sudhir' },
        { id: 'ns', name: 'Bhavin' },
        { id: 'b', name: 'Jjoio' },
      ],
      recentEvents: [
        {
          sequence: 1,
          overNumber: 0,
          ballInOver: 1,
          batsmanRuns: 6,
          extraRuns: 0,
          extraType: 'NONE',
          isWicket: false,
          commentary: 'SIX',
        },
      ],
      youtubeVideoId: 'dQw4w9WgXcQ',
      youtubeEnabled: true,
    });
    expect(dto.score).toEqual({ runs: 6, wickets: 1, overs: '0.2', balls: 2, runRate: 18, extras: 0 });
    expect(dto.striker?.name).toBe('Sudhir');
    expect(dto.striker?.onStrike).toBe(true);
    expect(dto.lastBall?.flash).toBe('SIX');
    expect(dto.youtube.videoId).toBe('dQw4w9WgXcQ');
    expect(JSON.stringify(dto)).not.toMatch(/password|jwt|email|secret/i);
  });
});

describe('publicBroadcastFromSettings', () => {
  it('returns STANDARD dark defaults and strips private settings', () => {
    const dto = publicBroadcastFromSettings({
      scorerId: 'secret-user',
      broadcast: {
        mode: 'full',
        theme: 'transparent',
        sponsor: { name: 'Raghus', logoUrl: 'https://cdn.example/logo.png', url: 'javascript:alert(1)', position: 'top-left' },
      },
    });
    expect(dto.mode).toBe('full');
    expect(dto.theme).toBe('transparent');
    expect(dto.sponsor?.name).toBe('Raghus');
    expect(dto.sponsor?.logoUrl).toBe('https://cdn.example/logo.png');
    expect(dto.sponsor?.url).toBeNull();
    expect(JSON.stringify(dto)).not.toMatch(/scorerId|secret-user|javascript/i);
  });
});
