"use client";

import { useState, useEffect, useCallback } from "react";
import { matchesApi } from "@/lib/api";
import type { MatchWithContestSummary, MatchStatus } from "@/types";
import { MatchCard } from "@/components/MatchCard";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CONTEST_STATUS_COLORS } from "@/lib/utils";
import type { MatchWithContestsResponse, Contest } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_FRONTEND_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procrick.com";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateToEpochMs(dateStr: string, endOfDay = false): number {
  const d = new Date(dateStr);
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
}

const STATUS_FILTERS: { label: string; value: MatchStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Prematch", value: "PREMATCH" },
  { label: "Live", value: "INMATCH" },
  { label: "Ended", value: "MATCHENDED" },
  { label: "Finalized", value: "FINALIZED" },
  { label: "Setting up", value: "SETTINGUP" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(
    toDateInputValue(new Date(today.getTime() + 7 * 86400000)),
  );
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [matches, setMatches] = useState<MatchWithContestSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchDetails, setSelectedMatchDetails] =
    useState<MatchWithContestsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchMatches = useCallback(
    async (cursor?: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await matchesApi.getMatchesByDateRange({
          from: dateToEpochMs(fromDate),
          to: dateToEpochMs(toDate, true),
          pageSize: 20,
          cursor,
        });
        if (cursor) {
          setMatches((prev) => [...prev, ...data.items]);
        } else {
          setMatches(data.items);
        }
        setHasMore(data.hasMore);
        setNextCursor(
          typeof data.nextCursor === "number" ? data.nextCursor : undefined,
        );
      } catch (err) {
        setError("Failed to load matches. Check your API connection.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate],
  );

  const handleMatchClick = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setLoadingDetails(true);
    try {
      const details = await matchesApi.getMatchWithContests(matchId);
      setSelectedMatchDetails(details);
    } catch (err) {
      console.error("Failed to fetch match details", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fetch when dates change
  useEffect(() => {
    setNextCursor(undefined);
    fetchMatches();
  }, [fetchMatches]);

  // Filter client-side by status
  const filteredMatches =
    statusFilter === "ALL"
      ? matches
      : matches.filter((m) => m.status === statusFilter);

  const handleDateChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="min-h-screen relative flex">
      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${selectedMatchId ? "mr-[400px]" : ""}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a0f]/80 backdrop-blur border-b border-white/5 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">Matches</h1>
              <p className="text-xs text-slate-500">
                {matches.length} loaded
                {filteredMatches.length !== matches.length &&
                  ` · ${filteredMatches.length} shown`}
              </p>
            </div>
            <DateRangePicker
              from={fromDate}
              to={toDate}
              onChange={handleDateChange}
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  statusFilter === f.value
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10"
                }`}
              >
                {f.label}
                {f.value !== "ALL" && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {matches.filter((m) => m.status === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && matches.length === 0 && (
            <div
              className={`grid grid-cols-1 ${selectedMatchId ? "md:grid-cols-1 xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"} gap-4`}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-white/3 animate-pulse border border-white/5"
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && filteredMatches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">🏏</div>
              <p className="text-slate-400 font-medium">No matches found</p>
              <p className="text-slate-600 text-sm mt-1">
                Try adjusting the date range or status filter
              </p>
            </div>
          )}

          {/* Grid */}
          {filteredMatches.length > 0 && (
            <div
              className={`grid grid-cols-1 ${selectedMatchId ? "md:grid-cols-1 xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"} gap-4 transition-all duration-300`}
            >
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onClick={handleMatchClick}
                  isSelected={selectedMatchId === match.id}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchMatches(nextCursor)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 transition-all"
              >
                Load more
              </button>
            </div>
          )}

          {/* Loading more spinner */}
          {loading && matches.length > 0 && (
            <div className="mt-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      {selectedMatchId && (
        <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-[#0d0d14] border-l border-white/10 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Contests</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedMatchDetails
                    ? `${selectedMatchDetails.contests.length} found`
                    : "Loading..."}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatchId(null)}
                className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetails ? (
                <div className="flex flex-col gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-32 rounded-xl bg-white/3 animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              ) : selectedMatchDetails ? (
                <div className="flex flex-col gap-4">
                  {selectedMatchDetails.contests.map((contest) => (
                    <div
                      key={contest.id}
                      className="bg-white/3 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {contest.type}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            ID: {contest.id}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            CONTEST_STATUS_COLORS[contest.status] ??
                            "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {contest.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                            Entry Price
                          </p>
                          <p className="text-xs font-semibold text-white">
                            ${contest.entryPrice} {contest.entryPriceCurrency}
                          </p>
                        </div>
                        <div className="bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                            Teams
                          </p>
                          <p className="text-xs font-semibold text-white">
                            {contest.submittedDreamTeamCount} /{" "}
                            {contest.teamsTotalLimit}
                          </p>
                        </div>
                      </div>

                      <a
                        href={`${APP_FRONTEND_URL}/match/${selectedMatchId}/contest/${contest.id}/leaderboard`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all"
                      >
                        <span>Leaderboard</span>
                        <span>↗</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-sm">
                  Failed to load contest details
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
