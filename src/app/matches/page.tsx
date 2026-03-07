"use client";

import { useState, useEffect, useCallback } from "react";
import { matchesApi } from "@/lib/api";
import type { MatchWithContestSummary, MatchStatus } from "@/types";
import { MatchCard } from "@/components/MatchCard";
import { DateRangePicker } from "@/components/DateRangePicker";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
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
  );
}
