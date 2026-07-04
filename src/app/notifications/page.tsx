"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api";
import {
  UserWithNotificationDevices,
  NotificationDeviceInfo,
  NotificationPlatform,
  SendNotificationResult,
} from "@/types";

const PAGE_SIZE = 25;

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

const PLATFORM_STYLES: Record<NotificationPlatform, string> = {
  ios: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  android: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  web: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function PlatformBadge({ device }: { device: NotificationDeviceInfo }) {
  return (
    <span
      title={`${device.tokenPreview} — registered ${formatEpoch(device.updatedAt)}`}
      className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${PLATFORM_STYLES[device.platform] ?? "bg-white/5 text-slate-400 border-white/10"}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {device.platform}
    </span>
  );
}

export default function NotificationsPage() {
  const [users, setUsers] = useState<UserWithNotificationDevices[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [onlyWithDevices, setOnlyWithDevices] = useState(false);

  // Send-test modal state
  const [selectedUser, setSelectedUser] =
    useState<UserWithNotificationDevices | null>(null);
  const [title, setTitle] = useState("ProCrick test notification");
  const [body, setBody] = useState(
    "If you can read this, push notifications work 🎉",
  );
  const [screen, setScreen] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendNotificationResult | null>(
    null,
  );
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (searchTerm: string, cursor?: string, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const data = await adminApi.getUsersWithNotificationDevices({
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const openSendModal = (user: UserWithNotificationDevices) => {
    setSelectedUser(user);
    setSendResult(null);
    setSendError(null);
  };

  const closeSendModal = () => {
    if (sending) return;
    setSelectedUser(null);
    setSendResult(null);
    setSendError(null);
  };

  const handleSendTest = async () => {
    if (!selectedUser) return;
    try {
      setSending(true);
      setSendError(null);
      setSendResult(null);
      const result = await adminApi.sendTestNotification({
        userId: selectedUser.id,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        data: screen.trim() ? { screen: screen.trim() } : undefined,
      });
      setSendResult(result);
    } catch (err: any) {
      setSendError(
        err.response?.data?.message || "Failed to send the test notification.",
      );
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const visibleUsers = onlyWithDevices
    ? users.filter((u) => u.devices.length > 0)
    : users;

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
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Push Notifications
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed mb-8">
            All registered app users and the devices they have enabled push
            notifications on. Select a user to send them a test notification.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl mb-4">
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

          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithDevices}
              onChange={(e) => setOnlyWithDevices(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <span className="text-xs text-slate-400">
              Only show users with notification-enabled devices
            </span>
          </label>
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
              Push-enrollment overview
            </p>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-[11px] text-slate-300 font-bold font-mono">
              {visibleUsers.length} USERS LOADED
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0f0f18] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pl-10 pr-6 py-5">User</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Notification Devices</th>
                <th className="px-6 py-5">Joined</th>
                <th className="pl-6 pr-10 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="w-8 h-8 mx-auto border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <p className="text-slate-500 font-medium italic">
                      No users found
                    </p>
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-white/[0.02] transition-colors group/row"
                  >
                    <td className="pl-10 pr-6 py-5">
                      <p className="text-sm text-slate-200 font-semibold">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {user.email}
                      </p>
                      <p className="text-[9px] text-slate-700 font-mono mt-1 group-hover/row:text-slate-500 transition-colors">
                        #{user.id}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          user.isActive
                            ? "bg-emerald-400 text-black"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {user.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                      {user.role !== "USER" && (
                        <span className="ml-2 text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {user.devices.length === 0 ? (
                        <span className="text-[11px] text-slate-600 italic">
                          No devices registered
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {user.devices.map((device, i) => (
                            <PlatformBadge key={i} device={device} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400">
                        {formatEpoch(user.createdAt)}
                      </p>
                    </td>
                    <td className="pl-6 pr-10 py-5 text-right">
                      <button
                        onClick={() => openSendModal(user)}
                        disabled={user.devices.length === 0}
                        className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                      >
                        Send Test
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

      {/* Send-test modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={closeSendModal}
        >
          <div
            className="w-full max-w-lg bg-[#0d0d14] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Send Test Notification
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  To <span className="text-slate-300">{selectedUser.name}</span>{" "}
                  ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={closeSendModal}
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

            <div className="mb-5 flex flex-wrap gap-1.5">
              {selectedUser.devices.map((device, i) => (
                <PlatformBadge key={i} device={device} />
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Deep-link screen{" "}
                  <span className="text-slate-700 normal-case font-medium">
                    (optional, e.g. /matches/123)
                  </span>
                </label>
                <input
                  type="text"
                  value={screen}
                  onChange={(e) => setScreen(e.target.value)}
                  placeholder="/"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
              </div>
            </div>

            {sendResult && (
              <div
                className={`mt-6 p-4 rounded-2xl border text-sm ${
                  sendResult.delivered > 0
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/5 border-amber-500/20 text-amber-400"
                }`}
              >
                <p className="font-semibold">
                  Delivered to {sendResult.delivered} of {sendResult.attempted}{" "}
                  device{sendResult.attempted === 1 ? "" : "s"}
                </p>
                {sendResult.failures.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs opacity-90">
                    {sendResult.failures.map((failure, i) => (
                      <li key={i}>
                        <span className="font-bold uppercase">
                          {failure.platform}
                        </span>
                        : {failure.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {sendError && (
              <div className="mt-6 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                {sendError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={closeSendModal}
                disabled={sending}
                className="px-6 py-3 text-xs font-bold rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleSendTest}
                disabled={sending}
                className="px-8 py-3 bg-white text-black text-xs font-black rounded-2xl hover:bg-emerald-400 transition-all duration-300 disabled:opacity-30 flex items-center gap-2 active:scale-95 uppercase tracking-widest"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  "Send Notification"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
