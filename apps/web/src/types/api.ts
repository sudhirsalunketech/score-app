export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export type PenaltyReason = 'TOURNAMENT_PENALTY' | 'SLOW_OVER_RATE' | 'MISCONDUCT' | 'ILLEGAL_EQUIPMENT' | 'OTHER';

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'MANKAD'
  | 'OVER_THE_FENCE'
  | 'ONE_HAND_ONE_BOUNCE'
  | 'OBSTRUCTING'
  | 'HIT_BALL_TWICE'
  | 'TIMED_OUT'
  | 'RETIRED_HURT'
  | 'RETIRED_OUT';

export type MatchStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'TOSS_PENDING'
  | 'TOSS_COMPLETED'
  | 'LIVE'
  | 'INNINGS_BREAK'
  | 'DRINKS_BREAK'
  | 'RAIN_DELAY'
  | 'MATCH_DELAY'
  | 'SUPER_OVER_PENDING'
  | 'SUPER_OVER'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'CANCELLED';

export type MatchFormat = 'T10' | 'T20' | 'HUNDRED' | 'ODI' | 'TEST' | 'CLUB' | 'CUSTOM';
export type BallType = 'TENNIS' | 'LEATHER' | 'RUBBER';
export type TossDecision = 'BAT' | 'BOWL';

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  locale?: string | null;
  phone?: string | null;
  isBeta?: boolean;
  player?: {
    id: string;
    name: string;
    photoUrl?: string | null;
    role?: string | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    profileCode?: string | null;
    jerseyNo?: number | null;
    teams?: Team[];
    stats?: {
      matches?: number;
      innings?: number;
      runs?: number;
      balls?: number;
      highestScore?: number;
      notOuts?: number;
      wickets?: number;
      oversBowled?: number;
      runsConceded?: number;
      maidens?: number;
      catches?: number;
      stumpings?: number;
      runOuts?: number;
      bestBowlWkts?: number;
      bestBowlRuns?: number;
    } | null;
  } | null;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type Team = {
  id: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  location?: string | null;
  homeGround?: string | null;
  clubId?: string | null;
  createdById?: string | null;
  club?: Club | null;
  _count?: { players?: number };
  players?: TeamPlayer[];
  stats?: { matches?: number; wins?: number; losses?: number; ties?: number; noResults?: number };
};

export type Player = {
  id: string;
  name: string;
  profileCode?: string | null;
  photoUrl?: string | null;
  role?: string;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  city?: string | null;
  profile?: { jerseyNo?: number | null } | null;
  teams?: { team: Team; jerseyNo?: number | null; current?: boolean }[];
  formerTeams?: { team: Team; jerseyNo?: number | null; current?: boolean }[];
  careerStats?: {
    matches?: number;
    innings?: number;
    runs?: number;
    balls?: number;
    highestScore?: number;
    notOuts?: number;
    wickets?: number;
    oversBowled?: number;
    runsConceded?: number;
    maidens?: number;
    catches?: number;
    stumpings?: number;
    runOuts?: number;
    bestBowlWkts?: number;
    bestBowlRuns?: number;
  } | null;
};

export type TeamPlayer = {
  id: string;
  teamId: string;
  playerId: string;
  jerseyNo?: number | null;
  player: Player;
};

export type Club = {
  id: string;
  name: string;
  city?: string | null;
  establishedYear?: number | null;
  logoUrl?: string | null;
  description?: string | null;
  createdById?: string | null;
  ballTypes?: BallType[];
  members?: Array<{ id: string; role: string; user: { id: string; name: string; email: string; avatarUrl?: string | null } }>;
  _count?: { teams?: number };
};

export type TournamentGroup = {
  id: string;
  name: string;
  sortOrder?: number;
  teams: { id: string; teamId: string; team: Team }[];
};

export type Tournament = {
  id: string;
  name: string;
  clubId?: string | null;
  club?: Club | null;
  season?: string | null;
  coverImageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdById?: string | null;
  publicSlug?: string | null;
  visibility?: ShareVisibility;
  stageType?: 'GROUP_STAGE' | 'KNOCKOUT' | 'GROUP_AND_KNOCKOUT';
  lifecycle?: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  knockoutTeamCount?: number | null;
  includeThirdPlace?: boolean;
  pairingMode?: string;
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  defaultOvers?: number | null;
  defaultMaxWickets?: number | null;
  defaultBallsPerOver?: number | null;
  defaultWidesCountAsLegal?: boolean;
  defaultNoBallsCountAsLegal?: boolean;
  defaultOverWiseRulesEnabled?: boolean;
  defaultOverRules?: Array<{ overNumber: number; name?: string | null; ruleType: OverRuleType; enabled?: boolean; config: Record<string, unknown> }> | null;
  winningBonusPoints?: number;
  tiePoints?: number;
  groups?: TournamentGroup[];
  matches?: Match[];
  _count?: { matches?: number };
  myPermissions?: string[];
};

export type TournamentHomeStats = {
  mostRuns: { playerId: string; playerName: string; teamName: string; value: number } | null;
  mostWickets: { playerId: string; playerName: string; teamName: string; value: number } | null;
  sixes: number;
  fours: number;
};

export type TournamentNamedStat = {
  playerId: string;
  playerName: string;
  photoUrl?: string | null;
  teamId?: string | null;
  teamName: string;
  matchId?: string | null;
  matchTitle?: string | null;
};

export type TournamentDashboard = {
  tournamentId: string;
  header: {
    name: string;
    status: 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED';
    season: string | null;
    club: string | null;
    format: string | null;
    overs: number | null;
    maxWickets: number | null;
    teams: number;
    matches: number;
    completed: number;
    live: number;
    upcoming: number;
    abandoned: number;
    cancelled: number;
  };
  summary: {
    teams: number;
    matches: number;
    completed: number;
    upcoming: number;
    live: number;
    totalRuns: number;
    totalWickets: number;
    totalOvers: string;
    totalBalls: number;
    fours: number;
    sixes: number;
    extras: number;
    liveTotals: { totalRuns: number; totalWickets: number; fours: number; sixes: number } | null;
  };
  hasCompletedStats: boolean;
  performers: {
    bestBatsman: (TournamentNamedStat & {
      runs: number;
      average: number | null;
      strikeRate: number;
      highest: number;
      fours: number;
      sixes: number;
      innings: number;
    }) | null;
    bestBowler: (TournamentNamedStat & {
      wickets: number;
      economy: number;
      average: number | null;
      best: string;
      overs: string;
      balls: number;
    }) | null;
    bestFielder: (TournamentNamedStat & {
      catches: number;
      runOuts: number;
      stumpings: number;
      dismissals: number;
    }) | null;
    mvp: (TournamentNamedStat & {
      score: number;
      batting: number;
      bowling: number;
      fielding: number;
      runs: number;
      wickets: number;
      catches: number;
      matches: number;
    }) | null;
  };
  batting: Array<
    TournamentNamedStat & {
      matches: number;
      innings: number;
      runs: number;
      balls: number;
      average: number | null;
      strikeRate: number;
      highest: number;
      fours: number;
      sixes: number;
      notOuts: number;
    }
  >;
  bowling: Array<
    TournamentNamedStat & {
      matches: number;
      overs: string;
      balls: number;
      runs: number;
      wickets: number;
      economy: number;
      average: number | null;
      best: string;
      maidens: number;
    }
  >;
  fielding: Array<
    TournamentNamedStat & {
      matches: number;
      catches: number;
      runOuts: number;
      stumpings: number;
      dismissals: number;
    }
  >;
  records: {
    mostRuns: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    highestScore: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostFours: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostSixes: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    bestStrikeRate: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostWickets: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    bestBowling: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    bestEconomy: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostCatches: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostRunOuts: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    mostStumpings: (TournamentNamedStat & { value: number | string; extra?: string | null }) | null;
    highestTeamScore: {
      teamId: string;
      teamName: string;
      runs: number;
      wickets: number;
      overs: string;
      matchId: string;
      matchTitle: string;
    } | null;
    lowestTeamScore: {
      teamId: string;
      teamName: string;
      runs: number;
      wickets: number;
      overs: string;
      matchId: string;
      matchTitle: string;
    } | null;
    largestWinningMargin: {
      matchId: string;
      matchTitle: string;
      winnerTeamId: string | null;
      winnerName: string | null;
      marginType: string | null;
      marginValue: number | null;
    } | null;
    closestMatch: {
      matchId: string;
      matchTitle: string;
      winnerTeamId: string | null;
      winnerName: string | null;
      marginType: string | null;
      marginValue: number | null;
    } | null;
    mostTeamWins: { teamId: string; teamName: string; wins: number } | null;
  };
  players: Array<{
    playerId: string;
    playerName: string;
    photoUrl: string | null;
    teamId: string | null;
    teamName: string;
    matches: number;
    runs: number;
    wickets: number;
    catches: number;
    runOuts: number;
    stumpings: number;
  }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    logoUrl: string | null;
    matches: number;
    won: number;
    lost: number;
    tied: number;
    noResult: number;
    points: number;
    runsScored: number;
    runsConceded: number;
    wickets: number;
    bestBatsman: { playerId: string; playerName: string; runs: number } | null;
    bestBowler: { playerId: string; playerName: string; wickets: number } | null;
  }>;
  matchAwards: Array<{
    matchId: string;
    matchTitle: string;
    homeName: string;
    awayName: string;
    playerId: string;
    playerName: string;
    photoUrl: string | null;
    teamName: string;
    score: number;
  }>;
  scorecards: Array<{
    matchId: string;
    matchTitle: string;
    homeName: string;
    awayName: string;
    result: string | null;
    status: string;
    scheduledAt: string | null;
  }>;
  quizEnabled: boolean;
  mvpFormula: string;
};

export type TournamentPlayerStats = {
  tournamentId: string;
  tournamentName: string;
  scope: 'tournament';
  player: { playerId: string; playerName: string; photoUrl: string | null; teamName: string };
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  average: number | null;
  strikeRate: number;
  highest: number;
  wickets: number;
  economy: number;
  bestBowling: string | null;
  overs: string;
  catches: number;
  runOuts: number;
  stumpings: number;
  runsConceded?: number;
  fours?: number;
  sixes?: number;
  fifties?: number;
  hundreds?: number;
  mvpPoints?: number;
  mvpRank?: number | null;
  tournamentRank?: number | null;
  season?: string | null;
  matchesDetail?: Array<{
    matchId: string;
    title: string;
    when: string | null;
    homeName: string;
    awayName: string;
    batting: { runs: number; balls: number } | null;
    bowling: { wickets: number; runs: number } | null;
    fielding: { catches: number; runOuts: number; stumpings: number };
    mvp: { total: number };
  }>;
};

export type OverRuleType = 'TARGET' | 'MAPPING' | 'CUSTOM';

export type OverRuleRow = {
  overNumber: number;
  name: string | null;
  displayName: string;
  ruleType: OverRuleType;
  config: Record<string, unknown>;
  enabled: boolean;
  locked: boolean;
};

export type OverRuleResultRow = {
  inningsId: string;
  overNumber: number;
  ruleName: string | null;
  ruleType: string | null;
  actualRuns: number;
  actualWickets: number;
  bonusRuns: number;
  penaltyRuns: number;
};

export type OverRulesResponse = {
  enabled: boolean;
  overs: number;
  rules: OverRuleRow[];
  results: OverRuleResultRow[];
};

export type Innings = {
  id: string;
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  status: string;
  totalRuns: number;
  totalWickets: number;
  totalBallsLegal: number;
  extras: number;
  targetRuns?: number | null;
  isSuperOver?: boolean;
  events?: BallEvent[];
  snapshot?: InningsSnapshot;
};

export type BallEvent = {
  id: string;
  sequence: number;
  idempotencyKey: string;
  overNumber: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraRuns: number;
  totalRuns?: number;
  extraType: ExtraType;
  isWicket: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  fielderId?: string | null;
  penaltyReason?: string | null;
  commentary?: string | null;
  isUndone: boolean;
};

export type CorrectionLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
  meta?: {
    matchId?: string;
    inningsId?: string;
    inningsNumber?: number;
    sequence?: number;
    overNumber?: number;
    ballInOver?: number;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string;
  } | null;
};

export type BatterCard = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: DismissalType | null;
  bowlerId?: string | null;
};

export type BowlerCard = {
  playerId: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  dots: number;
  wides: number;
  noBalls: number;
  fours: number;
  sixes: number;
};

export type Partnership = {
  batterIds: [string, string];
  runs: number;
  balls: number;
};

export type FallOfWicket = {
  wicketNumber: number;
  score: number;
  overs: number;
  playerId: string;
  dismissalType?: DismissalType | null;
};

export type InningsSnapshot = {
  totalRuns: number;
  totalWickets: number;
  totalBallsLegal: number;
  extras: number;
  extrasBreakdown: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalty: number;
  };
  oversDisplay: string;
  currentOver: number;
  ballsInCurrentOver: number;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  currentRunRate: number;
  partnership: Partnership | null;
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  batters: BatterCard[];
  bowlers: BowlerCard[];
  isComplete: boolean;
  freeHitNext: boolean;
};

export type MatchPlayer = {
  id?: string;
  matchId?: string;
  playerId: string;
  teamId: string;
  isPlaying?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWicketKeeper?: boolean;
  player: Player;
};

export type MatchResultDto = {
  matchId: string;
  status: MatchStatus;
  resultType: 'WIN' | 'TIE' | 'DRAW' | 'NO_RESULT' | 'ABANDONED' | 'CANCELLED' | null;
  winnerTeamId: string | null;
  marginType: 'RUNS' | 'WICKETS' | 'INNINGS' | null;
  marginValue: number | null;
  home: { teamId: string; name: string; shortName: string | null };
  away: { teamId: string; name: string; shortName: string | null };
  innings: Array<{
    battingTeamId: string;
    bowlingTeamId: string;
    inningsNumber: number;
    runs: number;
    wickets: number;
    overs: string;
  }>;
};

export type PlayingXiPlayer = {
  playerId: string;
  name: string;
  photoUrl?: string | null;
  role?: string | null;
  jerseyNo?: number | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWicketKeeper?: boolean;
};

export type PlayingXiTeam = {
  teamId: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  players: PlayingXiPlayer[];
  roster: PlayingXiPlayer[];
};

export type PlayingXiDto = {
  matchId: string;
  playingPerSide: number;
  locked: boolean;
  home: PlayingXiTeam;
  away: PlayingXiTeam;
};

export type ShareVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

export type Match = {
  id: string;
  title: string;
  status: MatchStatus;
  format: MatchFormat;
  overs: number;
  ballsPerOver: number;
  maxWickets: number;
  playingPerSide?: number;
  ballType: BallType;
  venueText?: string | null;
  scheduledAt?: string | null;
  tournamentId?: string | null;
  knockoutRound?: 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'THIRD_PLACE' | 'FINAL' | null;
  createdById?: string | null;
  tournament?: {
    id: string;
    name: string;
    season?: string | null;
    publicSlug?: string | null;
    visibility?: ShareVisibility;
    coverImageUrl?: string | null;
    defaultOvers?: number | null;
    defaultMaxWickets?: number | null;
    defaultBallsPerOver?: number | null;
    groups?: { id: string; name: string; teams: { teamId: string }[] }[];
  } | null;
  homeTeamId: string;
  awayTeamId: string;
  tossWinnerTeamId?: string | null;
  tossDecision?: TossDecision | null;
  homeTeam: Team;
  awayTeam: Team;
  innings?: Innings[];
  settings?: Record<string, unknown> | null;
  publicLiveEnabled?: boolean;
  publicScorecardEnabled?: boolean;
  publicStatsEnabled?: boolean;
  publicMvpEnabled?: boolean;
  visibility?: ShareVisibility;
  publicSlug?: string | null;
  youtubeVideoId?: string | null;
  youtubeEnabled?: boolean;
  resultType?: 'WIN' | 'TIE' | 'DRAW' | 'NO_RESULT' | 'ABANDONED' | 'CANCELLED' | null;
  resultWinnerTeamId?: string | null;
  marginType?: 'RUNS' | 'WICKETS' | 'INNINGS' | null;
  marginValue?: number | null;
  testDurationDays?: number | null;
  followOnEnforced?: boolean | null;
  correctionUnlocked?: boolean;
  overWiseRulesEnabled?: boolean;
  players?: MatchPlayer[];
  myPermissions?: string[];
  myAccess?: { level: string; status: string; permissions: string[] };
};

export type HomeData = {
  user: User | null;
  matches: Match[];
  liveMatches?: Match[];
  upcomingMatches?: Match[];
  recentMatches?: Match[];
  myMatches?: Match[];
  tournaments: Tournament[];
  profileSnapshot: {
    matches: number;
    runs: number;
    wickets?: number;
    balls?: number;
    bestScore?: number;
    strikeRate?: number;
    economy?: number;
    mvpPoints?: number;
    teams?: Team[];
    player?: {
      id: string;
      name: string;
      photoUrl?: string | null;
      role?: string | null;
      battingStyle?: string | null;
      bowlingStyle?: string | null;
      profileCode?: string | null;
    } | null;
  };
};

export type CustomRulesOverlay = {
  active: boolean;
  version?: number;
  summary: string[];
  lastBall: { actual: number; counted: number; reason: string } | null;
  score: { actual: number; counted: number } | null;
  affectsMatchResult?: boolean;
  evaluations?: Array<{
    ballEventId: string;
    sequence: number;
    originalRuns: number;
    countedRuns: number;
    reason: string;
  }>;
  balls?: Array<{ sequence: number; actual: number; counted: number }>;
};

export type TournamentRuleDto = {
  id: string;
  name: string;
  category: 'OVER_RULE' | 'BALL_RULE' | 'RUN_RULE' | 'WICKET_RULE' | 'TARGET_RULE' | 'PENALTY_RULE';
  scope: 'TOURNAMENT' | 'MATCH' | 'INNINGS' | 'OVER' | 'BALL';
  condition: string;
  conditionConfig: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  affects: {
    matchResult: boolean;
    tournamentPoints: boolean;
    nrr: boolean;
    playerStats: boolean;
    teamStats: boolean;
    displayOnly: boolean;
  };
};

export type MvpConfig = {
  batting: {
    pointsPerTenRuns: number;
    minRuns: number;
    fiftyBonus: number;
    hundredBonus: number;
    strikeRateBonus: number;
    strikeRateThreshold: number;
    strikeRateMinRuns: number;
  };
  bowling: {
    pointsPerWicket: number;
    threeWicketBonus: number;
    fiveWicketBonus: number;
    maidenOverBonus: number;
  };
  fielding: {
    catch: number;
    stumping: number;
    runOut: number;
  };
};

export type MvpPlayerRow = {
  playerId: string;
  playerName: string;
  teamName: string;
  batting: number;
  bowling: number;
  fielding: number;
  total: number;
};

export type TournamentRuleSetDto = {
  id?: string;
  version: number;
  enabled: boolean;
  locked?: boolean;
  rules: TournamentRuleDto[];
  mvp?: MvpConfig;
};

export type TournamentRulesBundle = {
  current: TournamentRuleSetDto;
  versions: TournamentRuleSetDto[];
  hasLiveOrCompletedMatches: boolean;
};

export type LiveData = {
  match: Match;
  innings?: Innings | null;
  snapshot: InningsSnapshot | null;
  customRules?: CustomRulesOverlay | null;
  mvp?: MvpPlayerRow[];
  viewerCount?: number;
};

export type ScorecardData = {
  match: Match;
  innings: (Innings & { snapshot: InningsSnapshot })[];
  mvp?: MvpPlayerRow[];
};

export type DeliveryPayload = {
  idempotencyKey: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraType?: ExtraType;
  extraRuns?: number;
  penaltyReason?: PenaltyReason;
  isWicket?: boolean;
  dismissalType?: DismissalType;
  dismissedPlayerId?: string;
  fielderId?: string;
};

export type StatRow = {
  rank?: number;
  playerId?: string;
  playerName: string;
  teamName?: string;
  value: string | number;
  starred?: boolean;
  partnerName?: string;
  breakdown?: { bat?: number; bowl?: number; field?: number };
};

export type PointsRow = {
  teamId: string;
  teamName: string;
  logoUrl?: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult?: number;
  bonusPoints?: number;
  points: number;
  nrr: number;
  qualifyStatus?: 'QUALIFIED' | 'ELIMINATED' | null;
};

export type PointsGroup = {
  id?: string;
  name: string;
  rows: PointsRow[];
};

export type ManualMatchResult = 'WON' | 'LOST' | 'TIED' | 'NO_RESULT';

export type ManualMatch = {
  id: string;
  tournamentId: string;
  teamId: string;
  title: string;
  playedAt: string;
  result: ManualMatchResult;
  runsScored: number;
  runsConceded: number;
  ballsFaced: number;
  ballsBowled: number;
  ballsPerOver: number;
  createdAt: string;
  updatedAt: string;
};

export type Envelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string } };

export type Page<T> = { items: T[]; page: number; limit: number; total: number; hasMore: boolean };

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

export type PublicBallDto = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  label: string;
  flash: string;
  commentary: string | null;
  isWicket: boolean;
  extraType?: ExtraType;
  batsmanRuns?: number;
  extraRuns?: number;
  bowlerName?: string | null;
  strikerName?: string | null;
  dismissalType?: string | null;
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
  score: { runs: number; wickets: number; overs: string; balls: number; runRate: number; extras: number };
  striker: PublicBatterDto | null;
  nonStriker: PublicBatterDto | null;
  bowler: PublicBowlerDto | null;
  partnership: { runs: number; balls: number } | null;
  recentBalls: PublicBallDto[];
  commentary: { overs: string; text: string }[];
  lastBall: PublicBallDto | null;
  youtube: { enabled: boolean; videoId: string | null };
  result?: {
    resultType: string | null;
    winnerTeamId: string | null;
    marginType: string | null;
    marginValue: number | null;
    innings: MatchResultDto['innings'];
  } | null;
  customRules?: CustomRulesOverlay | null;
  scheduledAt?: string | null;
  tournamentSlug?: string | null;
  visibility?: ShareVisibility;
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
