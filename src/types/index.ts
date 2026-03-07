// ── Enums ────────────────────────────────────────────────────────────────────

export type Currency = "USD" | "CRYPTO";

export type MatchType = "CRICKET";

export type MatchStatus =
  | "SETTINGUP"
  | "PREMATCH"
  | "TOSTART"
  | "LINEUPANNOUNCED"
  | "INMATCH"
  | "MATCHENDED"
  | "FINALIZED";

export type ContestStatus =
  | "PREMATCH"
  | "FILLED"
  | "INMATCH"
  | "MATCHENDED"
  | "TOSETTLE"
  | "SETTLED"
  | "TOREFUND"
  | "REFUNDED";

export type MatchSourcePlatform = "ESPN_CRICINFO";

// ── Sub-types ────────────────────────────────────────────────────────────────

export interface InningScore {
  inning: number;
  runs: number;
  wickets: number;
  overs: number;
  extras?: {
    total: number;
    penalty: number;
    byes: number;
    legBuys: number;
    noBalls: number;
    wides: number;
  };
}

export interface MatchSource {
  matchId: string;
  platform: MatchSourcePlatform;
  liveScoreUrl?: string;
  scoreCardUrl?: string;
  matchPageUrl?: string;
  createdAt: number;
}

export interface ContestSummary {
  id: string;
  status: ContestStatus;
}

// ── Match with contest summary (used in by-date-range response) ───────────────

export interface MatchWithContestSummary {
  id: string;
  startTime: string;
  endTime?: string;
  type: MatchType;
  status: MatchStatus;
  name: string;
  venue?: string;
  subType?: string;
  innings?: number;
  currentInnings?: number;
  matchConclusion?: string;
  series?: string;
  inningScores?: InningScore[];
  createdAtEpoch?: number;
  matchSource: Record<string, MatchSource>;
  contestCount: number;
  prizePool: number;
  contests: ContestSummary[];
}

// ── API response ─────────────────────────────────────────────────────────────

export interface MatchesByDateRangeResponse {
  items: MatchWithContestSummary[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export type ContestType =
  | "POOL500"
  | "POOL100"
  | "POOL50"
  | "POOL25"
  | "POOL10"
  | "POOL3"
  | "HEADTOHEAD"
  | "PRACTICE";

export interface Contest {
  id: string;
  matchId: string;
  type: ContestType;
  status: ContestStatus;
  entryPrice: number;
  entryPriceCurrency: Currency;
  description?: string;
  teamsTotalLimit: number;
  teamsPerUserLimit: number;
  submittedDreamTeamCount: number;
  prizePool?: number;
}

export interface MatchWithContestsResponse extends MatchWithContestSummary {
  contests: Contest[];
}

// ── Authentication ───────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ── Request params ────────────────────────────────────────────────────────────

export interface GetMatchesByDateRangeParams {
  from: number;
  to: number;
  pageSize?: number;
  cursor?: number;
}
