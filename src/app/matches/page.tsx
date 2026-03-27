"use client";

import { useState, useEffect, useCallback } from "react";
import { matchesApi, contestsApi } from "@/lib/api";
import type {
  MatchWithContestSummary,
  MatchStatus,
  Contest,
  ContestStatus,
  SettleContestRequest,
  MatchWithRealTeamsAndContests,
  ContestType,
  Transaction,
  UpdateRealTeamPlayerPriceRequest,
} from "@/types";
import { MatchCard } from "@/components/MatchCard";
import { CreateContestForm } from "@/components/CreateContestForm";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CONTEST_STATUS_COLORS } from "@/lib/utils";
import { adminApi } from "@/lib/api";

// ── Components ───────────────────────────────────────────────────────────────

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "blue" | "red";
  loading?: boolean;
}

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "blue",
  loading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const variantColors = {
    blue: {
      button:
        "bg-blue-500/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30 shadow-blue-500/10",
      icon: "text-blue-400 bg-blue-500/10",
    },
    red: {
      button:
        "bg-red-500/20 hover:bg-red-600/30 text-red-400 border-red-500/30 shadow-red-500/10",
      icon: "text-red-400 bg-red-500/10",
    },
  };

  const colors = variantColors[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#050508]/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0d0d14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${colors.icon}`}
        >
          {variant === "blue" ? "⚙️" : "⚠️"}
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${colors.button}`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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

const TRANSACTION_FILTERS: {
  label: string;
  value: "submitted" | "processed" | "failed" | "ALL";
}[] = [
  { label: "Any Transactions", value: "ALL" },
  { label: "Submitted > 0", value: "submitted" },
  { label: "Processed > 0", value: "processed" },
  { label: "Failed > 0", value: "failed" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(
    toDateInputValue(new Date(today.getTime() + 7 * 86400000)),
  );
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<
    "submitted" | "processed" | "failed" | "ALL"
  >("ALL");
  const [matches, setMatches] = useState<MatchWithContestSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchDetails, setSelectedMatchDetails] =
    useState<MatchWithRealTeamsAndContests | null>(null);
  const [activeSideTab, setActiveSideTab] = useState<"contests" | "teams">(
    "contests",
  );
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(
    null,
  );
  const [isCreatingContest, setIsCreatingContest] = useState(false);
  const [updatingPricePlayerId, setUpdatingPricePlayerId] = useState<string | null>(null);
  const [pendingPlayerPrices, setPendingPlayerPrices] = useState<Record<string, string>>({});

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "blue" | "red";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "blue",
    onConfirm: () => {},
  });

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
    setSelectedContestId(null);
    setActiveSideTab("contests");
    setLoadingDetails(true);
    try {
      const details = await matchesApi.getAllContestsByMatchId(matchId);
      setSelectedMatchDetails(details);
    } catch (err) {
      console.error("Failed to fetch match details", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSettleContest = async (
    contest: Contest,
    newStatus: ContestStatus,
  ) => {
    if (!selectedMatchId) return;

    const submittedTransactions = (contest.transactions || [])
      .filter((tx) => tx.status === "SUBMITTED")
      .map((tx) => ({
        transactionId: tx.id,
        userId: tx.userId,
        amount: tx.amount || 0,
      }));

    const title = newStatus === "SETTLED" ? "Settle Contest" : "Refund Contest";
    const variant = newStatus === "SETTLED" ? "blue" : "red";
    const message = `Are you sure you want to approve ${submittedTransactions.length} transactions and set contest status to ${newStatus}? This action cannot be undone.`;

    setConfirmModal({
      isOpen: true,
      title,
      message,
      variant,
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await contestsApi.settleContest({
            matchId: selectedMatchId,
            contestId: contest.id,
            status: newStatus,
            transactions: submittedTransactions,
          });
          // Refresh details
          await handleMatchClick(selectedMatchId);
          // Keep selected contest
          setSelectedContestId(contest.id);
        } catch (err: any) {
          console.error("Failed to settle contest", err);
          const errorMsg =
            err.response?.data?.message ||
            err.message ||
            "An unknown error occurred";
          alert(`Failed to settle contest: ${errorMsg}`);
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleContestCreated = async () => {
    if (!selectedMatchId) return;
    await handleMatchClick(selectedMatchId);
    setIsCreatingContest(false);
  };

  const handleUpdatePlayerPrice = async (
    matchId: string,
    realTeamId: string,
    playerProfileId: string,
  ) => {
    const priceStr = pendingPlayerPrices[playerProfileId];
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      setUpdatingPricePlayerId(playerProfileId);
      await adminApi.updateRealTeamPlayerPrice({
        matchId,
        realTeamIdPlayerProfileId: `${realTeamId}#${playerProfileId}`,
        price,
      });

      // Refresh match details to show updated price
      const details = await matchesApi.getAllContestsByMatchId(matchId);
      setSelectedMatchDetails(details);
      
      setUpdatingPricePlayerId(null);
      setPendingPlayerPrices(prev => {
        const next = { ...prev };
        delete next[playerProfileId];
        return next;
      });
    } catch (err: any) {
      console.error("Failed to update player price", err);
      alert(err.response?.data?.message || "Failed to update player price");
      setUpdatingPricePlayerId(null);
    }
  };

  // Fetch when dates change
  useEffect(() => {
    setNextCursor(undefined);
    fetchMatches();
  }, [fetchMatches]);

  // Filter client-side by status and transaction counts
  const filteredMatches = matches.filter((m) => {
    // 1. Status Filter
    if (statusFilter !== "ALL" && m.status !== statusFilter) {
      return false;
    }

    // 2. Transaction Status Filter
    if (transactionStatusFilter !== "ALL") {
      const hasCount = m.contests.some((c) => {
        if (!c.transactionCounts) return false;
        const count = c.transactionCounts[transactionStatusFilter] ?? 0;
        return count > 0;
      });
      if (!hasCount) return false;
    }

    return true;
  });

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

          {/* Transaction filter */}
          <div className="flex gap-1 mt-3 flex-wrap">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider py-1.5 mr-2 self-center">
              Transactions
            </span>
            {TRANSACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTransactionStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  transactionStatusFilter === f.value
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10"
                }`}
              >
                {f.label}
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
                {selectedContestId ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedContestId(null)}
                      className="p-1 hover:bg-white/5 rounded-md transition-all text-slate-400 hover:text-white"
                    >
                      ←
                    </button>
                    <h2 className="text-lg font-semibold text-white">
                      Contest Details
                    </h2>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 w-full">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Match Details
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedMatchDetails?.contests
                          ? `${selectedMatchDetails.contests.length} contests found`
                          : "Loading..."}
                      </p>
                    </div>

                    {/* Match Sources */}
                    {selectedMatchDetails && (
                      <div className="flex flex-wrap gap-3">
                        {Object.values(selectedMatchDetails.matchSource).map((source, idx) => (
                          <div key={idx} className="flex gap-3">
                            {source.liveScoreUrl && (
                              <a
                                href={source.liveScoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                              >
                                <span>Live Score</span>
                                <span className="text-[8px]">↗</span>
                              </a>
                            )}
                            {source.scoreCardUrl && (
                              <a
                                href={source.scoreCardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                              >
                                <span>Scorecard</span>
                                <span className="text-[8px]">↗</span>
                              </a>
                            )}
                            {source.matchPageUrl && (
                              <a
                                href={source.matchPageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                              >
                                <span>ESPN Page</span>
                                <span className="text-[8px]">↗</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Tabs */}
                    {selectedMatchDetails && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveSideTab("contests")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeSideTab === "contests"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
                          }`}
                        >
                          Contests
                        </button>
                        <button
                          onClick={() => setActiveSideTab("teams")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeSideTab === "teams"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
                          }`}
                        >
                          Teams & Scorecards
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                  {selectedContestId ? (
                    (() => {
                      const contest = selectedMatchDetails.contests.find(
                        (c) => c.id === selectedContestId,
                      );
                      if (!contest) return null;

                      const leaderboard = contest.leaderBoard
                        ? Object.values(contest.leaderBoard).sort(
                            (a, b) => a.rank - b.rank,
                          )
                        : [];

                      const priceSheet = contest.priceSheet
                        ? Object.values(contest.priceSheet).sort(
                            (a, b) => a.rowNumber - b.rowNumber,
                          )
                        : [];

                      const contestFeeTransactions = (
                        contest.transactions || []
                      ).filter((tx) => tx.type === "CONTEST_FEE");
                      const otherTransactions = (
                        contest.transactions || []
                      ).filter((tx) => tx.type !== "CONTEST_FEE");

                      return (
                        <div className="flex flex-col gap-6">
                          {/* Summary Info */}
                          <div className="bg-white/3 border border-white/5 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-emerald-400 font-bold text-lg">
                                {contest.type}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CONTEST_STATUS_COLORS[contest.status] ?? "bg-slate-500/20 text-slate-400"}`}
                              >
                                {contest.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                              <div>
                                <p className="text-slate-500 uppercase text-[9px]">
                                  Entry Price
                                </p>
                                <p className="text-white">
                                  ${contest.entryPrice}{" "}
                                  {contest.entryPriceCurrency}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase text-[9px]">
                                  Wallet Balance
                                </p>
                                <p className="text-emerald-400 font-bold">
                                  ${contest.walletBalance || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase text-[9px]">
                                  Teams
                                </p>
                                <p className="text-white">
                                  {contest.submittedDreamTeamCount} /{" "}
                                  {contest.teamsTotalLimit}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-1 text-[10px] py-3 border-t border-white/5 font-mono">
                              <p className="flex justify-between">
                                <span className="text-slate-500">
                                  Contest ID:
                                </span>
                                <span className="text-white">
                                  {contest.contestId || contest.id}
                                </span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-500">
                                  Wallet ID:
                                </span>
                                <span
                                  className="text-white truncate ml-4"
                                  title={contest.walletId}
                                >
                                  {contest.walletId}
                                </span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-500">
                                  Match ID:
                                </span>
                                <span
                                  className="text-white truncate ml-4"
                                  title={contest.matchId}
                                >
                                  {contest.matchId}
                                </span>
                              </p>
                            </div>

                            {contest.description && (
                              <p className="mt-2 text-xs text-slate-400 border-t border-white/5 pt-3">
                                {contest.description}
                              </p>
                            )}

                            <a
                              href={`${APP_FRONTEND_URL}/match/${selectedMatchId}/contest/${contest.id}/leaderboard`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all mt-4"
                            >
                              <span>App Leaderboard</span>
                              <span>↗</span>
                            </a>

                            {/* Settle/Refund Button */}
                            {contest.status === "TOSETTLE" && (
                              <div className="flex flex-col gap-2 mt-2">
                                <button
                                  onClick={() =>
                                    handleSettleContest(contest, "SETTLED")
                                  }
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-500/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold border border-blue-500/30 transition-all shadow-lg shadow-blue-500/10"
                                >
                                  Approve and Settle Contest
                                </button>
                              </div>
                            )}
                            {contest.status === "TOREFUND" && (
                              <div className="flex flex-col gap-2 mt-2">
                                <button
                                  onClick={() =>
                                    handleSettleContest(contest, "REFUNDED")
                                  }
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-red-500/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold border border-red-500/30 transition-all shadow-lg shadow-red-500/10"
                                >
                                  Approve and Refund Contest
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Prize Pool / Price Sheet */}
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-3">
                              Prize Distribution
                            </h3>
                            {priceSheet.length > 0 ? (
                              <div className="bg-white/3 border border-white/5 rounded-xl overflow-hidden">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-white/5 text-slate-500 uppercase text-[9px] tracking-wider">
                                    <tr>
                                      <th className="px-3 py-2">Rank</th>
                                      <th className="px-3 py-2">Prize</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {priceSheet.map((item, idx) => (
                                      <tr
                                        key={idx}
                                        className="hover:bg-white/5 transition-colors"
                                      >
                                        <td className="px-3 py-2 text-slate-300">
                                          {item.rankFrom === item.rankTo
                                            ? `Rank ${item.rankFrom}`
                                            : `Rank ${item.rankFrom}-${item.rankTo}`}
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-white">
                                          ${item.price} {item.currency}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-white/3 border border-dashed border-white/5 rounded-xl py-4 text-center text-slate-500 text-xs">
                                No prize information available
                              </div>
                            )}
                          </div>

                          {/* Leaderboard */}
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                              Leaderboard
                              <span className="text-[10px] text-slate-500">
                                {leaderboard.length} entries
                              </span>
                            </h3>
                            {leaderboard.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {leaderboard.map((entry) => (
                                  <div
                                    key={entry.rank}
                                    className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center gap-3"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                                      #{entry.rank}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-white truncate">
                                        {entry.dreamTeamName}
                                      </p>
                                      <p className="text-[10px] text-slate-500 truncate">
                                        {entry.authorName}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-white">
                                        {entry.score}
                                      </p>
                                      <p className="text-[9px] text-slate-500">
                                        Pts
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-white/3 border border-dashed border-white/5 rounded-xl py-8 text-center text-slate-500 text-xs">
                                No leaderboard entries yet
                              </div>
                            )}
                          </div>

                          {/* Transactions */}
                          {contestFeeTransactions.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                                Contest Fees
                                <span className="text-[10px] text-slate-500">
                                  {contestFeeTransactions.length} payments
                                </span>
                              </h3>
                              <div className="flex flex-col gap-3">
                                {contestFeeTransactions.map((tx) => (
                                  <div
                                    key={tx.id}
                                    className="bg-black/20 border border-white/5 rounded-lg p-3"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex flex-col gap-1">
                                        <span
                                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded w-fit ${
                                            tx.status === "PROCESSED"
                                              ? "bg-emerald-500/10 text-emerald-400"
                                              : tx.status === "FAILED"
                                                ? "bg-red-500/10 text-red-500"
                                                : "bg-blue-500/10 text-blue-400"
                                          }`}
                                        >
                                          {tx.status}
                                        </span>
                                        {tx.amount !== undefined && (
                                          <span className="text-xs font-bold text-white">
                                            ${tx.amount}{" "}
                                            {tx.currency ||
                                              contest.entryPriceCurrency}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[9px] text-slate-500">
                                        {new Date(
                                          tx.createdAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-2 mb-2">
                                      <div>
                                        <p className="text-xs text-white">
                                          {tx.fromDescription}
                                        </p>
                                        <p
                                          className="text-[8px] font-mono text-slate-500 truncate"
                                          title={tx.fromWalletId}
                                        >
                                          Wallet: {tx.fromWalletId}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-300">
                                          <span className="text-slate-500 text-[10px] mr-1">
                                            To:
                                          </span>
                                          {tx.toDescription}
                                        </p>
                                        <p
                                          className="text-[8px] font-mono text-slate-500 truncate"
                                          title={tx.toWalletId}
                                        >
                                          Wallet: {tx.toWalletId}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="mt-2 text-[8px] text-slate-600 font-mono truncate">
                                      TxID: {tx.id}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(otherTransactions.length > 0 ||
                            contestFeeTransactions.length === 0) && (
                            <div>
                              <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                                {contestFeeTransactions.length > 0
                                  ? "Other Transactions"
                                  : "Transactions"}
                                <span className="text-[10px] text-slate-500">
                                  {otherTransactions.length} total
                                </span>
                              </h3>
                              {otherTransactions.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                  {otherTransactions.map((tx) => (
                                    <div
                                      key={tx.id}
                                      className="bg-black/20 border border-white/5 rounded-lg p-3"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col gap-1">
                                          <span
                                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded w-fit ${
                                              tx.status === "PROCESSED"
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : tx.status === "FAILED"
                                                  ? "bg-red-500/10 text-red-500"
                                                  : "bg-blue-500/10 text-blue-400"
                                            }`}
                                          >
                                            {tx.status}
                                          </span>
                                          {tx.amount !== undefined && (
                                            <span className="text-xs font-bold text-white">
                                              ${tx.amount}{" "}
                                              {tx.currency ||
                                                contest.entryPriceCurrency}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[9px] text-slate-500">
                                          {new Date(
                                            tx.createdAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-2 mb-2">
                                        <div>
                                          <p className="text-xs text-white">
                                            {tx.fromDescription}
                                          </p>
                                          <p
                                            className="text-[8px] font-mono text-slate-500 truncate"
                                            title={tx.fromWalletId}
                                          >
                                            Wallet: {tx.fromWalletId}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-300">
                                            <span className="text-slate-500 text-[10px] mr-1">
                                              To:
                                            </span>
                                            {tx.toDescription}
                                          </p>
                                          <p
                                            className="text-[8px] font-mono text-slate-500 truncate"
                                            title={tx.toWalletId}
                                          >
                                            Wallet: {tx.toWalletId}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="mt-2 text-[8px] text-slate-600 font-mono truncate">
                                        TxID: {tx.id}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="bg-white/3 border border-dashed border-white/5 rounded-xl py-8 text-center text-slate-500 text-xs">
                                  No transactions yet
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : activeSideTab === "teams" ? (
                    <div className="flex flex-col gap-6 w-full">
                      {selectedMatchDetails.teams?.map((team) => (
                        <div
                          key={team.realTeamId}
                          className="bg-[#101018] border border-white/5 rounded-xl p-4"
                        >
                          <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                            {team.logoURL ? (
                              <img
                                src={team.logoURL}
                                alt={team.teamName}
                                className="w-8 h-8 rounded-full bg-white/10"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                ?
                              </div>
                            )}
                            <div>
                              <h3 className="text-sm font-bold text-white">
                                {team.teamName}{" "}
                                <span className="text-slate-500 text-xs font-normal">
                                  ({team.shortName})
                                </span>
                              </h3>
                            </div>
                          </div>

                          {/* Team Scorecards */}
                          {team.scoreCard && Object.keys(team.scoreCard).length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Team Score</h4>
                              <div className="flex gap-2">
                                {Object.values(team.scoreCard).map((inning) => (
                                  <div key={inning.inning} className="flex-1 bg-white/5 border border-white/5 rounded-lg p-2">
                                    <p className="text-[10px] text-slate-500 mb-1 font-semibold">Inning {inning.inning}</p>
                                    <p className="text-sm font-mono font-bold text-white">
                                      {inning.runs}/{inning.wickets} <span className="text-xs font-normal text-slate-400">({inning.overs} ov)</span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Team players */}
                          <div className="flex flex-col gap-2">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-1">
                              Players
                            </h4>
                            {team.players?.map((player) => (
                              <div
                                key={player.playerProfileId}
                                className="bg-white/3 border border-white/5 rounded-lg p-3"
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {player.imageUrl ? (
                                      <img
                                        src={player.imageUrl}
                                        alt={player.name}
                                        className="w-6 h-6 rounded-full bg-white/10 shrink-0 object-cover"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-[8px]">
                                        ?
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs font-semibold text-white">
                                        {player.name}
                                      </p>
                                      <p className="text-[10px] font-bold text-emerald-400">
                                        ${player.price}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <div className="flex gap-2 text-[9px]">
                                      <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                                        {player.playerRole}
                                      </span>
                                      <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                                        {player.playerSecondRole}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Update Price - Only for PREMATCH or SETTINGUP matches */}
                                {(selectedMatchDetails.status === "PREMATCH" || selectedMatchDetails.status === "SETTINGUP") && (
                                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                                    <input
                                      type="number"
                                      placeholder="Price"
                                      defaultValue={player.price}
                                      onChange={(e) => {
                                        setPendingPlayerPrices(prev => ({ ...prev, [player.playerProfileId]: e.target.value }));
                                      }}
                                      className="w-16 bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                    />
                                    <button
                                      onClick={() => handleUpdatePlayerPrice(selectedMatchDetails.id, team.realTeamId, player.playerProfileId)}
                                      disabled={updatingPricePlayerId === player.playerProfileId}
                                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 transition-all disabled:opacity-50"
                                    >
                                      {updatingPricePlayerId === player.playerProfileId ? "..." : "Set Price"}
                                    </button>
                                  </div>
                                )}

                                {/* Player Scorecards */}
                                {player.scoreCard &&
                                  Object.keys(player.scoreCard).length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                      {Object.values(player.scoreCard).map(
                                        (inning) => (
                                          <div
                                            key={inning.inning}
                                            className="mb-2 last:mb-0"
                                          >
                                            <p className="text-[10px] text-slate-500 mb-1 font-semibold">
                                              Inning {inning.inning}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                              {Object.values(inning.items).map(
                                                (item, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="bg-black/20 border border-white/5 rounded px-1.5 py-0.5 text-[9px] flex items-center gap-1"
                                                  >
                                                    <span className="text-slate-500">
                                                      {item.scoreCardItemType}:
                                                    </span>
                                                    <span className="text-white font-mono">
                                                      {item.value}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Create Contest Button/Form */}
                      {!isCreatingContest ? (
                        <button
                          onClick={() => setIsCreatingContest(true)}
                          className="w-full py-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-2 mb-2"
                        >
                          <span className="text-lg">+</span>
                          Create New Contest
                        </button>
                      ) : (
                        <div className="mb-4">
                          <CreateContestForm
                            matchId={selectedMatchId!}
                            onSuccess={handleContestCreated}
                            onCancel={() => setIsCreatingContest(false)}
                          />
                        </div>
                      )}

                      {selectedMatchDetails?.contests.map((contest: Contest) => {
                      // Calculate transaction counts derived from transactions array if not provided
                      const txCounts = contest.transactionCounts || {
                        submitted:
                          contest.transactions?.filter(
                            (t: Transaction) => t.status === "SUBMITTED",
                          ).length || 0,
                        processed:
                          contest.transactions?.filter(
                            (t: Transaction) => t.status === "PROCESSED",
                          ).length || 0,
                        failed:
                          contest.transactions?.filter(
                            (t: Transaction) => t.status === "FAILED",
                          ).length || 0,
                      };

                      return (
                        <div
                          key={contest.id}
                          onClick={() => setSelectedContestId(contest.id)}
                          className="bg-white/3 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                {contest.type}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                ID: {contest.id}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                (CONTEST_STATUS_COLORS as Record<string, string>)[
                                  contest.status
                                ] ?? "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {contest.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                            <div className="bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                                Price
                              </p>
                              <p className="text-xs font-semibold text-white">
                                ${contest.entryPrice}
                              </p>
                            </div>
                            <div className="bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                                Bal
                              </p>
                              <p className="text-xs font-bold text-emerald-400">
                                ${contest.walletBalance || 0}
                              </p>
                            </div>
                            <div className="bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                                Teams
                              </p>
                              <p className="text-xs font-semibold text-white">
                                {contest.submittedDreamTeamCount}/
                                {contest.teamsTotalLimit}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-blue-500/5 rounded-lg px-2 py-1.5 border border-blue-500/10">
                              <p className="text-[8px] text-blue-500 uppercase tracking-wider">
                                Subm
                              </p>
                              <p className="text-[11px] font-semibold text-blue-400">
                                {txCounts.submitted}
                              </p>
                            </div>
                            <div className="bg-emerald-500/5 rounded-lg px-2 py-1.5 border border-emerald-500/10">
                              <p className="text-[8px] text-emerald-500 uppercase tracking-wider">
                                Proc
                              </p>
                              <p className="text-[11px] font-semibold text-emerald-400">
                                {txCounts.processed}
                              </p>
                            </div>
                            <div className="bg-red-500/5 rounded-lg px-2 py-1.5 border border-red-500/10">
                              <p className="text-[8px] text-red-500 uppercase tracking-wider">
                                Fail
                              </p>
                              <p className="text-[11px] font-semibold text-red-400">
                                {txCounts.failed}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span>View Details</span>
                              <span className="group-hover:translate-x-0.5 transition-transform">
                                →
                              </span>
                            </div>
                            <a
                              onClick={(e) => e.stopPropagation()}
                              href={`${APP_FRONTEND_URL}/match/${selectedMatchId}/contest/${contest.id}/leaderboard`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto py-1 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/20 transition-all flex items-center gap-1.5 font-semibold"
                            >
                              <span>App Link</span>
                              <span>↗</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        loading={loadingDetails}
      />
    </div>
  );
}
