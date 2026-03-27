"use client";

import { useState } from "react";
import { contestsApi } from "@/lib/api";
import { ContestType } from "@/types";

const CONTEST_TYPES: ContestType[] = [
  "POOL500",
  "POOL100",
  "POOL50",
  "POOL25",
  "POOL10",
  "POOL3",
  "HEADTOHEAD",
  "PRACTICE",
];

interface CreateContestFormProps {
  matchId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateContestForm({
  matchId,
  onSuccess,
  onCancel,
}: CreateContestFormProps) {
  const [selectedContestType, setSelectedContestType] =
    useState<ContestType>("POOL100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await contestsApi.createContest({
        matchId,
        type: selectedContestType,
      });
      onSuccess?.();
    } catch (err: any) {
      console.error("Failed to create contest", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "An unknown error occurred";
      setError(`Failed to create contest: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-500/10">
        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
          Create New Contest
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-xs text-slate-500 uppercase block mb-2 ml-1">
            Contest Type
          </label>
          <select
            value={selectedContestType}
            onChange={(e) => setSelectedContestType(e.target.value as ContestType)}
            className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
          >
            {CONTEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-semibold text-sm hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !matchId}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Create Contest"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
