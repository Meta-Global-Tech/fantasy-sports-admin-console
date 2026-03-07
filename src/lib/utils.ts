import type { MatchStatus, ContestStatus } from "@/types";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function epochToDate(epoch: number) {
  return new Date(epoch);
}

export const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  SETTINGUP: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  PREMATCH: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TOSTART: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LINEUPANNOUNCED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  INMATCH: "bg-green-500/20 text-green-400 border-green-500/30",
  MATCHENDED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  FINALIZED: "bg-slate-600/20 text-slate-500 border-slate-600/30",
};

export const CONTEST_STATUS_COLORS: Record<ContestStatus, string> = {
  PREMATCH: "bg-blue-500/20 text-blue-400",
  FILLED: "bg-green-500/20 text-green-400",
  INMATCH: "bg-emerald-500/20 text-emerald-400",
  MATCHENDED: "bg-orange-500/20 text-orange-400",
  TOSETTLE: "bg-yellow-500/20 text-yellow-400",
  SETTLED: "bg-slate-500/20 text-slate-400",
  TOREFUND: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-rose-500/20 text-rose-400",
};
