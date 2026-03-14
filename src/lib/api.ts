import axios from "axios";
import type {
  GetMatchesByDateRangeParams,
  MatchesByDateRangeResponse,
  Contest,
  MatchWithRealTeamsAndContests,
  LoginRequest,
  LoginResponse,
  SettleContestRequest,
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
};
