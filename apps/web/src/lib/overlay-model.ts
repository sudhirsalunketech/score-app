import type {
  OverlayMode,
  OverlayTheme,
  PublicBallDto,
  PublicBatterDto,
  PublicBroadcastDto,
  PublicLiveScoreDto,
} from '@/types/api';

export type { OverlayMode, OverlayTheme, PublicBroadcastDto };

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

export const OVERLAY_SCENES = ['score', 'intro', 'lineup', 'lower-third', 'target', 'ball-result'] as const;
export type OverlayScene = (typeof OVERLAY_SCENES)[number];

export type OverlayConfig = {
  mode: OverlayMode;
  theme: OverlayTheme;
  scene: OverlayScene;
  lowerThirdRole: 'striker' | 'nonStriker' | 'bowler';
  score: boolean;
  currentOver: boolean;
  batters: boolean;
  bowler: boolean;
  partnership: boolean;
  recentOvers: boolean;
  moments: boolean;
  projected: boolean;
  header: boolean;
  tournamentLogo: boolean;
  sponsor: boolean;
  fan: boolean;
  sound: boolean;
  animations: { four: boolean; six: boolean; wicket: boolean };
};

export type OverlayBurst =
  | { kind: 'FOUR'; key: string }
  | { kind: 'SIX'; key: string }
  | { kind: 'WICKET'; key: string; name: string; detail?: string }
  | { kind: 'PLAYER'; key: string; runs: number; name: string; balls: number }
  | { kind: 'MILESTONE'; key: string; runs: number; team: string; score: string }
  | { kind: 'OVER'; key: string; over: number; runs: number; score: string };

const TEAM_MILESTONES = [50, 100, 150, 200] as const;
const PLAYER_RUNS = [25, 50, 75, 100] as const;
const PLAYER_BALLS = [50, 100] as const;
const MODES: OverlayMode[] = ['full', 'standard', 'compact', 'minimal'];
const THEMES: OverlayTheme[] = ['classic', 'dark', 'transparent'];

export function displayName(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed === '—') return null;
  return trimmed;
}

export function overlayEventId(data: PublicLiveScoreDto): string | null {
  if (!data.lastBall) return data.inningsId ? `${data.inningsId}:0` : null;
  return `${data.inningsId ?? 'inn'}:${data.lastBall.sequence}`;
}

export function parseOverlayConfig(search: string, saved?: PublicBroadcastDto | null): OverlayConfig {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const modeFromQuery = q.get('mode');
  const modeRaw = (modeFromQuery ?? saved?.mode ?? 'standard').toLowerCase();
  const mode: OverlayMode = MODES.includes(modeRaw as OverlayMode) ? (modeRaw as OverlayMode) : 'standard';
  const themeRaw = (q.get('theme') ?? saved?.theme ?? 'dark').toLowerCase();
  const theme: OverlayTheme = THEMES.includes(themeRaw as OverlayTheme) ? (themeRaw as OverlayTheme) : 'dark';
  const defaults = modeFromQuery ? defaultPublicBroadcast(mode) : (saved ?? defaultPublicBroadcast(mode));
  const flag = (key: string, fallback: boolean) => {
    const v = q.get(key);
    if (v == null) return fallback;
    return v === '1' || v === 'true' || v === 'on';
  };
  const sceneRaw = (q.get('scene') ?? 'score').toLowerCase();
  const scene: OverlayScene = (OVERLAY_SCENES as readonly string[]).includes(sceneRaw) ? (sceneRaw as OverlayScene) : 'score';
  const roleRaw = q.get('role');
  const lowerThirdRole: OverlayConfig['lowerThirdRole'] =
    roleRaw === 'nonStriker' || roleRaw === 'bowler' ? roleRaw : 'striker';
  return {
    mode,
    theme,
    scene,
    lowerThirdRole,
    score: flag('score', true),
    currentOver: flag('over', defaults.panels.currentOver),
    batters: flag('batters', defaults.panels.batters),
    bowler: flag('bowler', defaults.panels.bowler),
    partnership: flag('partnership', defaults.panels.partnership),
    recentOvers: flag('recent', defaults.panels.recentOvers),
    moments: flag('moments', defaults.panels.moments),
    projected: flag('projected', defaults.panels.projected),
    header: flag('header', defaults.header),
    tournamentLogo: flag('brand', defaults.tournamentLogo),
    sponsor: flag('sponsor', Boolean(defaults.sponsor)),
    fan: flag('fan', false),
    sound: flag('sound', false),
    animations: {
      four: flag('four', defaults.animations.four),
      six: flag('six', defaults.animations.six),
      wicket: flag('wicket', defaults.animations.wicket),
    },
  };
}

export function overlayQueryString(config: OverlayConfig): string {
  const q = new URLSearchParams();
  if (config.scene !== 'score') q.set('scene', config.scene);
  if (config.scene === 'lower-third' && config.lowerThirdRole !== 'striker') q.set('role', config.lowerThirdRole);
  if (config.mode !== 'standard') q.set('mode', config.mode);
  if (config.theme !== 'dark') q.set('theme', config.theme);
  if (!config.score) q.set('score', '0');
  if (!config.currentOver) q.set('over', '0');
  if (!config.batters) q.set('batters', '0');
  if (!config.bowler) q.set('bowler', '0');
  if (config.partnership) q.set('partnership', '1');
  if (config.recentOvers) q.set('recent', '1');
  if (config.moments) q.set('moments', '1');
  if (config.projected) q.set('projected', '1');
  if (config.header) q.set('header', '1');
  if (!config.tournamentLogo) q.set('brand', '0');
  if (!config.sponsor) q.set('sponsor', '0');
  if (config.sound) q.set('sound', '1');
  if (!config.animations.four) q.set('four', '0');
  if (!config.animations.six) q.set('six', '0');
  if (!config.animations.wicket) q.set('wicket', '0');
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export type OverlayStatus =
  | 'LIVE'
  | 'UPCOMING'
  | 'INNINGS_BREAK'
  | 'DRINKS'
  | 'RAIN'
  | 'DELAY'
  | 'COMPLETE'
  | 'ABANDONED'
  | 'CANCELLED'
  | 'OTHER';

export function overlayStatus(status: string): OverlayStatus {
  if (status === 'LIVE') return 'LIVE';
  if (status === 'INNINGS_BREAK') return 'INNINGS_BREAK';
  if (status === 'DRINKS_BREAK') return 'DRINKS';
  if (status === 'RAIN_DELAY') return 'RAIN';
  if (status === 'MATCH_DELAY') return 'DELAY';
  if (status === 'COMPLETED') return 'COMPLETE';
  if (status === 'ABANDONED') return 'ABANDONED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'SCHEDULED' || status === 'TOSS_PENDING' || status === 'TOSS_COMPLETED' || status === 'DRAFT') {
    return 'UPCOMING';
  }
  return 'OTHER';
}

export function chaseFromLive(data: PublicLiveScoreDto): {
  target: number;
  needed: number;
  ballsLeft: number;
  rrr: number;
} | null {
  if ((data.inningsNumber ?? 1) < 2) return null;
  const first = data.result?.innings.find((inn) => inn.inningsNumber === 1);
  if (!first || first.runs < 0) return null;
  const target = first.runs + 1;
  const needed = Math.max(0, target - data.score.runs);
  const totalBalls = data.oversLimit * data.ballsPerOver;
  const used = data.score.balls ?? 0;
  const ballsLeft = Math.max(0, totalBalls - used);
  if (!Number.isFinite(target) || !Number.isFinite(needed) || !Number.isFinite(ballsLeft)) return null;
  const rrr = ballsLeft > 0 ? (needed * data.ballsPerOver) / ballsLeft : 0;
  if (!Number.isFinite(rrr)) return null;
  return { target, needed, ballsLeft, rrr };
}

export function projectedScore(data: PublicLiveScoreDto): number | null {
  if ((data.inningsNumber ?? 1) !== 1) return null;
  const balls = data.score.balls ?? 0;
  if (balls <= 0) return null;
  const total = data.oversLimit * data.ballsPerOver;
  if (total <= balls) return null;
  const value = Math.round((data.score.runs / balls) * total);
  return Number.isFinite(value) ? value : null;
}

export function currentOverBalls(balls: PublicBallDto[]): PublicBallDto[] {
  if (!balls.length) return [];
  const over = Math.max(...balls.map((b) => b.overNumber));
  return balls.filter((b) => b.overNumber === over).sort((a, b) => a.sequence - b.sequence);
}

export function recentOverSummaries(
  balls: PublicBallDto[],
  limit = 4,
): Array<{ overNumber: number; runs: number; balls: PublicBallDto[] }> {
  const map = new Map<number, PublicBallDto[]>();
  for (const b of balls) {
    const list = map.get(b.overNumber) ?? [];
    list.push(b);
    map.set(b.overNumber, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([overNumber, items]) => ({
      overNumber,
      runs: items.reduce((n, b) => n + (b.batsmanRuns ?? 0) + (b.extraRuns ?? 0), 0),
      balls: items.slice().sort((a, b) => a.sequence - b.sequence),
    }));
}

export function keyMoments(
  balls: PublicBallDto[],
  limit = 4,
): Array<{ key: string; kind: 'wicket' | 'six' | 'four'; name: string | null }> {
  const rows: Array<{ key: string; kind: 'wicket' | 'six' | 'four'; name: string | null }> = [];
  for (const b of [...balls].sort((a, c) => c.sequence - a.sequence)) {
    const who = displayName(b.strikerName);
    if (b.isWicket) rows.push({ key: `w-${b.sequence}`, kind: 'wicket', name: who });
    else if (b.extraType === 'NONE' && b.batsmanRuns === 6) rows.push({ key: `6-${b.sequence}`, kind: 'six', name: who });
    else if (b.extraType === 'NONE' && b.batsmanRuns === 4) rows.push({ key: `4-${b.sequence}`, kind: 'four', name: who });
    if (rows.length >= limit) break;
  }
  return rows;
}

export function chipKind(ball: PublicBallDto): 'four' | 'six' | 'wicket' | 'extra' | 'dot' | 'run' {
  if (ball.isWicket) return 'wicket';
  if (ball.extraType && ball.extraType !== 'NONE') return 'extra';
  if (ball.batsmanRuns === 6) return 'six';
  if (ball.batsmanRuns === 4) return 'four';
  if ((ball.batsmanRuns ?? 0) === 0) return 'dot';
  return 'run';
}

export function chipLabel(ball: PublicBallDto): string {
  if (ball.isWicket) return 'W';
  if (ball.extraType === 'WIDE') return 'WD';
  if (ball.extraType === 'NO_BALL') return 'NB';
  if (ball.extraType === 'BYE') return 'B';
  if (ball.extraType === 'LEG_BYE') return 'LB';
  if (ball.extraType === 'PENALTY') return 'PEN';
  if (ball.batsmanRuns === 4) return '4';
  if (ball.batsmanRuns === 6) return '6';
  const raw = (ball.label ?? '').toUpperCase();
  if (raw) return raw.replace(/^WD.*/, 'WD').replace(/^NB.*/, 'NB');
  return String(ball.batsmanRuns ?? 0);
}

export function structuredEventLabel(ball: PublicBallDto): string {
  const text = ball.commentary?.trim();
  if (text) return text;
  if (ball.isWicket) return dismissalHeadline(ball.dismissalType);
  if (ball.extraType === 'WIDE') return 'WD';
  if (ball.extraType === 'NO_BALL') return 'NB';
  if (ball.extraType === 'BYE') return 'BYE';
  if (ball.extraType === 'LEG_BYE') return 'LB';
  if (ball.extraType === 'PENALTY') return 'PENALTY';
  if (ball.batsmanRuns === 6) return 'SIX';
  if (ball.batsmanRuns === 4) return 'FOUR';
  if ((ball.batsmanRuns ?? 0) === 0) return '0';
  return String(ball.batsmanRuns ?? ball.label ?? '');
}

export function dismissalHeadline(type?: string | null): string {
  switch (type) {
    case 'RUN_OUT':
      return 'RUN OUT';
    case 'STUMPED':
      return 'STUMPED';
    case 'BOWLED':
      return 'BOWLED';
    case 'LBW':
      return 'LBW';
    case 'MANKAD':
      return 'MANKAD';
    case 'CAUGHT':
      return 'CAUGHT';
    case 'HIT_WICKET':
      return 'HIT WICKET';
    default:
      return 'PLAYER OUT';
  }
}

function isLegal(ball: PublicBallDto): boolean {
  return ball.extraType !== 'WIDE' && ball.extraType !== 'NO_BALL';
}

function batterById(data: PublicLiveScoreDto, id?: string | null): PublicBatterDto | null {
  if (!id) return null;
  if (data.striker?.playerId === id) return data.striker;
  if (data.nonStriker?.playerId === id) return data.nonStriker;
  return null;
}

function playerMilestones(prev: PublicLiveScoreDto, next: PublicLiveScoreDto, key: string): OverlayBurst[] {
  const last = next.lastBall;
  if (!last || last.isWicket) return [];
  const bursts: OverlayBurst[] = [];
  const seen = new Set<string>();
  for (const id of [next.striker?.playerId, next.nonStriker?.playerId]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const after = batterById(next, id);
    const before = batterById(prev, id);
    const name = displayName(after?.name);
    if (!after || !name) continue;
    const prevRuns = before?.playerId === id ? before.runs : after.runs;
    const prevBalls = before?.playerId === id ? before.balls : after.balls;
    for (const mark of PLAYER_RUNS) {
      if (prevRuns < mark && after.runs >= mark) {
        bursts.push({ kind: 'PLAYER', key: `${key}-p${id}-${mark}`, runs: mark, name, balls: after.balls });
      }
    }
    for (const mark of PLAYER_BALLS) {
      if (prevBalls < mark && after.balls >= mark && !bursts.some((b) => b.kind === 'PLAYER' && b.name === name)) {
        bursts.push({ kind: 'PLAYER', key: `${key}-pb${id}-${mark}`, runs: after.runs, name, balls: after.balls });
      }
    }
  }
  return bursts;
}

export function classifyOverlayBursts(prev: PublicLiveScoreDto | null, next: PublicLiveScoreDto): OverlayBurst[] {
  const last = next.lastBall;
  if (!last || !prev) return [];
  const sameInnings = Boolean(prev.inningsId && next.inningsId && prev.inningsId === next.inningsId);
  const prevSeq = sameInnings ? (prev.lastBall?.sequence ?? 0) : 0;
  if (last.sequence <= prevSeq) return [];
  const key = `${next.inningsId ?? 'inn'}-${last.sequence}`;
  const battingName =
    displayName(next.battingTeamId === next.awayTeam.id ? next.awayTeam.name : next.homeTeam.name) ?? '';
  const score = `${next.score.runs}/${next.score.wickets}`;
  const bursts: OverlayBurst[] = [];

  if (last.isWicket) {
    bursts.push({
      kind: 'WICKET',
      key,
      name: displayName(last.strikerName) ?? '',
      detail: last.commentary?.trim() || dismissalHeadline(last.dismissalType),
    });
  } else if (last.extraType === 'NONE' && last.batsmanRuns === 6) {
    bursts.push({ kind: 'SIX', key });
  } else if (last.extraType === 'NONE' && last.batsmanRuns === 4) {
    bursts.push({ kind: 'FOUR', key });
  }

  bursts.push(...playerMilestones(prev, next, key));

  const prevRuns = prev.score.runs ?? 0;
  for (const mark of TEAM_MILESTONES) {
    if (prevRuns < mark && next.score.runs >= mark && battingName) {
      bursts.push({ kind: 'MILESTONE', key: `${key}-m${mark}`, runs: mark, team: battingName, score });
    }
  }

  const bpo = next.ballsPerOver || 6;
  if (next.score.balls > 0 && next.score.balls % bpo === 0 && isLegal(last)) {
    const overBalls = currentOverBalls(next.recentBalls);
    const runs = overBalls.reduce((n, b) => n + (b.batsmanRuns ?? 0) + (b.extraRuns ?? 0), 0);
    bursts.push({ kind: 'OVER', key: `${key}-over`, over: last.overNumber + 1, runs, score });
  }
  return bursts;
}

export function classifyOverlayBurst(prev: PublicLiveScoreDto | null, next: PublicLiveScoreDto): OverlayBurst | null {
  return classifyOverlayBursts(prev, next)[0] ?? null;
}

export function filterBursts(bursts: OverlayBurst[], config: OverlayConfig): OverlayBurst[] {
  return bursts.filter((burst) => {
    if (burst.kind === 'FOUR') return config.animations.four;
    if (burst.kind === 'SIX') return config.animations.six;
    if (burst.kind === 'WICKET') return config.animations.wicket;
    return true;
  });
}

export function shouldAnimateSequence(lastSeen: number | null, incoming: number | null): boolean {
  if (incoming == null || lastSeen == null) return false;
  return incoming > lastSeen;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
