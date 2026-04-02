"use client";

import { useState, useEffect, useCallback } from "react";
import { matchesApi, contestsApi, ownerApi } from "@/lib/api";
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
  AutoFinalizeMatch,
  InningScore,
  ScoreCardInning,
  PlayerProfile,
  PlayerSecondRole,
} from "@/types";
import { MatchCard } from "@/components/MatchCard";
import { CreateContestForm } from "@/components/CreateContestForm";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CONTEST_STATUS_COLORS } from "@/lib/utils";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

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
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const today = new Date();
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(
    toDateInputValue(new Date(today.getTime() + 7 * 86400000)),
  );
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<
    "submitted" | "processed" | "failed" | "ALL"
  >("ALL");
  const [showAutoFinalizeOnly, setShowAutoFinalizeOnly] = useState(false);
  const [matches, setMatches] = useState<MatchWithContestSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFinalizeMatches, setAutoFinalizeMatches] = useState<AutoFinalizeMatch[]>([]);

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
  const [editingTeamScore, setEditingTeamScore] = useState<{ realTeamId: string; inning: number } | null>(null);
  const [editingPlayerScore, setEditingPlayerScore] = useState<{ playerProfileId: string; inning: number } | null>(null);
  const [pendingInningScores, setPendingInningScores] = useState<Record<string, Partial<InningScore>>>({});
  const [pendingPlayerScoreItems, setPendingPlayerScoreItems] = useState<Record<string, Record<string, string | number>>>({});
  const [editingPlayer, setEditingPlayer] = useState<{
    matchId: string;
    realTeamId: string;
    playerProfileId: string;
    name: string;
    playerRole: string;
    playerSecondRole: string;
    price: number;
    espnId?: string;
    imageUrl?: string;
  } | null>(null);
  const [editingTeamInfo, setEditingTeamInfo] = useState<{
    matchId: string;
    realTeamId: string;
    name: string;
    shortName: string;
    logoURL: string;
  } | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamData, setNewTeamData] = useState({ name: "", shortName: "", logoURL: "" });
  const [isAddingPlayerToTeamId, setIsAddingPlayerToTeamId] = useState<string | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<PlayerProfile | null>(null);
  const [newPlayerData, setNewPlayerData] = useState({
    playerSecondRole: "BATTER" as PlayerSecondRole,
    price: 0,
    espnId: "",
    imageUrl: ""
  });
  const [isEditingContestConfig, setIsEditingContestConfig] = useState(false);
  const [pendingContestConfig, setPendingContestConfig] = useState<Partial<UpdateContestConfigurationRequest>>({});

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

  const fetchAutoFinalizeList = useCallback(async () => {
    try {
      const list = await adminApi.getAutoFinalizeMatchList();
      setAutoFinalizeMatches(list);
    } catch (err) {
      console.error("Failed to fetch auto-finalize list", err);
    }
  }, []);

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

  const handleTriggerFinalization = async () => {
    if (!selectedMatchId) return;

    setConfirmModal({
      isOpen: true,
      title: "Trigger Match Finalization",
      message: "Are you sure you want to trigger manual finalization for this match? This will process payouts and points.",
      variant: "blue",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await adminApi.triggerMatchFinalization({ matchId: selectedMatchId });
          alert("Match finalization triggered successfully");
          // Refresh details
          await handleMatchClick(selectedMatchId);
        } catch (err: any) {
          console.error("Failed to trigger finalization", err);
          alert(err.response?.data?.message || "Failed to trigger finalization");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleAddMatchToAutoFinalize = async () => {
    if (!selectedMatchId) return;

    try {
      setLoadingDetails(true);
      await adminApi.addMatchToAutoFinalizeList({ matchId: selectedMatchId });
      alert("Match added to auto-finalize list");
      await fetchAutoFinalizeList();
      // Refresh details
      await handleMatchClick(selectedMatchId);
    } catch (err: any) {
      console.error("Failed to add to auto-finalize", err);
      alert(err.response?.data?.message || "Failed to add to auto-finalize");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRemoveMatchFromAutoFinalize = async () => {
    if (!selectedMatchId) return;

    try {
      setLoadingDetails(true);
      await adminApi.removeMatchFromAutoFinalizeList({ matchId: selectedMatchId });
      alert("Match removed from auto-finalize list");
      await fetchAutoFinalizeList();
      // Refresh details
      await handleMatchClick(selectedMatchId);
    } catch (err: any) {
      console.error("Failed to remove from auto-finalize", err);
      alert(err.response?.data?.message || "Failed to remove from auto-finalize");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateScoreFromEspn = async () => {
    if (!selectedMatchId) return;

    setConfirmModal({
      isOpen: true,
      title: "Update Score from ESPN",
      message: "Are you sure you want to trigger a score update from ESPN for this match?",
      variant: "blue",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await adminApi.updateMatchScoreFromEspn({ matchId: selectedMatchId });
          alert("Score update triggered successfully");
          // Refresh details
          await handleMatchClick(selectedMatchId);
        } catch (err: any) {
          console.error("Failed to update score", err);
          alert(err.response?.data?.message || "Failed to update score");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleRecalculateScorecard = async () => {
    if (!selectedMatchId) return;

    setConfirmModal({
      isOpen: true,
      title: "Recalculate Scorecard",
      message: "Are you sure you want to recalculate the scorecard for this match? This will update dream team points and leaderboard.",
      variant: "blue",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await adminApi.recalculateMatchScorecard({ matchId: selectedMatchId });
          alert("Scorecard recalculation triggered successfully");
          // Refresh details
          await handleMatchClick(selectedMatchId);
        } catch (err: any) {
          console.error("Failed to recalculate scorecard", err);
          alert(err.response?.data?.message || "Failed to recalculate scorecard");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleCreditContestFromCollection = async (contestId: string) => {
    if (!selectedMatchId) return;

    setConfirmModal({
      isOpen: true,
      title: "Credit from Collection",
      message: "Are you sure you want to credit this contest wallet from the contest collection wallet?",
      variant: "blue",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await ownerApi.creditContestFromCollection({ matchId: selectedMatchId, contestId });
          alert("Contest wallet credited successfully");
          // Refresh details
          await handleMatchClick(selectedMatchId);
          setSelectedContestId(contestId);
        } catch (err: any) {
          console.error("Failed to credit contest", err);
          alert(err.response?.data?.message || "Failed to credit contest");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleUpdateContestConfig = async () => {
    if (!selectedMatchId || !selectedContestId || !pendingContestConfig) return;
    try {
      setLoadingDetails(true);
      await ownerApi.updateContestConfiguration({
        matchId: selectedMatchId,
        contestId: selectedContestId,
        ...pendingContestConfig
      });
      alert("Contest configuration updated successfully");
      setIsEditingContestConfig(false);
      // Refresh details
      await handleMatchClick(selectedMatchId);
      setSelectedContestId(selectedContestId);
    } catch (err: any) {
      console.error("Failed to update contest config", err);
      alert(err.response?.data?.message || "Failed to update contest configuration");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteContest = async (contestId: string) => {
    if (!selectedMatchId) return;

    setConfirmModal({
      isOpen: true,
      title: "Delete Contest",
      message: "Are you sure you want to delete this contest? This action cannot be undone.",
      variant: "red",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await adminApi.deleteContest(selectedMatchId, contestId);
          alert("Contest deleted successfully");
          // Refresh details
          await handleMatchClick(selectedMatchId);
        } catch (err: any) {
          console.error("Failed to delete contest", err);
          alert(err.response?.data?.message || "Failed to delete contest");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };


  const handleUpdateTeamScore = async (realTeamId: string, inning: number) => {
    if (!selectedMatchId || !selectedMatchDetails) return;
    const pending = pendingInningScores[`${realTeamId}#${inning}`];
    if (!pending) return;

    const team = selectedMatchDetails.teams.find(t => t.realTeamId === realTeamId);
    if (!team) return;

    const currentScoreCard = team.scoreCard || {};
    const updatedInningScore = {
      ...(currentScoreCard[inning] || { inning, runs: 0, wickets: 0, overs: 0 }),
      ...pending
    };

    const newScoreCard = {
      ...currentScoreCard,
      [inning]: updatedInningScore
    };

    try {
      setLoadingDetails(true);
      await ownerApi.updateRealTeamScoreCard({
        matchId: selectedMatchId,
        realTeamId,
        scoreCard: newScoreCard
      });
      // Refresh details
      const details = await matchesApi.getAllContestsByMatchId(selectedMatchId);
      setSelectedMatchDetails(details);
      setEditingTeamScore(null);
    } catch (err: any) {
      console.error("Failed to update team score", err);
      alert(err.response?.data?.message || "Failed to update team score");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdatePlayerScore = async (playerProfileId: string, realTeamId: string, inning: number) => {
    if (!selectedMatchId || !selectedMatchDetails) return;
    const pending = pendingPlayerScoreItems[`${playerProfileId}#${inning}`];
    if (!pending) return;

    const team = selectedMatchDetails.teams.find(t => t.realTeamId === realTeamId);
    const player = team?.players.find(p => p.playerProfileId === playerProfileId);
    if (!player) return;

    const currentScoreCard = player.scoreCard || {};
    const currentInning = currentScoreCard[inning] || { inning, items: {} };

    const updatedItems = { ...currentInning.items };
    Object.entries(pending).forEach(([type, val]) => {
      // Find valueType from current or default to INT or FLOAT
      const existing = updatedItems[type];
      const valueType = existing?.valueType || (typeof val === 'number' ? 'INT' : 'STRING');
      updatedItems[type] = {
        scoreCardItemType: type,
        valueType,
        value: val
      };
    });

    const newScoreCard = {
      ...currentScoreCard,
      [inning]: {
        inning,
        items: updatedItems
      }
    };

    try {
      setLoadingDetails(true);
      await ownerApi.updatePlayerScoreCard({
        matchId: selectedMatchId,
        playerProfileId,
        realTeamId,
        scoreCard: newScoreCard
      });
      // Refresh details
      const details = await matchesApi.getAllContestsByMatchId(selectedMatchId);
      setSelectedMatchDetails(details);
      setEditingPlayerScore(null);
    } catch (err: any) {
      console.error("Failed to update player score", err);
      alert(err.response?.data?.message || "Failed to update player score");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteMatchTeamPlayer = async (matchId: string, realTeamId: string, playerProfileId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Player From Team",
      message: "Are you sure you want to remove this player from the team for this match? This action cannot be undone.",
      variant: "red",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await ownerApi.deleteMatchTeamPlayer({ matchId, realTeamId, playerProfileId });
          alert("Player removed successfully");
          // Refresh details
          await handleMatchClick(matchId);
        } catch (err: any) {
          console.error("Failed to remove player", err);
          alert(err.response?.data?.message || "Failed to remove player from team");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const handleCreateMatchTeam = async () => {
    if (!selectedMatchId || !newTeamData.name || !newTeamData.shortName) return;
    try {
      setLoadingDetails(true);
      await ownerApi.createMatchTeam({
        matchId: selectedMatchId,
        ...newTeamData
      });
      alert("Team created successfully");
      setIsAddingTeam(false);
      setNewTeamData({ name: "", shortName: "", logoURL: "" });
      await handleMatchClick(selectedMatchId);
    } catch (err: any) {
      console.error("Failed to create team", err);
      alert(err.response?.data?.message || "Failed to create team");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddPlayerToTeam = async () => {
    if (!selectedMatchId || !isAddingPlayerToTeamId || !selectedPlayerProfile) return;
    try {
      setLoadingDetails(true);
      await ownerApi.addMatchTeamPlayer({
        matchId: selectedMatchId,
        realTeamId: isAddingPlayerToTeamId,
        playerProfileId: selectedPlayerProfile.playerProfileId,
        playerSecondRole: newPlayerData.playerSecondRole,
        price: newPlayerData.price || selectedPlayerProfile.defaultPrice || 0,
        espnId: newPlayerData.espnId || selectedPlayerProfile.espnId,
        imageUrl: newPlayerData.imageUrl || selectedPlayerProfile.imageUrl
      });
      alert("Player added successfully");
      setIsAddingPlayerToTeamId(null);
      setSelectedPlayerProfile(null);
      setNewPlayerData({ playerSecondRole: "BATTER", price: 0, espnId: "", imageUrl: "" });
      await handleMatchClick(selectedMatchId);
    } catch (err: any) {
      console.error("Failed to add player", err);
      alert(err.response?.data?.message || "Failed to add player");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteMatchTeam = async (matchId: string, realTeamId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Team",
      message: "Are you sure you want to delete this team? This will fail if any players are referenced in dream teams. This action cannot be undone.",
      variant: "red",
      onConfirm: async () => {
        setLoadingDetails(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await ownerApi.deleteMatchTeam(matchId, realTeamId);
          alert("Team deleted successfully");
          await handleMatchClick(matchId);
        } catch (err: any) {
          console.error("Failed to delete team", err);
          alert(err.response?.data?.message || "Failed to delete team. It might be referenced in dream teams.");
        } finally {
          setLoadingDetails(false);
        }
      },
    });
  };

  const fetchPlayerProfiles = async (query: string) => {
    if (query.length < 2) {
      setPlayerProfiles([]);
      return;
    }
    try {
      const data = await adminApi.getAllPlayerProfiles({ 
        pageSize: 50,
        playerName: query
      });
      setPlayerProfiles(data.items || []);
    } catch (err) {
      console.error("Failed to fetch player profiles", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (playerSearchQuery) {
        fetchPlayerProfiles(playerSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearchQuery]);

  const handleEditMatchTeam = async (data: {
    matchId: string;
    realTeamId: string;
    name?: string;
    shortName?: string;
    logoURL?: string;
    players?: any[];
  }) => {
    try {
      setLoadingDetails(true);
      await ownerApi.editMatchTeam(data);
      alert("Team updated successfully");
      // Refresh details
      await handleMatchClick(data.matchId);
      setEditingPlayer(null);
      setEditingTeamInfo(null);
    } catch (err: any) {
      console.error("Failed to update team", err);
      alert(err.response?.data?.message || "Failed to update team info");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Helper to update just one player by sending the whole list (diff-based)
  const updateSinglePlayerInTeam = async (playerUpdate: any) => {
    if (!selectedMatchDetails) return;
    const team = selectedMatchDetails.teams.find(t => t.realTeamId === playerUpdate.realTeamId);
    if (!team) return;

    const playersPayload = team.players.map(p => {
      if (p.playerProfileId === playerUpdate.playerProfileId) {
        return {
          playerProfileId: p.playerProfileId,
          playerSecondRole: playerUpdate.playerSecondRole,
          price: playerUpdate.price,
          espnId: playerUpdate.espnId,
          imageUrl: playerUpdate.imageUrl
        };
      }
      return {
        playerProfileId: p.playerProfileId,
        playerSecondRole: p.playerSecondRole,
        price: p.price,
        espnId: p.espnId,
        imageUrl: p.imageUrl
      };
    });

    await handleEditMatchTeam({
      matchId: playerUpdate.matchId,
      realTeamId: playerUpdate.realTeamId,
      players: playersPayload
    });
  };

  // Fetch when dates change
  useEffect(() => {
    setNextCursor(undefined);
    fetchMatches();
    fetchAutoFinalizeList();
  }, [fetchMatches, fetchAutoFinalizeList]);

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

    // 3. Auto-finalize Filter
    if (showAutoFinalizeOnly) {
      if (!autoFinalizeMatches.some(af => af.matchId === m.id)) {
        return false;
      }
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
            <button
              onClick={() => {
                setShowAutoFinalizeOnly(!showAutoFinalizeOnly);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                showAutoFinalizeOnly
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_10px_-2px_rgba(192,132,252,0.3)]"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10"
              }`}
            >
              Auto-Finalizing
              <span className="ml-1.5 text-[10px] opacity-60">
                {autoFinalizeMatches.length}
              </span>
            </button>
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
                  isAutoFinalizeEnabled={autoFinalizeMatches.some(af => af.matchId === match.id)}
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
                      <div className="flex items-center justify-between">
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
                        {selectedMatchDetails && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status</span>
                            <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold py-1 px-2 rounded border border-emerald-500/20">
                              {selectedMatchDetails.status}
                            </div>
                          </div>
                        )}
                      </div>
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
                    
                    {/* Tabs & Admin Actions */}
                    {selectedMatchDetails && (
                      <div className="flex flex-col gap-3">
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

                        {/* Match Actions */}
                        <div className="flex flex-wrap gap-2">
                          {selectedMatchDetails.status !== "FINALIZED" && (
                            <button
                              onClick={handleTriggerFinalization}
                              className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              Finalize Match
                            </button>
                          )}
                          <button
                            onClick={handleUpdateScoreFromEspn}
                            className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            Update Score From ESPN
                          </button>
                          <button
                            onClick={handleRecalculateScorecard}
                            className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            Recalculate Scorecard
                          </button>
                          <div className="w-full" /> {/* Force next row for auto-finalize if needed */}
                          {autoFinalizeMatches.some(af => af.matchId === selectedMatchId) ? (
                            <button
                              onClick={handleRemoveMatchFromAutoFinalize}
                              className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-500/10 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              Disable Auto-Finalize
                            </button>
                          ) : (
                            <button
                              onClick={handleAddMatchToAutoFinalize}
                              className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              Enable Auto-Finalize
                            </button>
                          )}
                        </div>
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

                            {isOwner && (
                              <button
                                onClick={() => {
                                  setIsEditingContestConfig(true);
                                  setPendingContestConfig({
                                    teamsPerUserLimit: contest.teamsPerUserLimit,
                                    teamsTotalLimit: contest.teamsTotalLimit,
                                    description: contest.description,
                                    priceSheet: contest.priceSheet
                                  });
                                }}
                                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-all mt-2"
                              >
                                Edit Configuration
                              </button>
                            )}

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

                            {isOwner && (contest.walletBalance || 0) < (contest.prizePool || 0) && (
                              <div className="flex flex-col gap-2 mt-2">
                                <button
                                  onClick={() => handleCreditContestFromCollection(contest.id)}
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold border border-purple-500/20 transition-all"
                                >
                                  Credit from Collection
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Prize Pool / Price Sheet */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold text-white">
                                {isEditingContestConfig ? "Edit Contest Configuration" : "Prize Distribution"}
                              </h3>
                              {isEditingContestConfig && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setIsEditingContestConfig(false)}
                                    className="text-[10px] font-bold text-slate-500 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleUpdateContestConfig}
                                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              )}
                            </div>

                            {isEditingContestConfig ? (
                              <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Teams Per User</label>
                                    <input
                                      type="number"
                                      value={pendingContestConfig.teamsPerUserLimit}
                                      onChange={(e) => setPendingContestConfig({ ...pendingContestConfig, teamsPerUserLimit: parseInt(e.target.value) })}
                                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Total Teams Limit</label>
                                    <input
                                      type="number"
                                      value={pendingContestConfig.teamsTotalLimit}
                                      onChange={(e) => setPendingContestConfig({ ...pendingContestConfig, teamsTotalLimit: parseInt(e.target.value) })}
                                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 col-span-2">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Description</label>
                                    <textarea
                                      value={pendingContestConfig.description || ""}
                                      onChange={(e) => setPendingContestConfig({ ...pendingContestConfig, description: e.target.value })}
                                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 min-h-[60px]"
                                    />
                                  </div>
                                </div>

                                <div className="border-t border-white/5 pt-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Price Sheet</p>
                                    <button
                                      onClick={() => {
                                        const sheet = { ...pendingContestConfig.priceSheet } as Record<string, PriceSheetItem>;
                                        const newRow = (Object.keys(sheet).length + 1).toString();
                                        sheet[newRow] = {
                                          description: `Rank ${newRow}`,
                                          rankFrom: 1,
                                          rankTo: 1,
                                          price: 0,
                                          currency: contest.entryPriceCurrency,
                                          rowNumber: parseInt(newRow)
                                        };
                                        setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                      }}
                                      className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300"
                                    >
                                      + Add Row
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    {Object.entries(pendingContestConfig.priceSheet || {}).sort((a, b) => a[1].rowNumber - b[1].rowNumber).map(([key, item]) => (
                                      <div key={key} className="bg-black/20 border border-white/10 rounded-lg p-2 flex flex-col gap-2">
                                        <div className="grid grid-cols-4 gap-2">
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-slate-500">From</label>
                                            <input
                                              type="number"
                                              value={item.rankFrom}
                                              onChange={(e) => {
                                                const sheet = { ...pendingContestConfig.priceSheet };
                                                sheet[key] = { ...item, rankFrom: parseInt(e.target.value) };
                                                setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                              }}
                                              className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white"
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-slate-500">To</label>
                                            <input
                                              type="number"
                                              value={item.rankTo}
                                              onChange={(e) => {
                                                const sheet = { ...pendingContestConfig.priceSheet };
                                                sheet[key] = { ...item, rankTo: parseInt(e.target.value) };
                                                setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                              }}
                                              className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white"
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-slate-500">Price</label>
                                            <input
                                              type="number"
                                              value={item.price}
                                              onChange={(e) => {
                                                const sheet = { ...pendingContestConfig.priceSheet };
                                                sheet[key] = { ...item, price: parseFloat(e.target.value) };
                                                setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                              }}
                                              className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white"
                                            />
                                          </div>
                                          <div className="flex flex-col justify-end">
                                            <button
                                              onClick={() => {
                                                const sheet = { ...pendingContestConfig.priceSheet };
                                                delete sheet[key];
                                                setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                              }}
                                              className="text-[10px] font-bold text-red-500 hover:text-red-400 py-1"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                        <input
                                          type="text"
                                          value={item.description}
                                          placeholder="Description"
                                          onChange={(e) => {
                                            const sheet = { ...pendingContestConfig.priceSheet };
                                            sheet[key] = { ...item, description: e.target.value };
                                            setPendingContestConfig({ ...pendingContestConfig, priceSheet: sheet });
                                          }}
                                          className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white w-full"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : priceSheet.length > 0 ? (
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
                      {/* Add Team Button */}
                      {!isAddingTeam && (
                        <button
                          onClick={() => {
                            setIsAddingTeam(true);
                            setNewTeamData({ name: "", shortName: "", logoURL: "" });
                          }}
                          className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <span className="text-base">+</span> Add Team to Match
                        </button>
                      )}

                      {/* Add Team Form */}
                      {isAddingTeam && (
                        <div className="bg-[#101018] border border-emerald-500/20 rounded-xl p-4 shadow-lg shadow-emerald-500/5">
                          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Create New Team
                          </h3>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Team Name</label>
                              <input
                                type="text"
                                placeholder="e.g. India"
                                value={newTeamData.name}
                                onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Short Name</label>
                              <input
                                type="text"
                                placeholder="e.g. IND"
                                value={newTeamData.shortName}
                                onChange={(e) => setNewTeamData({ ...newTeamData, shortName: e.target.value })}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                              />
                            </div>
                            <div className="flex flex-col gap-1 col-span-2">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Logo URL</label>
                              <input
                                type="text"
                                placeholder="https://..."
                                value={newTeamData.logoURL}
                                onChange={(e) => setNewTeamData({ ...newTeamData, logoURL: e.target.value })}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsAddingTeam(false)}
                              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold border border-white/10 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateMatchTeam}
                              disabled={!newTeamData.name || !newTeamData.shortName}
                              className="flex-2 py-2 px-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all disabled:opacity-50"
                            >
                              Create Team
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedMatchDetails.teams?.map((team) => (
                        <div
                          key={team.realTeamId}
                          className="bg-[#101018] border border-white/5 rounded-xl p-4"
                        >
                          <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                            {editingTeamInfo?.realTeamId === team.realTeamId ? (
                              <div className="flex flex-col gap-3 w-full">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] text-slate-500 uppercase">Team Name</label>
                                    <input
                                      type="text"
                                      value={editingTeamInfo.name}
                                      onChange={(e) => setEditingTeamInfo({ ...editingTeamInfo, name: e.target.value })}
                                      className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] text-slate-500 uppercase">Short Name</label>
                                    <input
                                      type="text"
                                      value={editingTeamInfo.shortName}
                                      onChange={(e) => setEditingTeamInfo({ ...editingTeamInfo, shortName: e.target.value })}
                                      className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 col-span-2">
                                    <label className="text-[8px] text-slate-500 uppercase">Logo URL</label>
                                    <input
                                      type="text"
                                      value={editingTeamInfo.logoURL}
                                      onChange={(e) => setEditingTeamInfo({ ...editingTeamInfo, logoURL: e.target.value })}
                                      className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditingTeamInfo(null)}
                                    className="flex-1 py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold border border-white/10"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleEditMatchTeam({
                                      matchId: editingTeamInfo.matchId,
                                      realTeamId: editingTeamInfo.realTeamId,
                                      name: editingTeamInfo.name,
                                      shortName: editingTeamInfo.shortName,
                                      logoURL: editingTeamInfo.logoURL
                                    })}
                                    className="flex-1 py-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shadow-emerald-500/10"
                                  >
                                    Save Team
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
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
                                <div className="flex-1">
                                  <h3 className="text-sm font-bold text-white">
                                    {team.teamName}{" "}
                                    <span className="text-slate-500 text-xs font-normal">
                                      ({team.shortName})
                                    </span>
                                  </h3>
                                </div>
                                <button
                                  onClick={() => setEditingTeamInfo({
                                    matchId: selectedMatchDetails.id,
                                    realTeamId: team.realTeamId,
                                    name: team.teamName,
                                    shortName: team.shortName || "",
                                    logoURL: team.logoURL
                                  })}
                                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMatchTeam(selectedMatchDetails.id, team.realTeamId)}
                                  className="text-[9px] font-bold text-red-500 hover:text-red-400"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>

                          {/* Team Scorecards */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Score</h4>
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    const currentInnings = team.scoreCard ? Object.keys(team.scoreCard).length : 0;
                                    const nextInning = currentInnings + 1;
                                    setEditingTeamScore({ realTeamId: team.realTeamId, inning: nextInning });
                                    setPendingInningScores({ [`${team.realTeamId}#${nextInning}`]: { runs: 0, wickets: 0, overs: 0 } });
                                  }}
                                  className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                  + Add Inning
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {team.scoreCard && Object.values(team.scoreCard).map((inning) => (
                                <div key={inning.inning} className="bg-white/5 border border-white/5 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Inning {inning.inning}</p>
                                    <div className="flex gap-2">
                                      {editingTeamScore?.realTeamId === team.realTeamId && editingTeamScore?.inning === inning.inning ? (
                                        <>
                                          <button
                                            onClick={() => setEditingTeamScore(null)}
                                            className="text-[9px] font-bold text-slate-500 hover:text-slate-400"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleUpdateTeamScore(team.realTeamId, inning.inning)}
                                            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300"
                                          >
                                            Save
                                          </button>
                                        </>
                                      ) : isOwner ? (
                                        <button
                                          onClick={() => {
                                            setEditingTeamScore({ realTeamId: team.realTeamId, inning: inning.inning });
                                            setPendingInningScores({ [`${team.realTeamId}#${inning.inning}`]: { runs: inning.runs, wickets: inning.wickets, overs: inning.overs } });
                                          }}
                                          className="text-[9px] font-bold text-blue-400 hover:text-blue-300"
                                        >
                                          Edit
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  
                                  {editingTeamScore?.realTeamId === team.realTeamId && editingTeamScore?.inning === inning.inning ? (
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <p className="text-[9px] text-slate-500 mb-1">Runs</p>
                                        <input
                                          type="number"
                                          defaultValue={inning.runs}
                                          onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${inning.inning}`]: { ...prev[`${team.realTeamId}#${inning.inning}`], runs: parseInt(e.target.value) } }))}
                                          className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-500 mb-1">Wickets</p>
                                        <input
                                          type="number"
                                          defaultValue={inning.wickets}
                                          onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${inning.inning}`]: { ...prev[`${team.realTeamId}#${inning.inning}`], wickets: parseInt(e.target.value) } }))}
                                          className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-500 mb-1">Overs</p>
                                        <input
                                          type="number"
                                          step="0.1"
                                          defaultValue={inning.overs}
                                          onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${inning.inning}`]: { ...prev[`${team.realTeamId}#${inning.inning}`], overs: parseFloat(e.target.value) } }))}
                                          className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm font-mono font-bold text-white">
                                      {inning.runs}/{inning.wickets} <span className="text-xs font-normal text-slate-400">({inning.overs} ov)</span>
                                    </p>
                                  )}
                                </div>
                              ))}
                              
                              {/* Show new inning fields if adding */}
                              {editingTeamScore?.realTeamId === team.realTeamId && !team.scoreCard?.[editingTeamScore.inning] && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-emerald-400 font-semibold uppercase">New Inning {editingTeamScore.inning}</p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setEditingTeamScore(null)}
                                        className="text-[9px] font-bold text-slate-500 hover:text-slate-400"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleUpdateTeamScore(team.realTeamId, editingTeamScore.inning)}
                                        className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300"
                                      >
                                        Create
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <p className="text-[9px] text-slate-500 mb-1">Runs</p>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${editingTeamScore.inning}`]: { ...prev[`${team.realTeamId}#${editingTeamScore.inning}`], runs: parseInt(e.target.value) } }))}
                                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-500 mb-1">Wickets</p>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${editingTeamScore.inning}`]: { ...prev[`${team.realTeamId}#${editingTeamScore.inning}`], wickets: parseInt(e.target.value) } }))}
                                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-500 mb-1">Overs</p>
                                      <input
                                        type="number"
                                        step="0.1"
                                        placeholder="0"
                                        onChange={(e) => setPendingInningScores(prev => ({ ...prev, [`${team.realTeamId}#${editingTeamScore.inning}`]: { ...prev[`${team.realTeamId}#${editingTeamScore.inning}`], overs: parseFloat(e.target.value) } }))}
                                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Team players */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between mb-2 mt-1">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Players
                              </h4>
                              <button
                                onClick={() => {
                                  setIsAddingPlayerToTeamId(team.realTeamId);
                                  setSelectedPlayerProfile(null);
                                  setPlayerSearchQuery("");
                                  setNewPlayerData({ playerSecondRole: "BATTER", price: 0, espnId: "", imageUrl: "" });
                                }}
                                className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                + Add Player
                              </button>
                            </div>

                            {/* Add Player Form */}
                            {isAddingPlayerToTeamId === team.realTeamId && (
                              <div className="bg-black/30 border border-emerald-500/20 rounded-lg p-3 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <p className="text-[10px] font-bold text-white mb-2 uppercase">Add Player to {team.shortName || team.teamName}</p>
                                
                                {!selectedPlayerProfile ? (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      placeholder="Search player profile (min 2 chars)..."
                                      value={playerSearchQuery}
                                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                    />
                                    {playerProfiles.length > 0 && (
                                      <div className="max-h-40 overflow-y-auto bg-black/60 rounded border border-white/10">
                                        {playerProfiles.map(p => (
                                          <button
                                            key={p.playerProfileId}
                                            onClick={() => {
                                              setSelectedPlayerProfile(p);
                                              setNewPlayerData({
                                                playerSecondRole: p.defaultPlayerSecondRole || "BATTER",
                                                price: p.defaultPrice || 0,
                                                espnId: p.espnId || "",
                                                imageUrl: p.imageUrl || ""
                                              });
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center justify-between"
                                          >
                                            <span>{p.name}</span>
                                            <span className="text-[8px] bg-white/10 px-1 rounded">{p.country || "N/A"}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded border border-white/5">
                                      {selectedPlayerProfile.imageUrl && (
                                        <img src={selectedPlayerProfile.imageUrl} className="w-6 h-6 rounded-full" />
                                      )}
                                      <span className="text-xs text-white font-semibold">{selectedPlayerProfile.name}</span>
                                      <button 
                                        onClick={() => setSelectedPlayerProfile(null)}
                                        className="ml-auto text-[8px] text-slate-500 hover:text-white"
                                      >
                                        Change
                                      </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[8px] text-slate-500 uppercase">Role</label>
                                        <select
                                          value={newPlayerData.playerSecondRole}
                                          onChange={(e) => setNewPlayerData({ ...newPlayerData, playerSecondRole: e.target.value as any })}
                                          className="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                        >
                                          <option value="BATTER">BATTER</option>
                                          <option value="BOWLER">BOWLER</option>
                                          <option value="ALLROUNDER">ALLROUNDER</option>
                                          <option value="WICKETKEEPER">WICKETKEEPER</option>
                                        </select>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[8px] text-slate-500 uppercase">Price</label>
                                        <input
                                          type="number"
                                          value={newPlayerData.price}
                                          onChange={(e) => setNewPlayerData({ ...newPlayerData, price: parseFloat(e.target.value) })}
                                          className="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setIsAddingPlayerToTeamId(null)}
                                        className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={handleAddPlayerToTeam}
                                        className="flex-1 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold border border-emerald-500/30"
                                      >
                                        Add Player
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

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

                                {/* Admin Actions: Edit & Delete */}
                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                  {editingPlayer?.playerProfileId === player.playerProfileId ? (
                                    <div className="flex flex-col gap-3 w-full">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[8px] text-slate-500 uppercase">Name</label>
                                          <input
                                            type="text"
                                            value={editingPlayer.name}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[8px] text-slate-500 uppercase">Price</label>
                                          <input
                                            type="number"
                                            value={editingPlayer.price}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, price: parseFloat(e.target.value) })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[8px] text-slate-500 uppercase">Role</label>
                                          <select
                                            value={editingPlayer.playerRole}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, playerRole: e.target.value })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          >
                                            <option value="MEMBER">MEMBER</option>
                                            <option value="CAPTAIN">CAPTAIN</option>
                                            <option value="VICECAPTAIN">VICECAPTAIN</option>
                                          </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[8px] text-slate-500 uppercase">Type</label>
                                          <select
                                            value={editingPlayer.playerSecondRole}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, playerSecondRole: e.target.value })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          >
                                            <option value="BATTER">BATTER</option>
                                            <option value="BOWLER">BOWLER</option>
                                            <option value="ALLROUNDER">ALLROUNDER</option>
                                            <option value="WICKETKEEPER">WICKETKEEPER</option>
                                          </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[8px] text-slate-500 uppercase">ESPN ID</label>
                                          <input
                                            type="text"
                                            value={editingPlayer.espnId || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, espnId: e.target.value })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2">
                                          <label className="text-[8px] text-slate-500 uppercase">Image URL</label>
                                          <input
                                            type="text"
                                            value={editingPlayer.imageUrl || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, imageUrl: e.target.value })}
                                            className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setEditingPlayer(null)}
                                          className="flex-1 py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold transition-all border border-white/10"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => updateSinglePlayerInTeam(editingPlayer)}
                                          className="flex-1 py-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all border border-emerald-500/20 shadow-emerald-500/10"
                                        >
                                          Save Changes
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => setEditingPlayer({
                                            matchId: selectedMatchDetails.id,
                                            realTeamId: team.realTeamId,
                                            playerProfileId: player.playerProfileId,
                                            name: player.name,
                                            playerRole: player.playerRole,
                                            playerSecondRole: player.playerSecondRole,
                                            price: player.price,
                                            espnId: player.espnId,
                                            imageUrl: player.imageUrl
                                          })}
                                          className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded border border-blue-500/20 transition-all flex items-center gap-1"
                                        >
                                          <span>Edit Player</span>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMatchTeamPlayer(selectedMatchDetails.id, team.realTeamId, player.playerProfileId)}
                                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-bold rounded border border-red-500/20 transition-all flex items-center gap-1"
                                        >
                                          <span>Remove</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Player Scorecards */}
                                <div className="mt-3 pt-3 border-t border-white/5">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Scorecard</h4>
                                    {isOwner && (
                                      <button
                                        onClick={() => {
                                          const currentInnings = player.scoreCard ? Object.keys(player.scoreCard).length : 0;
                                          const nextInning = currentInnings + 1;
                                          setEditingPlayerScore({ playerProfileId: player.playerProfileId, inning: nextInning });
                                          setPendingPlayerScoreItems({ [`${player.playerProfileId}#${nextInning}`]: {} });
                                        }}
                                        className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                      >
                                        + Inning
                                      </button>
                                    )}
                                  </div>
                                  {player.scoreCard && Object.values(player.scoreCard).map((inning) => (
                                    <div key={inning.inning} className="mb-4 bg-white/5 border border-white/5 rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                                        <p className="text-[10px] text-slate-500 font-semibold">Inning {inning.inning}</p>
                                        <div className="flex gap-2">
                                          {editingPlayerScore?.playerProfileId === player.playerProfileId && editingPlayerScore?.inning === inning.inning ? (
                                            <>
                                              <button
                                                onClick={() => setEditingPlayerScore(null)}
                                                className="text-[9px] font-bold text-slate-500 hover:text-slate-400"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                onClick={() => handleUpdatePlayerScore(player.playerProfileId, team.realTeamId, inning.inning)}
                                                className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300"
                                              >
                                                Save
                                              </button>
                                            </>
                                          ) : isOwner ? (
                                            <button
                                              onClick={() => {
                                                setEditingPlayerScore({ playerProfileId: player.playerProfileId, inning: inning.inning });
                                                const items: Record<string, string | number> = {};
                                                Object.values(inning.items).forEach(it => {
                                                  items[it.scoreCardItemType] = it.value;
                                                });
                                                setPendingPlayerScoreItems({ [`${player.playerProfileId}#${inning.inning}`]: items });
                                              }}
                                              className="text-[9px] font-bold text-blue-400 hover:text-blue-300"
                                            >
                                              Edit
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                      
                                      {editingPlayerScore?.playerProfileId === player.playerProfileId && editingPlayerScore?.inning === inning.inning ? (
                                        <div className="flex flex-col gap-2">
                                          <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(pendingPlayerScoreItems[`${player.playerProfileId}#${inning.inning}`] || {}).map(([type, value]) => (
                                              <div key={type} className="flex flex-col gap-1">
                                                <label className="text-[8px] text-slate-500 uppercase">{type.replace(/_/g, ' ')}</label>
                                                <input
                                                  type={typeof value === 'number' ? 'number' : 'text'}
                                                  defaultValue={value}
                                                  onChange={(e) => {
                                                    const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                                                    setPendingPlayerScoreItems(prev => ({
                                                      ...prev,
                                                      [`${player.playerProfileId}#${inning.inning}`]: {
                                                        ...prev[`${player.playerProfileId}#${inning.inning}`],
                                                        [type]: val
                                                      }
                                                    }));
                                                  }}
                                                  className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] focus:outline-none"
                                                />
                                              </div>
                                            ))}
                                          </div>
                                          <div className="mt-2 pt-2 border-t border-white/5">
                                            <select
                                              onChange={(e) => {
                                                if (!e.target.value) return;
                                                const type = e.target.value;
                                                setPendingPlayerScoreItems(prev => ({
                                                  ...prev,
                                                  [`${player.playerProfileId}#${inning.inning}`]: {
                                                    ...prev[`${player.playerProfileId}#${inning.inning}`],
                                                    [type]: 0
                                                  }
                                                }));
                                                e.target.value = "";
                                              }}
                                              className="w-full bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] focus:outline-none text-slate-400"
                                            >
                                              <option value="">+ Add Metric</option>
                                              <option value="RUNS">RUNS</option>
                                              <option value="FOURS">FOURS</option>
                                              <option value="SIXES">SIXES</option>
                                              <option value="BALLS_FACED">BALLS_FACED</option>
                                              <option value="WICKETS">WICKETS</option>
                                              <option value="OVERS_BOWLED">OVERS_BOWLED</option>
                                              <option value="MAIDEN_OVERS">MAIDEN_OVERS</option>
                                              <option value="RUNS_CONCEDED">RUNS_CONCEDED</option>
                                              <option value="CATCHES">CATCHES</option>
                                              <option value="STUMPINGS">STUMPINGS</option>
                                              <option value="RUN_OUTS">RUN_OUTS</option>
                                              <option value="WIDES">WIDES</option>
                                              <option value="NO_BALLS">NO_BALLS</option>
                                              <option value="IS_MAN_OF_THE_MATCH">MAN OF MATCH (1/0)</option>
                                              <option value="IMPACT_PLAYER">IMPACT PLAYER (1/0)</option>
                                            </select>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {Object.values(inning.items).map((item, idx) => (
                                            <div
                                              key={idx}
                                              className="bg-black/20 border border-white/5 rounded px-1.5 py-0.5 text-[9px] flex items-center gap-1"
                                            >
                                              <span className="text-slate-500">{item.scoreCardItemType}:</span>
                                              <span className="text-white font-mono">{item.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  
                                  {/* Add new inning for player */}
                                  {editingPlayerScore?.playerProfileId === player.playerProfileId && !player.scoreCard?.[editingPlayerScore.inning] && (
                                    <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] text-emerald-400 font-semibold uppercase">New Inning {editingPlayerScore.inning}</p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => setEditingPlayerScore(null)}
                                            className="text-[9px] font-bold text-slate-500 hover:text-slate-400"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleUpdatePlayerScore(player.playerProfileId, team.realTeamId, editingPlayerScore.inning)}
                                            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300"
                                          >
                                            Create
                                          </button>
                                        </div>
                                      </div>
                                      <select
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          const type = e.target.value;
                                          setPendingPlayerScoreItems(prev => ({
                                            ...prev,
                                            [`${player.playerProfileId}#${editingPlayerScore.inning}`]: {
                                              ...prev[`${player.playerProfileId}#${editingPlayerScore.inning}`],
                                              [type]: 0
                                            }
                                          }));
                                        }}
                                        className="w-full bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] focus:outline-none text-slate-400"
                                      >
                                        <option value="">Select First Metric</option>
                                        <option value="RUNS">RUNS</option>
                                        <option value="WICKETS">WICKETS</option>
                                        <option value="BALLS_FACED">BALLS_FACED</option>
                                      </select>
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        {Object.entries(pendingPlayerScoreItems[`${player.playerProfileId}#${editingPlayerScore.inning}`] || {}).map(([type, value]) => (
                                          <div key={type} className="flex flex-col gap-1">
                                            <label className="text-[8px] text-slate-500 uppercase">{type}</label>
                                            <input
                                              type="number"
                                              placeholder="0"
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setPendingPlayerScoreItems(prev => ({
                                                  ...prev,
                                                  [`${player.playerProfileId}#${editingPlayerScore.inning}`]: {
                                                    ...prev[`${player.playerProfileId}#${editingPlayerScore.inning}`],
                                                    [type]: val
                                                  }
                                                }));
                                              }}
                                              className="bg-black/20 border border-white/10 rounded px-1.5 py-1 text-[10px] focus:outline-none"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContest(contest.id);
                              }}
                              className="p-1 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 text-[10px] border border-red-500/20 hover:border-red-500/40 transition-all flex items-center gap-1 font-semibold"
                              title="Delete Contest"
                            >
                              <span>Delete</span>
                            </button>
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
