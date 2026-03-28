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
    const { accessToken } = response.data;
    setAccessToken(accessToken);
    return response.data;
  },
  async logout() {
    setAccessToken(null);
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
};

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
