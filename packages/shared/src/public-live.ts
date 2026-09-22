type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

type LiveSnapshotInput = {
  totalRuns: number;
  totalWickets: number;
  totalBallsLegal: number;
  extras?: number;
  oversDisplay: string;
  currentRunRate: number;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  partnership: { runs: number; balls: number } | null;
  batters: { playerId: string; runs: number; balls: number; fours: number; sixes: number }[];
  bowlers: { playerId: string; balls: number; runs: number; wickets: number; maidens: number }[];
};

export const LIVE_SOCKET = {
  joinMatch: 'join.match',
  joinPublic: 'join.public-match',
  scoreUpdated: 'match.score.updated',
  deliveryCreated: 'delivery.created',
  inningsCompleted: 'innings.completed',
  matchCompleted: 'match.completed',
  overRuleApplied: 'over-rule.applied',
  joinDenied: 'match.join.denied',
  joined: 'match.joined',
  viewerCount: 'match.viewers',
  fanChatMessage: 'fan:chat:message',
  fanChatDeleted: 'fan:chat:deleted',
  fanChatModerated: 'fan:chat:moderated',
  fanChatReaction: 'fan:chat:reaction',
  fanPresence: 'fan:presence:update',
  fanPredictionLocked: 'prediction:locked',
  fanPredictionSettled: 'prediction:settled',
  fanQuizLocked: 'quiz:locked',
  fanLeaderboard: 'leaderboard:updated',
} as const;

export type PublicTeamDto = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

export type PublicBatterDto = {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  onStrike: boolean;
};

export type PublicBowlerDto = {
  playerId: string;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
};

export type PublicBallDto = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  label: string;
  flash: string;
  commentary: string | null;
  isWicket: boolean;
  extraType: ExtraType;
  batsmanRuns: number;
  extraRuns: number;
  bowlerName: string | null;
  strikerName: string | null;
  dismissalType?: string | null;
};

export type OverlayMode = 'full' | 'standard' | 'compact' | 'minimal';
export type OverlayTheme = 'classic' | 'dark' | 'transparent';
export type OverlaySponsorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type OverlaySponsor = {
  name: string | null;
  logoUrl: string | null;
  url: string | null;
  position: OverlaySponsorPosition;
};

export type PublicBroadcastDto = {
  theme: OverlayTheme;
  mode: OverlayMode;
  header: boolean;
  tournamentLogo: boolean;
  sponsor: OverlaySponsor | null;
  animations: { four: boolean; six: boolean; wicket: boolean };
  panels: {
    currentOver: boolean;
    batters: boolean;
    bowler: boolean;
    partnership: boolean;
    recentOvers: boolean;
    moments: boolean;
    projected: boolean;
  };
};

export type PublicLiveScoreDto = {
  matchId: string;
  publicSlug: string | null;
  title: string;
  status: string;
  venueText: string | null;
  tournamentName: string | null;
  oversLimit: number;
  maxWickets: number;
  ballsPerOver: number;
  homeTeam: PublicTeamDto;
  awayTeam: PublicTeamDto;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  inningsId: string | null;
  inningsNumber: number | null;
  score: {
    runs: number;
    wickets: number;
    overs: string;
    balls: number;
    runRate: number;
    extras: number;
  };
  striker: PublicBatterDto | null;
  nonStriker: PublicBatterDto | null;
  bowler: PublicBowlerDto | null;
  partnership: { runs: number; balls: number } | null;
  recentBalls: PublicBallDto[];
  commentary: { overs: string; text: string }[];
  lastBall: PublicBallDto | null;
  youtube: { enabled: boolean; videoId: string | null };
  result: {
    resultType: string | null;
    winnerTeamId: string | null;
    marginType: string | null;
    marginValue: number | null;
    innings: Array<{
      battingTeamId: string;
      bowlingTeamId: string;
      inningsNumber: number;
      runs: number;
      wickets: number;
      overs: string;
    }>;
  } | null;
  customRules?: {
    active: boolean;
    summary: string[];
    lastBall: { actual: number; counted: number; reason: string } | null;
    score: { actual: number; counted: number } | null;
    affectsMatchResult: boolean;
    balls?: Array<{ sequence: number; actual: number; counted: number }>;
  } | null;
  scheduledAt?: string | null;
  tournamentSlug?: string | null;
  visibility?: string;
  share?: { live: boolean; scorecard: boolean; stats: boolean; mvp: boolean };
  viewerCount?: number;
  tournamentLogoUrl?: string | null;
  broadcast?: PublicBroadcastDto | null;
  playingXi?: {
    home: Array<{ id: string; name: string; isCaptain: boolean; isWicketKeeper: boolean; photoUrl?: string | null }>;
    away: Array<{ id: string; name: string; isCaptain: boolean; isWicketKeeper: boolean; photoUrl?: string | null }>;
  };
  format?: string | null;
  toss?: { winnerTeamId: string | null; decision: string | null } | null;
};

export type PublicMatchSummaryDto = {
  publicSlug: string;
  title: string;
  status: string;
  venueText: string | null;
  tournamentName: string | null;
  scheduledAt: string | null;
  homeTeam: PublicTeamDto;
  awayTeam: PublicTeamDto;
  youtube: { enabled: boolean; videoId: string | null };
  publicLiveEnabled: boolean;
};

export type PublicBallInput = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  batsmanRuns: number;
  extraRuns: number;
  extraType: ExtraType;
  isWicket: boolean;
  commentary?: string | null;
  bowlerId?: string | null;
  strikerId?: string | null;
  dismissalType?: string | null;
};

export function ballLabel(ev: PublicBallInput): string {
  if (ev.isWicket) return 'W';
  if (ev.extraType === 'WIDE') return ev.extraRuns > 1 ? `wd+${ev.extraRuns - 1}` : 'wd';
  if (ev.extraType === 'NO_BALL') return ev.batsmanRuns ? `nb+${ev.batsmanRuns}` : 'nb';
  if (ev.extraType === 'BYE') return `b${ev.extraRuns}`;
  if (ev.extraType === 'LEG_BYE') return `lb${ev.extraRuns}`;
  if (ev.extraType === 'PENALTY') return ev.extraRuns < 0 ? `p${ev.extraRuns}` : `p+${ev.extraRuns}`;
  return String(ev.batsmanRuns);
}

export function ballFlash(ev: PublicBallInput): string {
  if (ev.isWicket) return 'W';
  if (ev.extraType === 'NONE' && ev.batsmanRuns === 4) return 'FOUR';
  if (ev.extraType === 'NONE' && ev.batsmanRuns === 6) return 'SIX';
  if (ev.extraType === 'WIDE') return 'WD';
  if (ev.extraType === 'NO_BALL') return 'NB';
  const total = ev.batsmanRuns + ev.extraRuns;
  if (total === 0) return '•';
  return `+${total}`;
}

export function toPublicBall(ev: PublicBallInput, players: { id: string; name: string }[] = []): PublicBallDto {
  return {
    sequence: ev.sequence,
    overNumber: ev.overNumber,
    ballInOver: ev.ballInOver,
    label: ballLabel(ev),
    flash: ballFlash(ev),
    commentary: ev.commentary ?? null,
    isWicket: ev.isWicket,
    extraType: ev.extraType,
    batsmanRuns: ev.batsmanRuns,
    extraRuns: ev.extraRuns,
    bowlerName: nameOf(players, ev.bowlerId ?? null),
    strikerName: nameOf(players, ev.strikerId ?? null),
    dismissalType: ev.dismissalType ?? null,
  };
}

const OVERLAY_MODES: OverlayMode[] = ['full', 'standard', 'compact', 'minimal'];
const OVERLAY_THEMES: OverlayTheme[] = ['classic', 'dark', 'transparent'];
const SPONSOR_POSITIONS: OverlaySponsorPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return fallback;
}

function publicHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function defaultPublicBroadcast(mode: OverlayMode = 'standard'): PublicBroadcastDto {
  return {
    theme: 'dark',
    mode,
    header: mode === 'full',
    tournamentLogo: true,
    sponsor: null,
    animations: { four: true, six: true, wicket: true },
    panels: {
      currentOver: mode !== 'minimal',
      batters: mode === 'full' || mode === 'standard',
      bowler: mode === 'full' || mode === 'standard',
      partnership: mode === 'full',
      recentOvers: mode === 'full',
      moments: mode === 'full',
      projected: false,
    },
  };
}

export function publicBroadcastFromSettings(settings: unknown): PublicBroadcastDto {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const raw = root.broadcast && typeof root.broadcast === 'object' ? (root.broadcast as Record<string, unknown>) : {};
  const modeRaw = typeof raw.mode === 'string' ? raw.mode.toLowerCase() : 'standard';
  const mode: OverlayMode = OVERLAY_MODES.includes(modeRaw as OverlayMode) ? (modeRaw as OverlayMode) : 'standard';
  const base = defaultPublicBroadcast(mode);
  const themeRaw = typeof raw.theme === 'string' ? raw.theme.toLowerCase() : base.theme;
  const theme: OverlayTheme = OVERLAY_THEMES.includes(themeRaw as OverlayTheme) ? (themeRaw as OverlayTheme) : base.theme;
  const sponsorRaw = raw.sponsor && typeof raw.sponsor === 'object' ? (raw.sponsor as Record<string, unknown>) : null;
  const posRaw = typeof sponsorRaw?.position === 'string' ? sponsorRaw.position : 'top-right';
  const sponsorName = typeof sponsorRaw?.name === 'string' ? sponsorRaw.name.trim().slice(0, 80) : '';
  const sponsorLogo = publicHttpUrl(sponsorRaw?.logoUrl);
  const sponsorUrl = publicHttpUrl(sponsorRaw?.url);
  const sponsor: OverlaySponsor | null =
    sponsorRaw && (sponsorName || sponsorLogo)
      ? {
          name: sponsorName || null,
          logoUrl: sponsorLogo,
          url: sponsorUrl,
          position: SPONSOR_POSITIONS.includes(posRaw as OverlaySponsorPosition)
            ? (posRaw as OverlaySponsorPosition)
            : 'top-right',
        }
      : null;
  const animations = raw.animations && typeof raw.animations === 'object' ? (raw.animations as Record<string, unknown>) : {};
  const panels = raw.panels && typeof raw.panels === 'object' ? (raw.panels as Record<string, unknown>) : {};
  return {
    theme,
    mode,
    header: asBool(raw.header, base.header),
    tournamentLogo: asBool(raw.tournamentLogo, base.tournamentLogo),
    sponsor,
    animations: {
      four: asBool(animations.four, true),
      six: asBool(animations.six, true),
      wicket: asBool(animations.wicket, true),
    },
    panels: {
      currentOver: asBool(panels.currentOver, base.panels.currentOver),
      batters: asBool(panels.batters, base.panels.batters),
      bowler: asBool(panels.bowler, base.panels.bowler),
      partnership: asBool(panels.partnership, base.panels.partnership),
      recentOvers: asBool(panels.recentOvers, base.panels.recentOvers),
      moments: asBool(panels.moments, base.panels.moments),
      projected: asBool(panels.projected, false),
    },
  };
}

function strikeRate(runs: number, balls: number): number {
  if (!balls) return 0;
  return Number(((runs / balls) * 100).toFixed(2));
}

function economy(runs: number, balls: number, ballsPerOver: number): number {
  if (!balls) return 0;
  return Number((runs / (balls / ballsPerOver)).toFixed(2));
}

function oversFromBalls(balls: number, ballsPerOver: number): string {
  return `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;
}

function nameOf(players: { id: string; name: string }[], id: string | null | undefined): string {
  if (!id) return '—';
  return players.find((p) => p.id === id)?.name ?? '—';
}

export function canJoinLiveRoom(input: {
  publicLiveEnabled: boolean;
  authenticated: boolean;
  visibility?: string | null;
}): boolean {
  if (input.authenticated) return true;
  if (input.visibility === 'PRIVATE') return false;
  return input.publicLiveEnabled;
}

export function buildPublicLiveScore(input: {
  matchId: string;
  publicSlug: string | null;
  title: string;
  status: string;
  venueText: string | null;
  tournamentName: string | null;
  oversLimit: number;
  maxWickets: number;
  ballsPerOver: number;
  homeTeam: PublicTeamDto;
  awayTeam: PublicTeamDto;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  inningsId: string | null;
  inningsNumber: number | null;
  snapshot: LiveSnapshotInput | null;
  players: { id: string; name: string }[];
  recentEvents: PublicBallInput[];
  youtubeVideoId: string | null;
  youtubeEnabled: boolean;
  result?: PublicLiveScoreDto['result'];
  scheduledAt?: string | null;
  tournamentSlug?: string | null;
  visibility?: string;
  share?: { live: boolean; scorecard: boolean; stats: boolean; mvp: boolean };
  viewerCount?: number;
  tournamentLogoUrl?: string | null;
  broadcast?: PublicBroadcastDto | null;
  playingXi?: PublicLiveScoreDto['playingXi'];
  format?: string | null;
  toss?: PublicLiveScoreDto['toss'];
  customRules?: {
    active: boolean;
    summary: string[];
    lastBall: { actual: number; counted: number; reason: string } | null;
    score: { actual: number; counted: number } | null;
    affectsMatchResult: boolean;
    balls?: Array<{ sequence: number; actual: number; counted: number }>;
  } | null;
}): PublicLiveScoreDto {
  const snap = input.snapshot;
  const bpo = input.ballsPerOver;
  const batter = (id: string | null, onStrike: boolean): PublicBatterDto | null => {
    if (!id || !snap) return null;
    const card = snap.batters.find((b) => b.playerId === id);
    return {
      playerId: id,
      name: nameOf(input.players, id),
      runs: card?.runs ?? 0,
      balls: card?.balls ?? 0,
      fours: card?.fours ?? 0,
      sixes: card?.sixes ?? 0,
      strikeRate: strikeRate(card?.runs ?? 0, card?.balls ?? 0),
      onStrike,
    };
  };
  const bowlerCard = snap?.bowlerId ? snap.bowlers.find((b) => b.playerId === snap.bowlerId) : undefined;
  const recentBalls = input.recentEvents.map((ev) => toPublicBall(ev, input.players));
  const lastBall = recentBalls[recentBalls.length - 1] ?? null;
  return {
    matchId: input.matchId,
    publicSlug: input.publicSlug,
    title: input.title,
    status: input.status,
    venueText: input.venueText,
    tournamentName: input.tournamentName,
    oversLimit: input.oversLimit,
    maxWickets: input.maxWickets,
    ballsPerOver: bpo,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    battingTeamId: input.battingTeamId,
    bowlingTeamId: input.bowlingTeamId,
    inningsId: input.inningsId,
    inningsNumber: input.inningsNumber,
    score: {
      runs: snap?.totalRuns ?? 0,
      wickets: snap?.totalWickets ?? 0,
      overs: snap?.oversDisplay ?? '0.0',
      balls: snap?.totalBallsLegal ?? 0,
      runRate: snap?.currentRunRate ?? 0,
      extras: snap?.extras ?? 0,
    },
    striker: batter(snap?.strikerId ?? null, true),
    nonStriker: batter(snap?.nonStrikerId ?? null, false),
    bowler:
      snap?.bowlerId && bowlerCard
        ? {
            playerId: snap.bowlerId,
            name: nameOf(input.players, snap.bowlerId),
            overs: oversFromBalls(bowlerCard.balls, bpo),
            maidens: bowlerCard.maidens,
            runs: bowlerCard.runs,
            wickets: bowlerCard.wickets,
            economy: economy(bowlerCard.runs, bowlerCard.balls, bpo),
          }
        : snap?.bowlerId
          ? {
              playerId: snap.bowlerId,
              name: nameOf(input.players, snap.bowlerId),
              overs: '0.0',
              maidens: 0,
              runs: 0,
              wickets: 0,
              economy: 0,
            }
          : null,
    partnership: snap?.partnership ? { runs: snap.partnership.runs, balls: snap.partnership.balls } : null,
    recentBalls: recentBalls.slice(-18),
    commentary: recentBalls
      .filter((b) => b.commentary)
      .slice(-12)
      .reverse()
      .map((b) => ({
        overs: `${b.overNumber}.${b.ballInOver + 1}`,
        text: b.commentary as string,
      })),
    lastBall,
    youtube: {
      enabled: input.youtubeEnabled && Boolean(input.youtubeVideoId),
      videoId: input.youtubeEnabled ? input.youtubeVideoId : null,
    },
    result: input.result ?? null,
    customRules: input.customRules ?? null,
    scheduledAt: input.scheduledAt ?? null,
    tournamentSlug: input.tournamentSlug ?? null,
    visibility: input.visibility,
    share: input.share,
    viewerCount: input.viewerCount ?? 0,
    tournamentLogoUrl: input.tournamentLogoUrl ?? null,
    broadcast: input.broadcast ?? null,
    playingXi: input.playingXi,
    format: input.format ?? null,
    toss: input.toss ?? null,
  };
}
