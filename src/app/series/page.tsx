"use client";

import { useEffect, useState } from "react";
import { seriesApi } from "@/lib/api";
import Link from "next/link";

export default function SeriesListPage() {
  const [series, setSeries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSeries() {
      try {
        const data = await seriesApi.getAllSeries();
        setSeries(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        console.error("Failed to fetch series:", err);
        setError("Failed to load series. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchSeries();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Series Leaderboards</h1>
        <p className="text-slate-400">Select a series to view its leaderboard and manage recalculations.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map((s) => (
            <Link
              key={s}
              href={`/series/leaderboard?series=${encodeURIComponent(s)}`}
              className="bg-[#12121a] border border-white/5 rounded-xl p-6 hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  {s}
                </h3>
                <svg
                  className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
          {series.length === 0 && (
            <div className="col-span-full text-center py-12 bg-[#12121a] border border-white/5 rounded-xl text-slate-500 italic">
              No series leaderboards found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
