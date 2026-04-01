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

export interface TransactionCounts {
  submitted: number;
  processed: number;
  failed: number;
}

export interface ContestSummary {
  id: string;
  status: ContestStatus;
  transactionCounts?: TransactionCounts;
}

export type TransactionStatus = "SUBMITTED" | "PROCESSED" | "FAILED";

export interface Transaction {
  id: string;
  fromWalletId: string;
  fromDescription: string;
  toWalletId: string;
  toDescription: string;
  amount: number;
  currency?: Currency;
  createdAt: string;
  updatedAt: string;
  status: TransactionStatus;
  userId: string;
  withdrawalToBeProcessed?: boolean;
  type?: string;
  fromWalletBalance?: number;
  toWalletBalance?: number;
  details?: Record<string, any>;
  reconciled?: boolean;
}

export interface Wallet {
  id: string;
  balance: number;
  currency: Currency;
}

export interface PaginatedTransactionsResponse {
  items: Transaction[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface WalletWithTransactions extends Wallet {
  transactions: PaginatedTransactionsResponse;
}


export interface PriceSheetItem {
  description: string;
  rankFrom: number;
  rankTo: number;
  price: number;
  currency: Currency;
  rowNumber: number;
}

export interface LeaderBoardEntry {
  score: number;
  dreamTeamName: string;
  authorName: string;
  rank: number;
  rowNumber: number;
  dreamTeamId: string;
  authorId: string;
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
  contestId?: number;
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
  transactionCounts?: TransactionCounts;
  transactions?: Transaction[];
  walletId?: string;
  walletBalance?: number;
  leaderBoard?: Record<string, LeaderBoardEntry>;
  priceSheet?: Record<string, PriceSheetItem>;
}

export type PlayerRole = "CAPTAIN" | "VICECAPTAIN" | "MEMBER";

export type PlayerSecondRole =
  | "BOWLER"
  | "BATTER"
  | "WICKETKEEPER"
  | "ALLROUNDER";

export interface ScoreCardItem {
  scoreCardItemType: string;
  valueType: string;
  value: number | string;
}

export interface ScoreCardInning {
  inning: number;
  items: Record<string, ScoreCardItem>;
}

export interface RealTeamPlayer {
  matchId: string;
  realTeamId: string;
  playerProfileId: string;
  name: string;
  playerSecondRole: PlayerSecondRole;
  playerRole: PlayerRole;
  price: number;
  scoreCard: Record<number, ScoreCardInning>;
  espnId?: string;
  imageUrl?: string;
}

export interface RealTeam {
  matchId: string;
  realTeamId: string;
  teamName: string;
  shortName?: string;
  logoURL: string;
  scoreCard?: Record<number, InningScore>;
}

export interface RealTeamWithRealTeamPlayers extends RealTeam {
  players: RealTeamPlayer[];
}

export interface MatchWithRealTeamsAndContests extends Omit<
  MatchWithContestSummary,
  "contests"
> {
  teams: RealTeamWithRealTeamPlayers[];
  contests: Contest[];
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

export interface GetPlayerProfilesParams {
  pageSize?: number;
  cursor?: string;
  playerName?: string;
}

export interface PaginatedPlayerProfilesResponse {
  items: PlayerProfile[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface SettleContestRequest {
  transactions: {
    amount: number;
    userId: string;
    transactionId: string;
  }[];
  status: ContestStatus;
  contestId: string;
  matchId: string;
}

export interface CreateContestRequest {
  type: ContestType;
  matchId: string;
}

export interface PlayerProfile {
  playerProfileId: string;
  name: string;
  normalizedName: string;
  createdAt: number;
  country?: string;
  defaultPrice?: number;
  defaultPlayerSecondRole?: PlayerSecondRole;
  espnId?: string;
  imageUrl?: string;
}

export interface UpdatePlayerProfileDefaultPriceRequest {
  updateUpcomingMatches?: boolean;
  defaultPrice: number;
  playerProfileId: string;
}

export interface UpdateRealTeamPlayerPriceRequest {
  price: number;
  realTeamIdPlayerProfileId: string;
  matchId: string;
}

export interface TriggerMatchFinalizationRequest {
  matchId: string;
}

export interface AddMatchToAutoFinalizeListRequest {
  matchId: string;
  matchEndTime?: number;
}

export interface RemoveMatchFromAutoFinalizeListRequest {
  matchId: string;
}

export interface AutoFinalizeMatch {
  matchId: string;
  matchEndTime: number;
  finalizedTime?: number;
}

export interface UpdateMatchScoreFromEspnRequest {
  matchId: string;
}

// ── Series Leaderboard ────────────────────────────────────────────────────────

export interface SeriesLeaderboardEntry {
  userId: string;
  userName: string;
  totalScore: number;
  matchCount: number;
  rank: number;
}

export interface PaginatedSeriesLeaderboardResponse {
  items: SeriesLeaderboardEntry[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface RecalculateSeriesLeaderboardRequest {
  series: string;
}

export interface GetSeriesLeaderboardParams {
  pageSize?: number;
  cursor?: string;
}
export interface SeriesListResponse {
  items: string[];
}


export interface UpdateRealTeamScoreCardRequest {
  scoreCard: Record<number, InningScore>;
  realTeamId: string;
  matchId: string;
}

export interface UpdatePlayerScoreCardRequest {
  scoreCard: Record<number, ScoreCardInning>;
  playerProfileId: string;
  realTeamId: string;
  matchId: string;
}

export interface MatchTeamPlayerInput {
  playerProfileId: string;
  playerSecondRole: PlayerSecondRole;
  price?: number;
  espnId?: string;
  imageUrl?: string;
}

export interface EditMatchTeamRequest {
  matchId: string;
  realTeamId: string;
  name?: string;
  shortName?: string;
  logoURL?: string;
  players?: MatchTeamPlayerInput[];
}

export interface DeleteMatchTeamPlayerRequest {
  matchId: string;
  realTeamId: string;
  playerProfileId?: string;
}

export interface CreateMatchTeamRequest {
  matchId: string;
  name: string;
  shortName: string;
  logoURL?: string;
}

export interface AddMatchTeamPlayerRequest extends MatchTeamPlayerInput {
  matchId: string;
  realTeamId: string;
}

export interface GetWalletTransactionsParams {
  pageSize?: number;
  cursor?: string | number;
}

