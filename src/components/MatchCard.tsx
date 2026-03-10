import type { MatchWithContestSummary } from "@/types";
import {
  formatDate,
  MATCH_STATUS_COLORS,
  CONTEST_STATUS_COLORS,
} from "@/lib/utils";

interface MatchCardProps {
  match: MatchWithContestSummary;
  onClick?: (matchId: string) => void;
  isSelected?: boolean;
}

export function MatchCard({ match, onClick, isSelected }: MatchCardProps) {
  const statusColor =
    MATCH_STATUS_COLORS[match.status] ??
    "bg-slate-500/20 text-slate-400 border-slate-500/30";

  // Get contest status distribution
  const contestStatusCounts = match.contests.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Get total transaction counts
  const totalTransactions = match.contests.reduce(
    (acc, c) => {
      if (c.transactionCounts) {
        acc.submitted += c.transactionCounts.submitted;
        acc.processed += c.transactionCounts.processed;
        acc.failed += c.transactionCounts.failed;
      }
      return acc;
    },
    { submitted: 0, processed: 0, failed: 0 },
  );

  const hasTransactions =
    totalTransactions.submitted > 0 ||
    totalTransactions.processed > 0 ||
    totalTransactions.failed > 0;

  return (
    <div
      onClick={() => onClick?.(match.id)}
      className={`group bg-[#0d0d14] border rounded-xl p-4 transition-all cursor-pointer ${
        isSelected
          ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)]"
          : "border-white/5 hover:border-white/10 hover:bg-[#101018]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {match.name}
          </p>
          {match.series && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {match.series}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${statusColor}`}
        >
          {match.status}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        <MetaItem icon="🕐" label={formatDate(match.startTime)} />
        {match.venue && <MetaItem icon="📍" label={match.venue} />}
        {match.subType && <MetaItem icon="🏏" label={match.subType} />}
      </div>

      {/* Inning scores */}
      {match.inningScores && match.inningScores.length > 0 && (
        <div className="flex gap-2 mb-3">
          {match.inningScores.map((inn) => (
            <div
              key={inn.inning}
              className="flex-1 bg-white/3 rounded-lg px-3 py-2 border border-white/5"
            >
              <p className="text-[10px] text-slate-500 mb-0.5">
                Inning {inn.inning}
              </p>
              <p className="text-sm font-mono font-semibold text-white">
                {inn.runs}/{inn.wickets}
                <span className="text-xs text-slate-400 font-normal ml-1">
                  ({inn.overs} ov)
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Match conclusion */}
      {match.matchConclusion && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-xs text-emerald-400">{match.matchConclusion}</p>
        </div>
      )}

      {/* Transaction Summary */}
      {hasTransactions && (
        <div className="mb-3 flex gap-2">
          {totalTransactions.submitted > 0 && (
            <div className="flex-1 bg-blue-500/5 rounded-lg px-2 py-1 border border-blue-500/10">
              <p className="text-[8px] text-blue-500 uppercase tracking-wider">
                Submitted
              </p>
              <p className="text-xs font-semibold text-blue-400">
                {totalTransactions.submitted}
              </p>
            </div>
          )}
          {totalTransactions.processed > 0 && (
            <div className="flex-1 bg-emerald-500/5 rounded-lg px-2 py-1 border border-emerald-500/10">
              <p className="text-[8px] text-emerald-500 uppercase tracking-wider">
                Processed
              </p>
              <p className="text-xs font-semibold text-emerald-400">
                {totalTransactions.processed}
              </p>
            </div>
          )}
          {totalTransactions.failed > 0 && (
            <div className="flex-1 bg-red-500/5 rounded-lg px-2 py-1 border border-red-500/10">
              <p className="text-[8px] text-red-500 uppercase tracking-wider">
                Failed
              </p>
              <p className="text-xs font-semibold text-red-400">
                {totalTransactions.failed}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex gap-4">
          <Stat label="Contests" value={match.contestCount} />
          <Stat
            label="Prize Pool"
            value={`$${match.prizePool.toLocaleString()}`}
          />
        </div>

        {/* Contest status pills */}
        {Object.keys(contestStatusCounts).length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {Object.entries(contestStatusCounts).map(([status, count]) => (
              <span
                key={status}
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  CONTEST_STATUS_COLORS[
                    status as keyof typeof CONTEST_STATUS_COLORS
                  ] ?? "bg-slate-500/20 text-slate-400"
                }`}
              >
                {count} {status}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Match ID */}
      <p className="mt-2 text-[10px] font-mono text-slate-700 truncate">
        {match.id}
      </p>
    </div>
  );
}

function MetaItem({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <span>{icon}</span>
      <span className="truncate max-w-[200px]">{label}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
