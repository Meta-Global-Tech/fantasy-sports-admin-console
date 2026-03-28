"use client";

import { useEffect, useState, Suspense } from "react";
import { seriesApi } from "@/lib/api";
import { SeriesLeaderboardEntry } from "@/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SeriesLeaderboardContent() {
  const searchParams = useSearchParams();
  const seriesName = searchParams.get("series") || "";
  const decodedSeries = decodeURIComponent(seriesName);

  const [leaderboard, setLeaderboard] = useState<SeriesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalcSuccess, setRecalcSuccess] = useState(false);

  async function fetchLeaderboard() {
    if (!decodedSeries) return;
    setLoading(true);
    try {
      const data = await seriesApi.getSeriesLeaderboard(decodedSeries);
      const items = data.items || [];
      const sortedLeaderboard = [...items].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
      setLeaderboard(sortedLeaderboard);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      setError("Failed to load leaderboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, [decodedSeries]);

  const handleRecalculate = async () => {
    if (!confirm(`Are you sure you want to recalculate the leaderboard for "${decodedSeries}"?`)) {
      return;
    }

    setRecalculating(true);
    setError(null);
    setRecalcSuccess(false);

    try {
      await seriesApi.recalculateSeriesLeaderboard({ series: decodedSeries });
      setRecalcSuccess(true);
      // Wait a bit and then refresh the leaderboard
      setTimeout(fetchLeaderboard, 2000);
    } catch (err) {
      console.error("Failed to recalculate leaderboard:", err);
      setError("Failed to trigger recalculation.");
    } finally {
      setRecalculating(false);
    }
  };

  if (!decodedSeries) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">No series selected.</p>
        <Link href="/series" className="text-emerald-400 hover:underline">Go back to series list</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <nav className="mb-6">
        <Link
          href="/series"
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Series
        </Link>
      </nav>

      <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{decodedSeries}</h1>
          <p className="text-slate-400">Viewing the overall series leaderboard across all matches.</p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] ${
            recalculating
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
          }`}
        >
          {recalculating ? (
            <div className="w-4 h-4 border-2 border-slate-500 border-t-white animate-spin rounded-full"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {recalculating ? "Recalculating..." : "Recalculate Leaderboard"}
        </button>
      </header>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {recalcSuccess && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Recalculation triggered successfully. Refreshing leaderboard...
        </div>
      )}

      {loading && leaderboard.length === 0 ? (
        <div className="flex items-center justify-center py-24 bg-[#12121a] border border-white/5 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
            <p className="text-slate-400 animate-pulse">Loading Leaderboard...</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Rank</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-center">Matches</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => (
                  <tr key={entry.userId} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        entry.rank === 1 ? "bg-yellow-500/20 text-yellow-500 shadow-inner" :
                        entry.rank === 2 ? "bg-slate-300/20 text-slate-300 shadow-inner" :
                        entry.rank === 3 ? "bg-amber-600/20 text-amber-600 shadow-inner" :
                        "bg-white/5 text-slate-400 shadow-inner"
                      }`}>
                        {entry.rank}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-white mb-0.5 group-hover:text-emerald-400 transition-colors">
                          {entry.userName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{entry.userId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 rounded-md bg-white/5 text-slate-300 text-sm font-medium">
                        {entry.matchCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-emerald-400 font-bold text-lg">
                        {entry.totalScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                      No leaderboard entries found for this series.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeriesDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    }>
      <SeriesLeaderboardContent />
    </Suspense>
  );
}
