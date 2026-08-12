"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { seriesAdminApi } from "@/lib/api";
import { AdminSeries, SeriesImportStatus } from "@/types";

function formatEpoch(epoch?: number) {
  if (!epoch) return "—";
  return new Date(epoch).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<SeriesImportStatus, string> = {
  queued: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  running: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  completed: "bg-emerald-400 text-black",
  failed: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function StatusBadge({ status }: { status?: SeriesImportStatus }) {
  if (!status) {
    return (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
        NEVER RUN
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 ${STATUS_STYLES[status]}`}
    >
      {(status === "queued" || status === "running") && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status.toUpperCase()}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all duration-300 ${
        checked
          ? "bg-emerald-400 border-emerald-400"
          : "bg-white/5 border-white/10"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-transform duration-300 ${
          checked ? "translate-x-[22px] bg-black" : "translate-x-1 bg-slate-400"
        }`}
      />
    </button>
  );
}

interface SeriesFormState {
  seriesName: string;
  scheduleUrl: string;
  enabled: boolean;
}

const EMPTY_FORM: SeriesFormState = {
  seriesName: "",
  scheduleUrl: "",
  enabled: true,
};

const POLL_INTERVAL_MS = 10_000;

export default function ManageSeriesPage() {
  const [seriesList, setSeriesList] = useState<AdminSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state — modalOpen with editingSeries null means "create"
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<AdminSeries | null>(null);
  const [form, setForm] = useState<SeriesFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [busyName, setBusyName] = useState<string | null>(null);

  const fetchSeries = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const data = await seriesAdminApi.list();
      setSeriesList(data);
    } catch (err: any) {
      if (!silent) {
        setError(
          err.response?.data?.message || "Failed to load series. Try again.",
        );
      }
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  // Poll silently while any import is queued or running so status/stats
  // update without a manual refresh.
  const hasActiveImport = seriesList.some(
    (s) => s.importStatus === "queued" || s.importStatus === "running",
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!hasActiveImport) return;
    pollRef.current = setInterval(() => fetchSeries(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActiveImport, fetchSeries]);

  const openCreateModal = () => {
    setEditingSeries(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEditModal = (series: AdminSeries) => {
    setEditingSeries(series);
    setForm({
      seriesName: series.seriesName,
      scheduleUrl: series.scheduleUrl,
      enabled: series.enabled,
    });
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingSeries(null);
    setSaveError(null);
  };

  const updateForm = <K extends keyof SeriesFormState>(
    key: K,
    value: SeriesFormState[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveError(null);
  };

  const handleSave = async () => {
    const seriesName = form.seriesName.trim();
    const scheduleUrl = form.scheduleUrl.trim();
    if (!seriesName || !scheduleUrl) {
      setSaveError("Series name and schedule URL are required.");
      return;
    }
    if (!scheduleUrl.startsWith("http")) {
      setSaveError("Schedule URL must be a valid URL.");
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      if (editingSeries) {
        await seriesAdminApi.update({
          seriesName: editingSeries.seriesName,
          newSeriesName:
            seriesName !== editingSeries.seriesName ? seriesName : undefined,
          scheduleUrl,
          enabled: form.enabled,
        });
      } else {
        await seriesAdminApi.create({
          seriesName,
          scheduleUrl,
          enabled: form.enabled,
        });
      }
      setModalOpen(false);
      setEditingSeries(null);
      await fetchSeries();
    } catch (err: any) {
      setSaveError(
        err.response?.data?.message || "Failed to save the series. Try again.",
      );
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (series: AdminSeries) => {
    try {
      setBusyName(series.seriesName);
      setError(null);
      await seriesAdminApi.update({
        seriesName: series.seriesName,
        enabled: !series.enabled,
      });
      await fetchSeries(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to update the series. Try again.",
      );
      console.error(err);
    } finally {
      setBusyName(null);
    }
  };

  const handleImport = async (series: AdminSeries) => {
    try {
      setBusyName(series.seriesName);
      setError(null);
      await seriesAdminApi.triggerImport(series.seriesName);
      await fetchSeries(true);
    } catch (err: any) {
      if (
        err.response?.status === 409 &&
        window.confirm(
          `An import for "${series.seriesName}" already appears queued or running. Queue it again anyway?`,
        )
      ) {
        try {
          await seriesAdminApi.triggerImport(series.seriesName, true);
          await fetchSeries(true);
        } catch (forceErr: any) {
          setError(
            forceErr.response?.data?.message ||
              "Failed to queue the import. Try again.",
          );
          console.error(forceErr);
        }
      } else if (err.response?.status !== 409) {
        setError(
          err.response?.data?.message ||
            "Failed to queue the import. Try again.",
        );
        console.error(err);
      }
    } finally {
      setBusyName(null);
    }
  };

  const handleDelete = async (series: AdminSeries) => {
    if (
      !window.confirm(
        `Delete the series "${series.seriesName}"? Its matches are kept, but it will no longer be imported. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      setBusyName(series.seriesName);
      setError(null);
      await seriesAdminApi.remove(series.seriesName);
      await fetchSeries();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to delete the series. Try again.",
      );
      console.error(err);
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-full">
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
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Manage Series
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed mb-8">
            Series whose matches are imported from ESPN. Enabled series are
            imported automatically every hour — each in its own worker — or run
            one on demand and watch its status here.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="px-8 py-3 bg-white text-black text-xs font-black rounded-2xl hover:bg-emerald-400 transition-all duration-300 flex items-center gap-2 active:scale-95 uppercase tracking-widest"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              New Series
            </button>
            <button
              onClick={() => fetchSeries()}
              disabled={loading}
              className="px-6 py-3 text-xs font-bold rounded-2xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/10 transition-all duration-300 active:scale-95 uppercase tracking-widest disabled:opacity-30"
            >
              Refresh
            </button>
          </div>
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
              All Series
            </h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">
              ESPN import sources
            </p>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasActiveImport ? "bg-amber-400 animate-pulse" : "bg-cyan-400"
              }`}
            ></span>
            <span className="text-[11px] text-slate-300 font-bold font-mono">
              {seriesList.length} SERIES
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0f0f18] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pl-10 pr-6 py-5">Series</th>
                <th className="px-6 py-5">Enabled</th>
                <th className="px-6 py-5">Last Import</th>
                <th className="px-6 py-5">Stats</th>
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
              ) : seriesList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <p className="text-slate-500 font-medium italic">
                      No series yet
                    </p>
                    <button
                      onClick={openCreateModal}
                      className="mt-4 px-6 py-2.5 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 active:scale-95"
                    >
                      Add your first series
                    </button>
                  </td>
                </tr>
              ) : (
                seriesList.map((series) => (
                  <tr
                    key={series.seriesName}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="pl-10 pr-6 py-5 max-w-sm">
                      <p className="text-sm text-slate-200 font-semibold">
                        {series.seriesName}
                      </p>
                      <a
                        href={series.scheduleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-500 font-mono truncate block mt-0.5 hover:text-cyan-400 transition-colors max-w-[320px]"
                        title={series.scheduleUrl}
                      >
                        {series.scheduleUrl.replace(
                          "https://www.espncricinfo.com",
                          "…",
                        )}
                      </a>
                    </td>
                    <td className="px-6 py-5">
                      <Toggle
                        checked={series.enabled}
                        disabled={busyName === series.seriesName}
                        onChange={() => handleToggleEnabled(series)}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={series.importStatus} />
                      <p className="text-xs text-slate-500 whitespace-nowrap mt-1.5">
                        {series.importStatus === "queued"
                          ? formatEpoch(series.importQueuedAt)
                          : series.importStatus === "running"
                            ? formatEpoch(series.importStartedAt)
                            : formatEpoch(series.importCompletedAt)}
                      </p>
                      {series.importStatus === "failed" &&
                        series.importError && (
                          <p
                            className="text-[11px] text-red-400/80 mt-1 max-w-[220px] truncate"
                            title={series.importError}
                          >
                            {series.importError}
                          </p>
                        )}
                    </td>
                    <td className="px-6 py-5">
                      {series.importStats ? (
                        <div className="text-xs text-slate-400 whitespace-nowrap space-y-0.5">
                          <p>
                            <span className="text-slate-200 font-semibold">
                              {series.importStats.matchesCreated}
                            </span>{" "}
                            created of{" "}
                            <span className="font-mono">
                              {series.importStats.totalMatches}
                            </span>{" "}
                            found
                          </p>
                          <p className="text-slate-600">
                            {series.importStats.matchesSkipped} skipped ·{" "}
                            <span
                              className={
                                series.importStats.matchesFailed > 0
                                  ? "text-red-400/80"
                                  : ""
                              }
                            >
                              {series.importStats.matchesFailed} failed
                            </span>
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">
                          —
                        </span>
                      )}
                    </td>
                    <td className="pl-6 pr-10 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleImport(series)}
                          disabled={busyName === series.seriesName}
                          className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-cyan-400/90 hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                        >
                          Import Now
                        </button>
                        <button
                          onClick={() => openEditModal(series)}
                          className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 active:scale-95"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(series)}
                          disabled={busyName === series.seriesName}
                          className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-red-400/80 hover:bg-red-500 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 overflow-y-auto"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg bg-[#0d0d14] border border-white/10 rounded-[32px] p-8 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {editingSeries ? "Edit Series" : "New Series"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {editingSeries
                    ? "Update this ESPN import source"
                    : "Matches are imported from the ESPN schedule page"}
                </p>
              </div>
              <button
                onClick={closeModal}
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

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Series Name
                </label>
                <input
                  type="text"
                  value={form.seriesName}
                  onChange={(e) => updateForm("seriesName", e.target.value)}
                  placeholder="Hong Kong Women's Premier League T20 2025/26"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
                <p className="mt-1.5 text-[10px] text-slate-600">
                  Shown on matches and leaderboards exactly as entered
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Schedule URL
                </label>
                <input
                  type="text"
                  value={form.scheduleUrl}
                  onChange={(e) => updateForm("scheduleUrl", e.target.value)}
                  placeholder="https://www.espncricinfo.com/series/…/match-schedule-fixtures-and-results"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
                <p className="mt-1.5 text-[10px] text-slate-600">
                  ESPN Cricinfo &quot;match schedule fixtures and results&quot;
                  page for the series
                </p>
              </div>
              <div className="flex items-center justify-between gap-6 py-1">
                <div>
                  <p className="text-sm text-slate-200 font-semibold">
                    Enabled
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Included in the automatic hourly import
                  </p>
                </div>
                <Toggle
                  checked={form.enabled}
                  onChange={(checked) => updateForm("enabled", checked)}
                />
              </div>
            </div>

            {saveError && (
              <div className="mt-6 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                {saveError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-6 py-3 text-xs font-bold rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-white text-black text-xs font-black rounded-2xl hover:bg-emerald-400 transition-all duration-300 disabled:opacity-30 flex items-center gap-2 active:scale-95 uppercase tracking-widest"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : editingSeries ? (
                  "Save Changes"
                ) : (
                  "Add Series"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
