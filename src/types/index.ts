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
  | "PRACTICE"
  | "HALVING";

export type DreamTeamStatus = "DRAFT" | "SUBMITTED" | "LOCKED";

export interface ContestDreamTeam {
  dreamTeamId: string;
  name: string;
  status: DreamTeamStatus;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: number;
  submittedAt?: number;
  score?: number;
  rank?: number;
}

export interface ContestDreamTeamPlayer {
  playerProfileId: string;
  name: string;
  realTeamId: string;
  playerRole: PlayerRole;
  playerSecondRole: PlayerSecondRole;
  imageUrl?: string;
}

export interface ContestDreamTeamDetails extends ContestDreamTeam {
  players: ContestDreamTeamPlayer[];
}

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
  dreamTeams?: ContestDreamTeam[];
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

// ── Notifications (admin) ─────────────────────────────────────────────────────

export type NotificationPlatform = "ios" | "android" | "web";

export interface NotificationDeviceInfo {
  platform: NotificationPlatform;
  tokenPreview: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserWithNotificationDevices {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: number;
  devices: NotificationDeviceInfo[];
}

export interface GetNotificationUsersParams {
  pageSize?: number;
  cursor?: string;
  search?: string;
}

export interface PaginatedNotificationUsersResponse {
  items: UserWithNotificationDevices[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface SendNotificationToUsersRequest {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface BroadcastNotificationResult {
  usersAttempted: number;
  usersDelivered: number;
}

export interface ReminderOffsetToggles {
  "24h": boolean;
  "12h": boolean;
  "6h": boolean;
  "3h": boolean;
  "1h": boolean;
  "30m": boolean;
}

export interface NotificationGlobalConfig {
  matchReminders: {
    enabled: boolean;
    offsets: ReminderOffsetToggles;
  };
  myMatchReminders: {
    enabled: boolean;
    offsets: { "1h": boolean; "30m": boolean };
  };
  lineupAnnounced: { enabled: boolean };
  withdrawalProcessed: { enabled: boolean };
  contestWinnings: { enabled: boolean };
}

// ── Users (admin) ─────────────────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: number;
}

export interface GetAdminUsersParams {
  pageSize?: number;
  cursor?: string;
  search?: string;
}

export interface PaginatedAdminUsersResponse {
  items: AdminUserSummary[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface UserNotificationPreferences {
  matchReminders: boolean;
  matchReminderOffsets: ReminderOffsetToggles;
  myMatchReminders: boolean;
  lineupAnnounced: boolean;
  withdrawalProcessed: boolean;
  contestWinnings: boolean;
}

export interface AdminUserWalletInfo {
  id: string;
  balance: number;
  currency: string;
  description?: string;
}

export interface AdminUserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: number;
  modifiedAt: number;
  stripeCustomerId?: string;
  wiseEmail?: string;
  binanceEmail?: string;
  refered_user?: string;
  refered_code?: string;
  practiceContestLimit: number;
  practiceContestsPlayed: number;
  wallet?: AdminUserWalletInfo;
  notificationPreferences: UserNotificationPreferences;
  devices: NotificationDeviceInfo[];
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

export interface RecalculateMatchScorecardRequest {
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

export interface CreditContestFromCollectionRequest {
  matchId: string;
  contestId: string;
}

export interface UpdateContestConfigurationRequest {
  matchId: string;
  contestId: string;
  teamsPerUserLimit?: number;
  teamsTotalLimit?: number;
  description?: string;
  priceSheet?: Record<string, PriceSheetItem>;
}

export interface GetWalletTransactionsParams {
  pageSize?: number;
  cursor?: string | number;
}


// ── Display Banners ───────────────────────────────────────────────────────────

export interface DisplayBanner {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  /** In-app route (e.g. /matches/123) or external URL */
  deeplink?: string;
  urlExternal?: boolean;
  buttonLabel?: string;
  active: boolean;
  /** Epoch ms — start of display window */
  startsAt?: number;
  /** Epoch ms — end of display window */
  endsAt?: number;
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDisplayBannerRequest {
  title: string;
  content: string;
  imageUrl?: string;
  deeplink?: string;
  urlExternal?: boolean;
  buttonLabel?: string;
  active: boolean;
  startsAt?: number;
  endsAt?: number;
  priority?: number;
}


// ── Series Management ─────────────────────────────────────────────────────────

export type SeriesImportStatus = "queued" | "running" | "completed" | "failed";

export interface SeriesImportStats {
  /** Matches found in the ESPN schedule */
  totalMatches: number;
  matchesCreated: number;
  /** Already existing / ended / locked matches */
  matchesSkipped: number;
  /** Matches that errored or had incomplete squad data */
  matchesFailed: number;
}

export interface AdminSeries {
  seriesName: string;
  /** ESPN match-schedule-fixtures-and-results URL */
  scheduleUrl: string;
  /** Included in the hourly import fan-out when true */
  enabled: boolean;
  importStatus?: SeriesImportStatus;
  importQueuedAt?: number;
  importStartedAt?: number;
  importCompletedAt?: number;
  importError?: string;
  importStats?: SeriesImportStats;
  createdAt?: number;
  updatedAt?: number;
}

export interface CreateSeriesRequest {
  seriesName: string;
  scheduleUrl: string;
  enabled: boolean;
}

export interface UpdateSeriesRequest {
  /** Current name (key) of the series to update */
  seriesName: string;
  /** Rename the series */
  newSeriesName?: string;
  scheduleUrl?: string;
  enabled?: boolean;
}
