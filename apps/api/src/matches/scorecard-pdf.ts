import { isLegalBall, type ExtraType } from '@crickscore/shared';

export type PdfEvent = {
  sequence: number;
  overNumber: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraRuns: number;
  extraType?: string | null;
  penaltyReason?: string | null;
  isWicket?: boolean;
  dismissalType?: string | null;
  dismissedPlayerId?: string | null;
  fielderId?: string | null;
  isUndone?: boolean;
};

export type PdfBatter = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: string | null;
  bowlerId?: string | null;
};

export type PdfBowler = {
  playerId: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  dots?: number;
};

export type PdfInnings = {
  id?: string;
  inningsNumber: number;
  battingTeamId?: string;
  battingTeam?: { name: string };
  totalRuns?: number;
  totalWickets?: number;
  extrasByes?: number;
  extrasLegByes?: number;
  extrasWides?: number;
  extrasNoBalls?: number;
  extrasPenalty?: number;
  snapshot?: {
    totalRuns?: number;
    totalWickets?: number;
    totalBallsLegal?: number;
    oversDisplay?: string;
    currentRunRate?: number;
    extras?: number;
    extrasBreakdown?: { wides: number; noBalls: number; byes: number; legByes: number; penalty: number };
    batters?: PdfBatter[];
    bowlers?: PdfBowler[];
    fallOfWickets?: Array<{ score: number; wicketNumber: number; playerId?: string; overs?: number }>;
  };
  events?: PdfEvent[];
};

export type ScorecardPdfInput = {
  match: {
    title: string;
    format?: string | null;
    venueText?: string | null;
    scheduledAt?: Date | string | null;
    createdAt?: Date | string | null;
    overs: number;
    ballsPerOver?: number;
    playingPerSide?: number;
    resultType?: string | null;
    marginType?: string | null;
    marginValue?: number | null;
    tossDecision?: string | null;
    tossWinnerTeamId?: string | null;
    publicSlug?: string | null;
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeam: { name: string; club?: { name: string } | null };
    awayTeam: { name: string; club?: { name: string } | null };
    resultWinner?: { name: string } | null;
    tournament?: { name: string; club?: { name: string } | null } | null;
    settings?: unknown;
  };
  innings: PdfInnings[];
  names?: Map<string, string>;
  mvp?: Array<{ playerId: string; playerName: string }>;
  scorerName?: string | null;
  matchRules?: {
    hattrickBonusRuns?: number | null;
    hattrickPenaltyRuns?: number | null;
    penaltiesEnabled?: boolean;
  } | null;
  variant?: 'report' | 'summary';
};

export function nameOf(names: Map<string, string> | undefined, id: string | null | undefined) {
  if (!id) return '';
  return names?.get(id) ?? id.slice(0, 8);
}

export function cricketOvers(legalBalls: number, ballsPerOver = 6) {
  const bpo = Math.max(1, ballsPerOver);
  return `${Math.floor(legalBalls / bpo)}.${legalBalls % bpo}`;
}

export function cricketOversFromDecimal(overs: number, ballsPerOver = 6) {
  const bpo = Math.max(1, ballsPerOver);
  let whole = Math.floor(overs + 1e-9);
  let balls = Math.round((overs - whole) * bpo);
  if (balls >= bpo) {
    whole += 1;
    balls = 0;
  }
  return `${whole}.${balls}`;
}

export function strikeRate(runs: number, balls: number) {
  if (!balls) return '0.0';
  return ((runs / balls) * 100).toFixed(1);
}

export function economy(runs: number, balls: number, ballsPerOver = 6) {
  if (!balls) return '0.0';
  return (runs / (balls / Math.max(1, ballsPerOver))).toFixed(1);
}

export function extrasParts(inn: PdfInnings) {
  const b = inn.snapshot?.extrasBreakdown;
  const wides = b?.wides ?? inn.extrasWides ?? 0;
  const nb = b?.noBalls ?? inn.extrasNoBalls ?? 0;
  const byes = b?.byes ?? inn.extrasByes ?? 0;
  const lb = b?.legByes ?? inn.extrasLegByes ?? 0;
  const penalty = b?.penalty ?? inn.extrasPenalty ?? 0;
  const parts: string[] = [];
  if (wides) parts.push(`WD ${wides}`);
  if (nb) parts.push(`NB ${nb}`);
  if (byes) parts.push(`B ${byes}`);
  if (lb) parts.push(`LB ${lb}`);
  if (penalty > 0) parts.push(`Bonus ${penalty}`);
  if (penalty < 0) parts.push(`Penalty ${Math.abs(penalty)}`);
  const total = inn.snapshot?.extras ?? wides + nb + byes + lb + Math.max(0, penalty);
  return { parts, total, label: parts.length ? `( ${parts.join(', ')} )` : '' };
}

export function howOutText(
  batter: PdfBatter,
  events: PdfEvent[] | undefined,
  names: Map<string, string> | undefined,
) {
  if (!batter.isOut) return 'not out';
  const ev = [...(events ?? [])]
    .reverse()
    .find((e) => e.isWicket && (e.dismissedPlayerId ?? e.strikerId) === batter.playerId);
  const type = ev?.dismissalType ?? batter.dismissalType ?? '';
  const bowler = nameOf(names, ev?.bowlerId ?? batter.bowlerId);
  const fielder = nameOf(names, ev?.fielderId);
  switch (type) {
    case 'CAUGHT':
      return fielder && bowler ? `c ${fielder} b ${bowler}` : bowler ? `c & b ${bowler}` : 'caught';
    case 'STUMPED':
      return fielder && bowler ? `st ${fielder} b ${bowler}` : bowler ? `st b ${bowler}` : 'stumped';
    case 'BOWLED':
      return bowler ? `b ${bowler}` : 'bowled';
    case 'LBW':
      return bowler ? `lbw b ${bowler}` : 'lbw';
    case 'RUN_OUT':
      return fielder ? `runout (${fielder})` : 'runout';
    case 'MANKAD':
      return bowler ? `runout (${bowler})` : 'mankad';
    case 'HIT_WICKET':
      return bowler ? `hit wicket b ${bowler}` : 'hit wicket';
    case 'OVER_THE_FENCE':
      return bowler ? `Over The Fence b ${bowler}` : 'Over The Fence';
    case 'ONE_HAND_ONE_BOUNCE':
      return fielder && bowler ? `c ${fielder} b ${bowler}` : 'one hand one bounce';
    case 'OBSTRUCTING':
      return 'obstructing the field';
    case 'HIT_BALL_TWICE':
      return 'hit the ball twice';
    case 'TIMED_OUT':
      return 'timed out';
    case 'RETIRED_HURT':
      return 'retired hurt';
    case 'RETIRED_OUT':
      return 'retired out';
    default:
      return type ? type.toLowerCase().replace(/_/g, ' ') : 'out';
  }
}

export function stumpsBallLabel(ev: PdfEvent) {
  if (ev.isWicket) return 'W';
  const extra = ev.extraType ?? 'NONE';
  if (extra === 'WIDE') return 'Wd';
  if (extra === 'NO_BALL') return ev.batsmanRuns ? String(ev.batsmanRuns) : '+1';
  if (extra === 'PENALTY') return ev.extraRuns < 0 ? String(ev.extraRuns) : `+${ev.extraRuns}`;
  if (extra === 'BYE' || extra === 'LEG_BYE') return String(ev.extraRuns);
  return String(ev.batsmanRuns);
}

export function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatMatchWhen(value?: Date | string | null) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function resultLine(match: ScorecardPdfInput['match']) {
  if (match.resultType === 'TIE') return 'Match tied';
  if (match.resultType === 'NO_RESULT') return 'No result';
  if (match.resultType === 'ABANDONED') return 'Match abandoned';
  if (match.resultWinner?.name) {
    const unit = match.marginType === 'WICKETS' ? 'wickets' : 'runs';
    const margin = match.marginValue != null ? ` by ${match.marginValue} ${unit}` : '';
    return `${match.resultWinner.name} won${margin}`;
  }
  return match.resultType ?? '';
}

function teamName(match: ScorecardPdfInput['match'], teamId?: string) {
  if (teamId && (teamId === match.homeTeamId || teamId === (match.homeTeam as { id?: string }).id)) return match.homeTeam.name;
  if (teamId && (teamId === match.awayTeamId || teamId === (match.awayTeam as { id?: string }).id)) return match.awayTeam.name;
  if (teamId === match.homeTeamId) return match.homeTeam.name;
  return match.awayTeam.name;
}

function inningsTeamName(match: ScorecardPdfInput['match'], inn: PdfInnings) {
  return inn.battingTeam?.name ?? teamName(match, inn.battingTeamId);
}

function potmName(input: ScorecardPdfInput) {
  const settings = (input.match.settings ?? {}) as Record<string, unknown>;
  const id = typeof settings.playerOfTheMatchId === 'string' ? settings.playerOfTheMatchId : null;
  if (id) return nameOf(input.names, id) || input.mvp?.find((p) => p.playerId === id)?.playerName || '';
  return input.mvp?.[0]?.playerName ?? '';
}

function topBatters(inn: PdfInnings, names: Map<string, string> | undefined, limit = 3) {
  return [...(inn.snapshot?.batters ?? [])]
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, limit)
    .map((b) => ({
      name: nameOf(names, b.playerId),
      line: `${b.runs}${b.isOut ? '' : '*'}(${b.balls})`,
    }));
}

function topBowlers(inn: PdfInnings, names: Map<string, string> | undefined, limit = 3) {
  return [...(inn.snapshot?.bowlers ?? [])]
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, limit)
    .map((b) => ({
      name: nameOf(names, b.playerId),
      line: `${b.wickets}-${b.runs}`,
    }));
}

export type OverCell = {
  overNo: number;
  balls: string[];
  batters: { name: string; line: string }[];
  bowlerName: string;
  figures: string;
  footer: string;
};

export function overCells(
  inn: PdfInnings,
  names: Map<string, string> | undefined,
  ballsPerOver: number,
): OverCell[] {
  const live = (inn.events ?? []).filter((e) => !e.isUndone).sort((a, b) => a.sequence - b.sequence);
  const groups = new Map<number, PdfEvent[]>();
  for (const ev of live) {
    const list = groups.get(ev.overNumber) ?? [];
    list.push(ev);
    groups.set(ev.overNumber, list);
  }
  const stats = new Map<string, { runs: number; balls: number }>();
  const bump = (id: string, runs: number, balls: number) => {
    const cur = stats.get(id) ?? { runs: 0, balls: 0 };
    cur.runs += runs;
    cur.balls += balls;
    stats.set(id, cur);
  };
  let score = 0;
  let wickets = 0;
  const cells: OverCell[] = [];
  for (const overNo of [...groups.keys()].sort((a, b) => a - b)) {
    const events = groups.get(overNo) ?? [];
    let overRuns = 0;
    let overWkts = 0;
    let legal = 0;
    for (const ev of events) {
      const extra = ev.extraType ?? 'NONE';
      const isLegal = isLegalBall(extra as ExtraType);
      const teamRuns = ev.batsmanRuns + ev.extraRuns;
      overRuns += teamRuns;
      score += teamRuns;
      if (extra === 'NONE' || extra === 'NO_BALL') bump(ev.strikerId, ev.batsmanRuns, isLegal ? 1 : 0);
      else if (isLegal) bump(ev.strikerId, 0, 1);
      if (isLegal) legal += 1;
      if (ev.isWicket && ev.dismissalType !== 'RETIRED_HURT') {
        overWkts += 1;
        wickets += 1;
      }
    }
    const last = events[events.length - 1];
    const pair = last ? [last.strikerId, last.nonStrikerId] : [];
    const maiden = legal >= ballsPerOver && overRuns === 0 ? 1 : 0;
    cells.push({
      overNo: overNo + 1,
      balls: events.map((e) => stumpsBallLabel(e)),
      batters: pair.map((id) => {
        const s = stats.get(id) ?? { runs: 0, balls: 0 };
        return { name: nameOf(names, id), line: `${s.runs}(${s.balls})` };
      }),
      bowlerName: nameOf(names, last?.bowlerId),
      figures: `${cricketOvers(legal, ballsPerOver)} - ${maiden} - ${overRuns} - ${overWkts}`,
      footer: `Overs ${overNo + 1} Runs ${overRuns} Score ${score}-${wickets}`,
    });
  }
  return cells;
}

function bowlerExtras(events: PdfEvent[] | undefined, bowlerId: string) {
  let wd = 0;
  let nb = 0;
  let fours = 0;
  let sixes = 0;
  for (const ev of events ?? []) {
    if (ev.bowlerId !== bowlerId || ev.isUndone) continue;
    if (ev.extraType === 'WIDE') wd += 1;
    if (ev.extraType === 'NO_BALL') nb += 1;
    if ((ev.extraType ?? 'NONE') === 'NONE' || ev.extraType === 'NO_BALL') {
      if (ev.batsmanRuns === 4) fours += 1;
      if (ev.batsmanRuns === 6) sixes += 1;
    }
  }
  return { wd, nb, fours, sixes };
}

function esc(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** App brand palette (teal/green), reused everywhere instead of one-off inline RGB literals. */
const BRAND = { r: 0, g: 0.537, b: 0.482 };
const INK = { r: 0.12, g: 0.12, b: 0.12 };
const MUTED = { r: 0.4, g: 0.4, b: 0.4 };
const RULE = { r: 0.85, g: 0.85, b: 0.85 };
const CARD_BG = { r: 0.95, g: 0.96, b: 0.96 };

/**
 * There's no real font-metrics table here (Helvetica-only, hand-rolled PDF, no library) — this
 * approximates average glyph width to stop long player/team names from colliding with the next
 * fixed-x column, since `text()` itself never measures or wraps.
 */
function fitText(text: string, maxWidthPt: number, size: number) {
  const avgCharWidth = size * 0.52;
  const maxChars = Math.max(1, Math.floor(maxWidthPt / avgCharWidth));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

type PdfOp =
  | { kind: 'text'; x: number; y: number; size: number; bold?: boolean; text: string; r?: number; g?: number; b?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; g: number; b: number };

const PAGE_W = 595;
const PAGE_H = 842;

class PdfDoc {
  private pages: PdfOp[][] = [[]];
  y = 760;

  get pageCount() {
    return this.pages.length;
  }

  private get cur() {
    return this.pages[this.pages.length - 1]!;
  }

  newPage() {
    this.pages.push([]);
    this.y = 760;
  }

  ensure(h: number) {
    if (this.y - h < 52) this.newPage();
  }

  /** Peek whether the next `h` points of content would trigger a page break, without side effects. */
  willBreak(h: number) {
    return this.y - h < 52;
  }

  rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    this.cur.push({ kind: 'rect', x, y, w, h, r, g, b });
  }

  /** Light gray card background behind a block whose height the caller already knows. */
  card(x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h, CARD_BG.r, CARD_BG.g, CARD_BG.b);
  }

  text(text: string, x: number, y: number, size: number, opts?: { bold?: boolean; r?: number; g?: number; b?: number }) {
    this.cur.push({
      kind: 'text',
      x,
      y,
      size,
      bold: opts?.bold,
      text,
      r: opts?.r,
      g: opts?.g,
      b: opts?.b,
    });
  }

  line(text: string, opts?: { size?: number; bold?: boolean; x?: number; r?: number; g?: number; b?: number; gap?: number }) {
    const size = opts?.size ?? 10;
    const gap = opts?.gap ?? size + 4;
    this.ensure(gap);
    this.text(text, opts?.x ?? 40, this.y, size, opts);
    this.y -= gap;
  }

  gap(n = 8) {
    this.y -= n;
  }

  /** Bold teal heading + a thin rule underneath — the reference report's plain section style. */
  section(title: string) {
    this.ensure(24);
    this.text(title, 40, this.y, 11, { bold: true, ...BRAND });
    this.rect(40, this.y - 6, PAGE_W - 80, 0.75, RULE.r, RULE.g, RULE.b);
    this.y -= 22;
  }

  toStreams() {
    return this.pages.map((ops, i) => {
      const chunks: string[] = [];
      chunks.push('0.12 0.12 0.12 rg');
      chunks.push(`BT /F1 8 Tf 40 ${PAGE_H - 28} Td (${esc("Match report created from")}) Tj ET`);
      chunks.push(`BT /F2 16 Tf 40 ${PAGE_H - 46} Td (${esc('CRICKSCORE')}) Tj ET`);
      for (const op of ops) {
        if (op.kind === 'rect') {
          chunks.push(`${op.r} ${op.g} ${op.b} rg ${op.x} ${op.y} ${op.w} ${op.h} re f`);
        } else {
          const font = op.bold ? '/F2' : '/F1';
          const r = op.r ?? 0.12;
          const g = op.g ?? 0.12;
          const b = op.b ?? 0.12;
          chunks.push(`${r} ${g} ${b} rg`);
          chunks.push(`BT ${font} ${op.size} Tf ${op.x} ${op.y} Td (${esc(op.text.slice(0, 140))}) Tj ET`);
        }
      }
      chunks.push('0.45 0.45 0.45 rg');
      chunks.push(`BT /F1 8 Tf 40 28 Td (${esc(`${i + 1} of ${this.pages.length}`)}) Tj ET`);
      return chunks.join('\n');
    });
  }
}

function infoRow(doc: PdfDoc, label: string, value: string) {
  if (!value) return;
  doc.ensure(14);
  doc.text(label, 40, doc.y, 9, { bold: true });
  wrap(value, 62).forEach((line, i) => {
    if (i) doc.y -= 12;
    doc.text(line, 150, doc.y, 9);
  });
  doc.y -= 14;
}

function wrap(text: string, width: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function writeCover(doc: PdfDoc, input: ScorecardPdfInput) {
  const m = input.match;
  const bpo = m.ballsPerOver ?? 6;
  doc.line('Match Report', { size: 22, bold: true, gap: 26 });

  // Team score cards — one light card per innings, teal team name + bold score line.
  for (const inn of input.innings) {
    const team = fitText(inningsTeamName(m, inn), 420, 13);
    const runs = inn.snapshot?.totalRuns ?? inn.totalRuns ?? 0;
    const wkts = inn.snapshot?.totalWickets ?? inn.totalWickets ?? 0;
    const overs = inn.snapshot?.oversDisplay ?? cricketOvers(inn.snapshot?.totalBallsLegal ?? 0, bpo);
    const cardH = 34;
    doc.ensure(cardH + 6);
    doc.card(36, doc.y - cardH + 14, PAGE_W - 72, cardH);
    doc.text(team, 44, doc.y, 13, { bold: true, ...BRAND });
    doc.y -= 15;
    doc.text(`${runs}-${wkts} in ${overs} overs`, 44, doc.y, 11, { bold: true, ...INK });
    doc.y -= 19;
    doc.gap(6);
  }

  // Result + Player Of The Match — kept together so a page break never separates them.
  const result = resultLine(m);
  const potm = potmName(input);
  const resultLines = result ? wrap(result, 78) : [];
  const resultBlockH = (result ? 22 + resultLines.length * 14 : 0) + 22 + 16;
  doc.ensure(resultBlockH);
  if (result) {
    doc.section('Result');
    resultLines.forEach((line) => doc.line(line, { size: 12, bold: true, gap: 14 }));
  }
  doc.section('Player Of The Match');
  doc.line(potm || '—', { size: 12, bold: true, gap: 16 });

  // Match Information — label/value rows on a single light card.
  const tossTeam =
    m.tossWinnerTeamId === m.homeTeamId || m.tossWinnerTeamId === (m.homeTeam as { id?: string }).id
      ? m.homeTeam.name
      : m.tossWinnerTeamId
        ? m.awayTeam.name
        : '';
  const toss = tossTeam
    ? `${tossTeam} Opted To ${m.tossDecision === 'BAT' ? 'Bat' : m.tossDecision === 'BOWL' ? 'Bowl' : m.tossDecision ?? ''}`
    : '';
  const club = m.tournament?.club?.name || m.homeTeam.club?.name || m.awayTeam.club?.name || '';
  const pair = (label: string, value: string): [string, string] => [label, value];
  const infoPairs = [
    pair('Tournament', m.tournament?.name ?? ''),
    pair('Club', club),
    pair('Match Title', m.title),
    pair('Match Format', m.format ?? ''),
    pair('Playing', m.playingPerSide != null ? `${m.playingPerSide} Per Side` : ''),
    pair('Overs', String(m.overs)),
    pair('Venue', m.venueText ?? ''),
    pair('Date & Time', formatMatchWhen(m.scheduledAt ?? m.createdAt)),
    pair('Toss', toss),
    pair('Scorer', input.scorerName ?? ''),
    pair('Match ID', m.publicSlug ?? ''),
  ].filter(([, value]) => value);

  const infoRowsH = infoPairs.reduce((sum, [, value]) => sum + Math.max(1, wrap(value, 62).length) * 12 + 2, 0) + 8;
  doc.ensure(22 + Math.min(infoRowsH, 400));
  doc.section('Match Information');
  doc.card(36, doc.y - infoRowsH + 12, PAGE_W - 72, infoRowsH);
  for (const [label, value] of infoPairs) infoRow(doc, label, value);
  doc.gap(6);

  // Match Summary — one card per innings (team/score line + top batters/bowlers).
  doc.section('Match Summary');
  for (const inn of input.innings) {
    const team = fitText(inningsTeamName(m, inn), 300, 11);
    const runs = inn.snapshot?.totalRuns ?? inn.totalRuns ?? 0;
    const wkts = inn.snapshot?.totalWickets ?? inn.totalWickets ?? 0;
    const overs = inn.snapshot?.oversDisplay ?? cricketOvers(inn.snapshot?.totalBallsLegal ?? 0, bpo);
    const bats = topBatters(inn, input.names);
    const bowls = topBowlers(inn, input.names);
    const rows = Math.max(bats.length, bowls.length);
    const blockH = 17 + rows * 13 + 10;
    doc.ensure(blockH);
    doc.card(36, doc.y - blockH + 15, PAGE_W - 72, blockH);
    doc.text(`${team}  ${runs}-${wkts} (${overs})`, 44, doc.y, 11, { bold: true, ...BRAND });
    doc.y -= 17;
    for (let i = 0; i < rows; i += 1) {
      const left = bats[i] ? `${fitText(bats[i]!.name, 200, 9)} ${bats[i]!.line}` : '';
      const right = bowls[i] ? `${fitText(bowls[i]!.name, 200, 9)} ${bowls[i]!.line}` : '';
      doc.text(left, 44, doc.y, 9);
      doc.text(right, 320, doc.y, 9);
      doc.y -= 13;
    }
    doc.y -= 10;
    doc.gap(6);
  }
}

function writeScorecard(doc: PdfDoc, input: ScorecardPdfInput, inn: PdfInnings) {
  const m = input.match;
  const bpo = m.ballsPerOver ?? 6;
  const team = fitText(inningsTeamName(m, inn), 310, 10);
  const nth = ordinal(inn.inningsNumber);
  doc.section(`${nth} Innings Scorecard`);

  const battingHeader = () => {
    doc.ensure(14);
    doc.text(team, 40, doc.y, 10, { bold: true });
    doc.text('R', 360, doc.y, 9, { bold: true });
    doc.text('B', 392, doc.y, 9, { bold: true });
    doc.text('4s', 424, doc.y, 9, { bold: true });
    doc.text('6s', 456, doc.y, 9, { bold: true });
    doc.text('SR', 488, doc.y, 9, { bold: true });
    doc.rect(40, doc.y - 4, PAGE_W - 80, 0.75, RULE.r, RULE.g, RULE.b);
    doc.y -= 14;
  };
  battingHeader();
  for (const b of inn.snapshot?.batters ?? []) {
    const how = howOutText(b, inn.events, input.names);
    if (doc.willBreak(24)) {
      doc.newPage();
      battingHeader();
    }
    doc.text(fitText(nameOf(input.names, b.playerId), 310, 10), 40, doc.y, 10, { bold: true });
    doc.text(String(b.runs), 360, doc.y, 9);
    doc.text(String(b.balls), 392, doc.y, 9);
    doc.text(String(b.fours), 424, doc.y, 9);
    doc.text(String(b.sixes), 456, doc.y, 9);
    doc.text(strikeRate(b.runs, b.balls), 488, doc.y, 9);
    doc.y -= 12;
    doc.text(how, 40, doc.y, 8, { ...MUTED });
    doc.y -= 12;
  }
  const extras = extrasParts(inn);
  const overs = inn.snapshot?.oversDisplay ?? cricketOvers(inn.snapshot?.totalBallsLegal ?? 0, bpo);
  const total = inn.snapshot?.totalRuns ?? inn.totalRuns ?? 0;
  const wkts = inn.snapshot?.totalWickets ?? inn.totalWickets ?? 0;
  const rr = inn.snapshot?.currentRunRate != null ? inn.snapshot.currentRunRate.toFixed(1) : economy(total, inn.snapshot?.totalBallsLegal ?? 0, bpo);
  doc.gap(4);
  doc.line(`Extras ${extras.label}  ${extras.total}     Overs ${overs}`, { size: 9, gap: 13 });
  doc.line(`Total  ${total}/${wkts}     Run Rate ${rr}`, { size: 10, bold: true, gap: 16, ...BRAND });
  const fow = inn.snapshot?.fallOfWickets ?? [];
  if (fow.length) {
    doc.line('Fall Of Wickets', { size: 10, bold: true, gap: 13 });
    const line = fow
      .map((f) => {
        const ov = f.overs != null ? cricketOversFromDecimal(f.overs, bpo) : '';
        const who = nameOf(input.names, f.playerId);
        return `${f.score}-${f.wicketNumber} (${who}${ov ? `, ${ov}` : ''})`;
      })
      .join(', ');
    wrap(line, 88).forEach((row) => doc.line(row, { size: 9, gap: 12 }));
  }
  doc.gap(8);

  const bowlingHeaders = ['O', 'M', 'R', 'W', 'Eco', '0s', '4s', '6s', 'Wd', 'NB'];
  const bowlingHeader = () => {
    doc.ensure(14);
    doc.text('Bowler', 40, doc.y, 9, { bold: true });
    bowlingHeaders.forEach((h, i) => doc.text(h, 250 + i * 30, doc.y, 8, { bold: true }));
    doc.rect(40, doc.y - 4, PAGE_W - 80, 0.75, RULE.r, RULE.g, RULE.b);
    doc.y -= 13;
  };
  bowlingHeader();
  for (const b of inn.snapshot?.bowlers ?? []) {
    const x = bowlerExtras(inn.events, b.playerId);
    if (doc.willBreak(13)) {
      doc.newPage();
      bowlingHeader();
    }
    doc.text(fitText(nameOf(input.names, b.playerId), 200, 9), 40, doc.y, 9);
    const cols = [
      cricketOvers(b.balls, bpo),
      String(b.maidens),
      String(b.runs),
      String(b.wickets),
      economy(b.runs, b.balls, bpo),
      String(b.dots ?? 0),
      String(x.fours),
      String(x.sixes),
      String(x.wd),
      String(x.nb),
    ];
    cols.forEach((c, i) => doc.text(c, 250 + i * 30, doc.y, 8));
    doc.y -= 13;
  }
}

function writeOverComparison(doc: PdfDoc, input: ScorecardPdfInput) {
  const bpo = input.match.ballsPerOver ?? 6;
  const leftInn = input.innings.find((i) => i.inningsNumber === 1) ?? input.innings[0];
  const rightInn = input.innings.find((i) => i.inningsNumber === 2);
  if (!leftInn) return;
  const left = overCells(leftInn, input.names, bpo);
  const right = rightInn ? overCells(rightInn, input.names, bpo) : [];
  const rows = Math.max(left.length, right.length);
  if (!rows) return;
  const leftTeam = fitText(inningsTeamName(input.match, leftInn), 260, 9);
  const rightTeam = rightInn ? fitText(inningsTeamName(input.match, rightInn), 260, 9) : '';
  doc.section('Over Comparison');

  const teamHeader = () => {
    doc.ensure(14);
    doc.text(leftTeam, 40, doc.y, 9, { bold: true, ...BRAND });
    if (rightTeam) doc.text(rightTeam, 318, doc.y, 9, { bold: true, ...BRAND });
    doc.y -= 16;
  };
  teamHeader();

  const cell = (c: OverCell | undefined, x: number, y0: number, height: number) => {
    if (!c) return;
    doc.card(x - 4, y0 - height + 8, 262, height - 6);
    doc.text(c.balls.join('  '), x, y0, 8);
    let yy = y0 - 12;
    for (const b of c.batters) {
      doc.text(`${fitText(b.name, 200, 8)} ${b.line}`, x, yy, 8);
      yy -= 11;
    }
    doc.text(fitText(c.bowlerName, 200, 8), x, yy, 8, { bold: true });
    yy -= 11;
    doc.text(c.figures, x, yy, 8);
    yy -= 11;
    doc.text(c.footer, x, yy, 8, { ...MUTED });
  };

  for (let i = 0; i < rows; i += 1) {
    const height = 72;
    if (doc.willBreak(height)) {
      doc.newPage();
      teamHeader();
    }
    const y0 = doc.y;
    cell(left[i], 40, y0, height);
    cell(right[i], 318, y0, height);
    doc.y = y0 - height;
  }
}

const PENALTY_REASON_LABELS: Record<string, string> = {
  TOURNAMENT_PENALTY: 'Tournament Penalty',
  SLOW_OVER_RATE: 'Slow Over Rate',
  MISCONDUCT: 'Misconduct',
  ILLEGAL_EQUIPMENT: 'Illegal Equipment',
  OTHER: 'Other',
};

function writeMatchRules(doc: PdfDoc, input: ScorecardPdfInput) {
  const m = input.match;
  const rules = input.matchRules;
  doc.section('Match Rules');
  infoRow(doc, 'Format', m.format ?? '');
  infoRow(doc, 'Overs', String(m.overs));
  infoRow(doc, 'Balls/Over', String(m.ballsPerOver ?? 6));
  if (rules?.hattrickBonusRuns) infoRow(doc, 'Hattrick Bonus', `+${rules.hattrickBonusRuns} runs`);
  if (rules?.hattrickPenaltyRuns) infoRow(doc, 'Hattrick Penalty', `-${rules.hattrickPenaltyRuns} runs`);
  if (rules?.penaltiesEnabled) infoRow(doc, 'Penalties', 'Enabled');
  doc.gap(6);
}

type SpecialScoringRow = { team: string; runs: number; reason: string };

function specialScoringRows(input: ScorecardPdfInput): SpecialScoringRow[] {
  const rows: SpecialScoringRow[] = [];
  for (const inn of input.innings) {
    const team = inningsTeamName(input.match, inn);
    for (const ev of inn.events ?? []) {
      if (ev.isUndone) continue;
      if ((ev.extraType ?? 'NONE') !== 'PENALTY' || !ev.extraRuns) continue;
      const reason = ev.penaltyReason ? PENALTY_REASON_LABELS[ev.penaltyReason] ?? ev.penaltyReason : 'Penalty';
      rows.push({ team, runs: ev.extraRuns, reason });
    }
  }
  return rows;
}

function writeSpecialScoring(doc: PdfDoc, input: ScorecardPdfInput) {
  const rows = specialScoringRows(input);
  if (!rows.length) return;
  doc.section('Special Scoring');
  const header = () => {
    doc.ensure(14);
    doc.text('Event', 40, doc.y, 9, { bold: true });
    doc.text('Team', 220, doc.y, 9, { bold: true });
    doc.text('Runs', 340, doc.y, 9, { bold: true });
    doc.text('Reason', 400, doc.y, 9, { bold: true });
    doc.rect(40, doc.y - 4, PAGE_W - 80, 0.75, RULE.r, RULE.g, RULE.b);
    doc.y -= 14;
  };
  header();
  for (const row of rows) {
    if (doc.willBreak(14)) {
      doc.newPage();
      header();
    }
    doc.text(row.runs < 0 ? 'Penalty' : 'Bonus', 40, doc.y, 9);
    doc.text(fitText(row.team, 110, 9), 220, doc.y, 9);
    doc.text(row.runs < 0 ? String(row.runs) : `+${row.runs}`, 340, doc.y, 9);
    doc.text(row.reason, 400, doc.y, 9);
    doc.y -= 14;
  }
  doc.gap(6);
}

function assemblePdf(streams: string[]) {
  const pageObjs: string[] = [];
  const contentObjs: string[] = [];
  const kids: string[] = [];
  let obj = 5;
  for (const stream of streams) {
    const pageNo = obj;
    const contentNo = obj + 1;
    kids.push(`${pageNo} 0 R`);
    pageObjs.push(
      `${pageNo} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentNo} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >> endobj`,
    );
    contentObjs.push(`${contentNo} 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`);
    obj += 2;
  }
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids.join(' ')}] /Count ${streams.length} >> endobj`,
    '3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
    ...pageObjs.flatMap((p, i) => [p, contentObjs[i]!]),
  ];
  let offset = 9;
  const xref = ['0000000000 65535 f '];
  const body = objects
    .map((item) => {
      xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
      const chunk = `${item}\n`;
      offset += Buffer.byteLength(chunk);
      return chunk;
    })
    .join('');
  return Buffer.from(
    `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xref.join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`,
    'utf8',
  );
}

export function renderScorecardPdf(input: ScorecardPdfInput): Buffer {
  const doc = new PdfDoc();
  writeCover(doc, input);
  writeMatchRules(doc, input);
  if (input.variant !== 'summary') {
    for (const inn of input.innings) {
      doc.newPage();
      writeScorecard(doc, input, inn);
    }
    if (input.innings.some((inn) => (inn.events ?? []).length)) {
      doc.newPage();
      writeOverComparison(doc, input);
    }
    writeSpecialScoring(doc, input);
  }
  return assemblePdf(doc.toStreams());
}
