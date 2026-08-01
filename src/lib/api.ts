import axios from "axios";
import type {
  GetMatchesByDateRangeParams,
  MatchesByDateRangeResponse,
  Contest,
  MatchWithRealTeamsAndContests,
  LoginRequest,
  LoginResponse,
  SettleContestRequest,
  CreateContestRequest,
  PlayerProfile,
  PaginatedPlayerProfilesResponse,
  GetPlayerProfilesParams,
  UpdatePlayerProfileDefaultPriceRequest,
  UpdateRealTeamPlayerPriceRequest,
  TriggerMatchFinalizationRequest,
  AddMatchToAutoFinalizeListRequest,
  RemoveMatchFromAutoFinalizeListRequest,
  UpdateMatchScoreFromEspnRequest,
  AutoFinalizeMatch,
  PaginatedSeriesLeaderboardResponse,
  GetSeriesLeaderboardParams,
  RecalculateSeriesLeaderboardRequest,
  SeriesListResponse,
  UpdateRealTeamScoreCardRequest,
  UpdatePlayerScoreCardRequest,
  RecalculateMatchScorecardRequest,
  CreditContestFromCollectionRequest,
  EditMatchTeamRequest,
  DeleteMatchTeamPlayerRequest,
  CreateMatchTeamRequest,
  AddMatchTeamPlayerRequest,
  UpdateContestConfigurationRequest,
  User,
  Wallet,
  WalletWithTransactions,
  GetWalletTransactionsParams,
  GetNotificationUsersParams,
  PaginatedNotificationUsersResponse,
  NotificationGlobalConfig,
  GetAdminUsersParams,
  PaginatedAdminUsersResponse,
  AdminUserDetails,
  ContestDreamTeamDetails,
  SendNotificationToUsersRequest,
  BroadcastNotificationResult,
} from "@/types";

// ── Token store ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "procrick_access_token";

export function setAccessToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

const USER_INFO_KEY = "procrick_user_info";

export function setUserInfo(user: User | null) {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_INFO_KEY);
    }
  }
}

export function getUserInfo(): User | null {
  if (typeof window !== "undefined") {
    const info = localStorage.getItem(USER_INFO_KEY);
    if (info) {
      try {
        return JSON.parse(info) as User;
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

// ── Base URL ──────────────────────────────────────────────────────────────────

export const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-beta.procrick.com/api/v1";

// ── Axios instances ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach bearer token on every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] =
      `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      setAccessToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ── Authentication API ────────────────────────────────────────────────────────

export const authApi = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>("/auth/login", data);
    const { accessToken, user } = response.data;
    setAccessToken(accessToken);
    setUserInfo(user);
    return response.data;
  },
  async logout() {
    setAccessToken(null);
    setUserInfo(null);
  },
};

// ── Matches API ───────────────────────────────────────────────────────────────

export const matchesApi = {
  async getMatchesByDateRange(
    params: GetMatchesByDateRangeParams,
  ): Promise<MatchesByDateRangeResponse> {
    const response = await api.get<MatchesByDateRangeResponse>(
      "/matches/by-date-range",
      { params },
    );
    return response.data;
  },
  async getAllContestsByMatchId(
    matchId: string,
  ): Promise<MatchWithRealTeamsAndContests> {
    const response = await api.get<MatchWithRealTeamsAndContests>(
      `/contests/all/${matchId}`,
    );
    return response.data;
  },
};

export const contestsApi = {
  async settleContest(data: SettleContestRequest): Promise<void> {
    await api.post("/contests/settle", data);
  },
  async createContest(data: CreateContestRequest): Promise<void> {
    await api.post("/contests/create", data);
  },
  async getDreamTeamDetails(
    matchId: string,
    contestId: string,
    ownerId: string,
    dreamTeamId: string,
  ): Promise<ContestDreamTeamDetails> {
    const response = await api.get<ContestDreamTeamDetails>(
      `/contests/all/${matchId}/${contestId}/teams/${ownerId}/${dreamTeamId}`,
    );
    return response.data;
  },
};

/**
 * Keep only the known config fields. The backend rejects excess properties,
 * and in dev it appends response metadata (e.g. `metrics`) that must not be
 * echoed back on save.
 */
const sanitizeNotificationConfig = (
  config: NotificationGlobalConfig,
): NotificationGlobalConfig => ({
  matchReminders: {
    enabled: config.matchReminders.enabled,
    offsets: {
      "24h": config.matchReminders.offsets["24h"],
      "12h": config.matchReminders.offsets["12h"],
      "6h": config.matchReminders.offsets["6h"],
      "3h": config.matchReminders.offsets["3h"],
      "1h": config.matchReminders.offsets["1h"],
      "30m": config.matchReminders.offsets["30m"],
    },
  },
  myMatchReminders: {
    enabled: config.myMatchReminders.enabled,
    offsets: {
      "1h": config.myMatchReminders.offsets["1h"],
      "30m": config.myMatchReminders.offsets["30m"],
    },
  },
  lineupAnnounced: { enabled: config.lineupAnnounced.enabled },
  withdrawalProcessed: { enabled: config.withdrawalProcessed.enabled },
  contestWinnings: { enabled: config.contestWinnings.enabled },
});

export const adminApi = {
  async getAllPlayerProfiles(
    params?: GetPlayerProfilesParams,
  ): Promise<PaginatedPlayerProfilesResponse> {
    const response = await api.get<PaginatedPlayerProfilesResponse>(
      "/admin/players",
      { params },
    );
    return response.data;
  },
  async updatePlayerProfileDefaultPrice(
    data: UpdatePlayerProfileDefaultPriceRequest,
  ): Promise<void> {
    await api.patch("/admin/players/default-price", data);
  },
  async updateRealTeamPlayerPrice(
    data: UpdateRealTeamPlayerPriceRequest,
  ): Promise<void> {
    await api.patch("/admin/matches/player-price", data);
  },
  async triggerMatchFinalization(
    data: TriggerMatchFinalizationRequest,
  ): Promise<void> {
    await api.post("/admin/matches/trigger-finalization", data);
  },
  async addMatchToAutoFinalizeList(
    data: AddMatchToAutoFinalizeListRequest,
  ): Promise<void> {
    await api.patch("/admin/matches/auto-finalize", data);
  },
  async getAutoFinalizeMatchList(): Promise<AutoFinalizeMatch[]> {
    const response = await api.get<AutoFinalizeMatch[]>("/admin/matches/auto-finalize");
    return response.data;
  },
  async removeMatchFromAutoFinalizeList(
    data: RemoveMatchFromAutoFinalizeListRequest,
  ): Promise<void> {
    await api.delete("/admin/matches/auto-finalize", { data });
  },
  async updateMatchScoreFromEspn(
    data: UpdateMatchScoreFromEspnRequest,
  ): Promise<void> {
    await api.post("/admin/matches/update-score", data);
  },
  async recalculateMatchScorecard(
    data: RecalculateMatchScorecardRequest,
  ): Promise<void> {
    await api.post("/admin/matches/recalculate-scorecard", data);
  },
  async deleteContest(matchId: string, contestId: string): Promise<void> {
    await api.delete(`/contests/delete/${matchId}/${contestId}`);
  },
  async getWalletBalance(walletId: string): Promise<Wallet> {
    const response = await api.get<Wallet>(`/admin/wallets/${walletId}/balance`);
    return response.data;
  },
  async getWalletTransactions(
    walletId: string,
    params?: GetWalletTransactionsParams,
  ): Promise<WalletWithTransactions> {
    const response = await api.get<WalletWithTransactions>(
      `/admin/wallets/${walletId}/transactions`,
      { params },
    );
    return response.data;
  },
  async getUsersWithNotificationDevices(
    params?: GetNotificationUsersParams,
  ): Promise<PaginatedNotificationUsersResponse> {
    const response = await api.get<PaginatedNotificationUsersResponse>(
      "/admin/notifications/users",
      { params },
    );
    return response.data;
  },
  async sendNotificationToUsers(
    data: SendNotificationToUsersRequest,
  ): Promise<BroadcastNotificationResult> {
    const response = await api.post<BroadcastNotificationResult>(
      "/admin/notifications/send",
      data,
    );
    return response.data;
  },
  async getNotificationConfig(): Promise<NotificationGlobalConfig> {
    const response = await api.get<NotificationGlobalConfig>(
      "/admin/notifications/config",
    );
    return sanitizeNotificationConfig(response.data);
  },
  async updateNotificationConfig(
    config: NotificationGlobalConfig,
  ): Promise<NotificationGlobalConfig> {
    const response = await api.put<NotificationGlobalConfig>(
      "/admin/notifications/config",
      sanitizeNotificationConfig(config),
    );
    return sanitizeNotificationConfig(response.data);
  },
  async getUsers(
    params?: GetAdminUsersParams,
  ): Promise<PaginatedAdminUsersResponse> {
    const response = await api.get<PaginatedAdminUsersResponse>(
      "/admin/users",
      { params },
    );
    return response.data;
  },
  async getUserDetails(userId: string): Promise<AdminUserDetails> {
    const response = await api.get<AdminUserDetails>(`/admin/users/${userId}`);
    return response.data;
  },
};

export const seriesApi = {
  async getAllSeries(): Promise<SeriesListResponse> {
    const response = await api.get<SeriesListResponse>("/series-leaderboard/all");
    return response.data;
  },
  async getSeriesLeaderboard(
    series: string,
    params?: GetSeriesLeaderboardParams,
  ): Promise<PaginatedSeriesLeaderboardResponse> {
    const response = await api.get<PaginatedSeriesLeaderboardResponse>(
      `/series-leaderboard/${encodeURIComponent(series)}`,
      { params },
    );
    return response.data;
  },
  async recalculateSeriesLeaderboard(
    data: RecalculateSeriesLeaderboardRequest,
  ): Promise<void> {
    await api.post("/admin/series/recalculate-leaderboard", data);
  },
};

export const ownerApi = {
  async updateRealTeamScoreCard(
    data: UpdateRealTeamScoreCardRequest,
  ): Promise<void> {
    await api.patch("/owner/matches/team-score", data);
  },
  async updatePlayerScoreCard(
    data: UpdatePlayerScoreCardRequest,
  ): Promise<void> {
    await api.patch("/owner/matches/player-score", data);
  },
  async getMatchWithScore(
    matchId: string,
  ): Promise<MatchWithRealTeamsAndContests> {
    const response = await api.get<MatchWithRealTeamsAndContests>(
      `/owner/matches/${matchId}`,
    );
    return response.data;
  },
  async editMatchTeam(data: EditMatchTeamRequest): Promise<void> {
    const { matchId, realTeamId, ...body } = data;
    await api.patch(`/owner/matches/${matchId}/teams/${realTeamId}`, body);
  },
  async deleteMatchTeamPlayer(data: DeleteMatchTeamPlayerRequest): Promise<void> {
    const { matchId, realTeamId, playerProfileId } = data;
    const body = playerProfileId ? { playerProfileId } : undefined;
    await api.delete(`/owner/matches/${matchId}/teams/${realTeamId}`, {
      data: body,
    });
  },
  async createMatchTeam(
    data: CreateMatchTeamRequest,
  ): Promise<{ realTeamId: string }> {
    const { matchId, ...body } = data;
    const response = await api.post<{ realTeamId: string }>(
      `/owner/matches/${matchId}/teams`,
      body,
    );
    return response.data;
  },
  async addMatchTeamPlayer(data: AddMatchTeamPlayerRequest): Promise<void> {
    const { matchId, realTeamId, ...body } = data;
    await api.post(
      `/owner/matches/${matchId}/teams/${realTeamId}/players`,
      body,
    );
  },
  async deleteMatchTeam(matchId: string, realTeamId: string): Promise<void> {
    await api.delete(`/owner/matches/${matchId}/teams/${realTeamId}`);
  },
  async creditContestFromCollection(
    data: CreditContestFromCollectionRequest,
  ): Promise<void> {
    const { contestId, ...body } = data;
    await api.post(`/owner/contests/${contestId}/credit-from-collection`, body);
  },
  async updateContestConfiguration(
    data: UpdateContestConfigurationRequest,
  ): Promise<void> {
    const { contestId, ...body } = data;
    await api.patch(`/owner/contests/${contestId}`, body);
  },
};
