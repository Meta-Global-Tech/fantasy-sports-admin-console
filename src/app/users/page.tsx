"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api";
import {
  AdminUserSummary,
  AdminUserDetails,
  NotificationDeviceInfo,
  NotificationPlatform,
  ReminderOffsetToggles,
  Transaction,
} from "@/types";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 25;
const TX_PAGE_SIZE = 10;

function formatEpoch(epoch: number) {
  if (!epoch) return "—";
  return new Date(epoch).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MATCH_REMINDER_OFFSETS: (keyof ReminderOffsetToggles)[] = [
  "24h",
  "12h",
  "6h",
  "3h",
  "1h",
  "30m",
];

const PLATFORM_STYLES: Record<NotificationPlatform, string> = {
  ios: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  android: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  web: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function PlatformBadge({ device }: { device: NotificationDeviceInfo }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${PLATFORM_STYLES[device.platform] ?? "bg-white/5 text-slate-400 border-white/10"}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {device.platform}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "USER") {
    return (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
        USER
      </span>
    );
  }
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
      {role}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
        isActive ? "bg-emerald-400 text-black" : "bg-slate-700 text-slate-300"
      }`}
    >
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PROCESSED: "bg-emerald-400 text-black",
    SUBMITTED: "bg-cyan-400 text-black",
    FAILED: "bg-rose-500 text-white",
  };
  return (
    <span
      className={`text-[9px] font-black px-2 py-0.5 rounded-md ${styles[status] || "bg-slate-700 text-slate-300"}`}
    >
      {status}
    </span>
  );
}

function ReadOnlyToggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${
        on ? "bg-emerald-400 border-emerald-400" : "bg-white/5 border-white/10"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full ${
          on ? "translate-x-[18px] bg-black" : "translate-x-0.5 bg-slate-400"
        }`}
      />
    </span>
  );
}

function ReadOnlyChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-xl border ${
        on
          ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-400"
          : "bg-white/[0.03] border-white/10 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function PrefRow({
  label,
  on,
  children,
}: {
  label: string;
  on: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-6">
        <p className="text-xs text-slate-300 font-semibold">{label}</p>
        <ReadOnlyToggle on={on} />
      </div>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </p>
      <p
        className={`${
          value ? "text-slate-200" : "text-slate-600"
        } ${mono ? "text-xs font-mono break-all" : "text-sm"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Detail panel state
  const [detailUser, setDetailUser] = useState<AdminUserSummary | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Wallet transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txNextCursor, setTxNextCursor] = useState<string | number | null>(
    null,
  );
  const [txHasMore, setTxHasMore] = useState(false);

  const fetchUsers = useCallback(
    async (searchTerm: string, cursor?: string, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const data = await adminApi.getUsers({
          pageSize: PAGE_SIZE,
          cursor,
          search: searchTerm || undefined,
        });

        setUsers((prev) => (isLoadMore ? [...prev, ...data.items] : data.items));
        setNextCursor(
          data.nextCursor != null ? String(data.nextCursor) : null,
        );
        setHasMore(data.hasMore);
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to load users. Try again.",
        );
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchUsers(search);
  }, [search, fetchUsers]);

  const fetchTransactions = useCallback(
    async (walletId: string, cursor?: string | number, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setTxLoadingMore(true);
        } else {
          setTxLoading(true);
          setTxError(null);
        }

        const data = await adminApi.getWalletTransactions(walletId, {
          pageSize: TX_PAGE_SIZE,
          cursor,
        });

        const items = data.transactions?.items || [];
        setTransactions((prev) => (isLoadMore ? [...prev, ...items] : items));
        setTxNextCursor(data.transactions?.nextCursor ?? null);
        setTxHasMore(data.transactions?.hasMore ?? false);
      } catch (err: any) {
        setTxError(
          err.response?.data?.message ||
            "Failed to load wallet transactions. Try again.",
        );
        console.error(err);
      } finally {
        setTxLoading(false);
        setTxLoadingMore(false);
      }
    },
    [],
  );

  const fetchDetails = useCallback(
    async (userId: string) => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const data = await adminApi.getUserDetails(userId);
        setDetails(data);
        if (data.wallet) {
          fetchTransactions(data.wallet.id);
        }
      } catch (err: any) {
        setDetailError(
          err.response?.data?.message ||
            "Failed to load user details. Try again.",
        );
        console.error(err);
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchTransactions],
  );

  const openDetail = (user: AdminUserSummary) => {
    setDetailUser(user);
    setDetails(null);
    setDetailError(null);
    setTransactions([]);
    setTxNextCursor(null);
    setTxHasMore(false);
    setTxError(null);
    fetchDetails(user.id);
  };

  const closeDetail = () => {
    setDetailUser(null);
    setDetails(null);
    setDetailError(null);
    setTransactions([]);
    setTxNextCursor(null);
    setTxHasMore(false);
    setTxError(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const preferences = details?.notificationPreferences;

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-full">
      {/* Header */}
      <div className="relative mb-10 p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg
                className="w-5 h-5 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Users
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed mb-8">
            Browse all registered users on the platform. Select a user to view
            their full profile, wallet, practice-contest usage, notification
            preferences and devices.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none group-focus-within:text-emerald-400 text-slate-500 transition-colors pl-4">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-slate-600 text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                "Search"
              )}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="mb-10 p-5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
          <p className="font-semibold text-red-300">Error Encountered</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
        <div className="px-10 py-7 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Registered Users
            </h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">
              Platform accounts
            </p>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-[11px] text-slate-300 font-bold font-mono">
              {users.length} USERS LOADED
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0f0f18] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pl-10 pr-6 py-5">Name</th>
                <th className="px-6 py-5">Email</th>
                <th className="px-6 py-5">Role</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Joined</th>
                <th className="pl-6 pr-10 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="w-8 h-8 mx-auto border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <p className="text-slate-500 font-medium italic">
                      No users found
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openDetail(user)}
                    className="hover:bg-white/[0.02] transition-colors group/row cursor-pointer"
                  >
                    <td className="pl-10 pr-6 py-5">
                      <p className="text-sm text-slate-200 font-semibold">
                        {user.name}
                      </p>
                      <p className="text-[9px] text-slate-700 font-mono mt-1 group-hover/row:text-slate-500 transition-colors">
                        #{user.id}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </td>
                    <td className="px-6 py-5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-5">
                      <ActiveBadge isActive={user.isActive} />
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400">
                        {formatEpoch(user.createdAt)}
                      </p>
                    </td>
                    <td className="pl-6 pr-10 py-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(user);
                        }}
                        className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 active:scale-95"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <div className="p-10 border-t border-white/5 flex justify-center bg-white/[0.01]">
            <button
              onClick={() =>
                nextCursor && fetchUsers(search, nextCursor, true)
              }
              disabled={loadingMore}
              className="px-10 py-3.5 bg-white/[0.03] hover:bg-emerald-400 hover:text-black text-slate-300 text-xs font-black rounded-2xl border border-white/10 transition-all duration-300 disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest"
            >
              {loadingMore ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-2xl h-full bg-[#0d0d14] border-l border-white/10 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 z-10 px-8 py-6 bg-[#0d0d14]/95 backdrop-blur border-b border-white/5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {detailUser.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {detailUser.email}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <ActiveBadge isActive={detailUser.isActive} />
                  <RoleBadge role={detailUser.role} />
                  <span className="text-[9px] text-slate-700 font-mono">
                    #{detailUser.id}
                  </span>
                </div>
              </div>
              <button
                onClick={closeDetail}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {detailLoading ? (
                <div className="py-24 text-center">
                  <div className="w-8 h-8 mx-auto border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
              ) : detailError ? (
                <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                  <p className="font-semibold text-red-300">
                    Error Encountered
                  </p>
                  <p className="mt-1 opacity-90">{detailError}</p>
                </div>
              ) : details ? (
                <>
                  {/* Profile */}
                  <Section title="Profile">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <Field label="Name" value={details.name} />
                      <Field label="Email" value={details.email} />
                      <Field label="Role" value={details.role} />
                      <Field
                        label="Status"
                        value={details.isActive ? "Active" : "Inactive"}
                      />
                      <Field
                        label="Created"
                        value={formatEpoch(details.createdAt)}
                      />
                      <Field
                        label="Modified"
                        value={formatEpoch(details.modifiedAt)}
                      />
                      <Field
                        label="Referral Code"
                        value={details.refered_code}
                        mono
                      />
                      <Field
                        label="Referred By"
                        value={details.refered_user}
                        mono
                      />
                      <Field
                        label="Stripe Customer ID"
                        value={details.stripeCustomerId}
                        mono
                      />
                      <Field
                        label="Wise Withdrawal Email"
                        value={details.wiseEmail}
                      />
                      <Field
                        label="Binance Withdrawal Email"
                        value={details.binanceEmail}
                      />
                    </div>
                  </Section>

                  {/* Wallet */}
                  <Section title="Wallet">
                    {details.wallet ? (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-extrabold text-white">
                            {details.wallet.balance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                            {details.wallet.currency}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-2 break-all">
                          {details.wallet.id}
                        </p>
                        {details.wallet.description && (
                          <p className="text-xs text-slate-500 mt-1">
                            {details.wallet.description}
                          </p>
                        )}

                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-6 mb-3">
                          Recent Transactions
                        </p>

                        {txError && (
                          <div className="mb-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs">
                            {txError}
                          </div>
                        )}

                        {txLoading ? (
                          <div className="py-10 text-center">
                            <div className="w-6 h-6 mx-auto border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                          </div>
                        ) : transactions.length === 0 ? (
                          !txError && (
                            <p className="text-xs text-slate-600 italic">
                              No transactions found
                            </p>
                          )
                        ) : (
                          <div className="divide-y divide-white/5">
                            {transactions.map((tx) => {
                              const isIncoming =
                                tx.toWalletId === details.wallet?.id;
                              return (
                                <div
                                  key={tx.id}
                                  className="py-3.5 flex items-center justify-between gap-4"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <TransactionStatusBadge
                                        status={tx.status}
                                      />
                                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 tracking-wider">
                                        {tx.type || "TRANSFER"}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5 truncate">
                                      {isIncoming
                                        ? tx.toDescription
                                        : tx.fromDescription}
                                    </p>
                                    <p className="text-[10px] text-slate-600 mt-0.5">
                                      {formatDate(tx.createdAt)}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-sm font-black tracking-tight shrink-0 ${
                                      isIncoming
                                        ? "text-emerald-400"
                                        : "text-rose-400"
                                    }`}
                                  >
                                    {isIncoming ? "+" : "-"}
                                    {(tx.amount ?? 0).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {txHasMore && !txLoading && (
                          <div className="mt-4 flex justify-center">
                            <button
                              onClick={() =>
                                txNextCursor != null &&
                                details.wallet &&
                                fetchTransactions(
                                  details.wallet.id,
                                  txNextCursor,
                                  true,
                                )
                              }
                              disabled={txLoadingMore}
                              className="px-6 py-2.5 bg-white/[0.03] hover:bg-emerald-400 hover:text-black text-slate-300 text-[10px] font-black rounded-2xl border border-white/10 transition-all duration-300 disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
                            >
                              {txLoadingMore ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                  Loading...
                                </>
                              ) : (
                                "Load More"
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-600 italic">
                        No wallet associated with this user
                      </p>
                    )}
                  </Section>

                  {/* Practice contests */}
                  <Section title="Practice Contests">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">
                        {details.practiceContestsPlayed}
                      </span>
                      <span className="text-sm text-slate-500 font-semibold">
                        of {details.practiceContestLimit} played
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500"
                        style={{
                          width: `${
                            details.practiceContestLimit > 0
                              ? Math.min(
                                  (details.practiceContestsPlayed /
                                    details.practiceContestLimit) *
                                    100,
                                  100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </Section>

                  {/* Notification preferences */}
                  {preferences && (
                    <Section title="Notification Preferences">
                      <div className="divide-y divide-white/5">
                        <PrefRow
                          label="Upcoming match reminders"
                          on={preferences.matchReminders}
                        >
                          <div
                            className={`mt-3 flex flex-wrap gap-1.5 ${
                              preferences.matchReminders ? "" : "opacity-40"
                            }`}
                          >
                            {MATCH_REMINDER_OFFSETS.map((offset) => (
                              <ReadOnlyChip
                                key={offset}
                                label={`${offset} before`}
                                on={preferences.matchReminderOffsets[offset]}
                              />
                            ))}
                          </div>
                        </PrefRow>
                        <PrefRow
                          label="My-match reminders"
                          on={preferences.myMatchReminders}
                        />
                        <PrefRow
                          label="Lineup announced"
                          on={preferences.lineupAnnounced}
                        />
                        <PrefRow
                          label="Withdrawal processed"
                          on={preferences.withdrawalProcessed}
                        />
                        <PrefRow
                          label="Contest winnings"
                          on={preferences.contestWinnings}
                        />
                      </div>
                    </Section>
                  )}

                  {/* Devices */}
                  <Section title="Notification Devices">
                    {details.devices.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">
                        No devices registered
                      </p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {details.devices.map((device, i) => (
                          <div
                            key={i}
                            className="py-3.5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <PlatformBadge device={device} />
                              <span className="text-[10px] text-slate-500 font-mono truncate">
                                {device.tokenPreview}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {formatEpoch(device.updatedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
