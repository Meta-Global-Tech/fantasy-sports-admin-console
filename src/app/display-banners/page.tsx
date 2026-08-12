"use client";

import { useState, useEffect, useCallback } from "react";
import { displayBannersApi } from "@/lib/api";
import { DisplayBanner, CreateDisplayBannerRequest } from "@/types";

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

/** Epoch ms → value for <input type="datetime-local"> (local time). */
function epochToLocalInput(epoch?: number): string {
  if (!epoch) return "";
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → epoch ms, or undefined when empty. */
function localInputToEpoch(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
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

interface BannerFormState {
  title: string;
  content: string;
  imageUrl: string;
  deeplink: string;
  urlExternal: boolean;
  buttonLabel: string;
  active: boolean;
  startsAt: string; // datetime-local value
  endsAt: string; // datetime-local value
  priority: string;
}

const EMPTY_FORM: BannerFormState = {
  title: "",
  content: "",
  imageUrl: "",
  deeplink: "",
  urlExternal: false,
  buttonLabel: "",
  active: true,
  startsAt: "",
  endsAt: "",
  priority: "",
};

function bannerToForm(banner: DisplayBanner): BannerFormState {
  return {
    title: banner.title,
    content: banner.content,
    imageUrl: banner.imageUrl ?? "",
    deeplink: banner.deeplink ?? "",
    urlExternal: banner.urlExternal ?? false,
    buttonLabel: banner.buttonLabel ?? "",
    active: banner.active,
    startsAt: epochToLocalInput(banner.startsAt),
    endsAt: epochToLocalInput(banner.endsAt),
    priority: banner.priority !== undefined ? String(banner.priority) : "",
  };
}

function formToRequest(form: BannerFormState): CreateDisplayBannerRequest {
  const priority = form.priority.trim();
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    imageUrl: form.imageUrl.trim() || undefined,
    deeplink: form.deeplink.trim() || undefined,
    urlExternal: form.urlExternal || undefined,
    buttonLabel: form.buttonLabel.trim() || undefined,
    active: form.active,
    startsAt: localInputToEpoch(form.startsAt),
    endsAt: localInputToEpoch(form.endsAt),
    priority: priority === "" ? undefined : Number(priority),
  };
}

export default function DisplayBannersPage() {
  const [banners, setBanners] = useState<DisplayBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state — modalOpen with editingBanner null means "create"
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<DisplayBanner | null>(
    null,
  );
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await displayBannersApi.list();
      setBanners(data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to load banners. Try again.",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const openCreateModal = () => {
    setEditingBanner(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEditModal = (banner: DisplayBanner) => {
    setEditingBanner(banner);
    setForm(bannerToForm(banner));
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingBanner(null);
    setSaveError(null);
  };

  const updateForm = <K extends keyof BannerFormState>(
    key: K,
    value: BannerFormState[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setSaveError("Title and content are required.");
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      const body = formToRequest(form);
      if (editingBanner) {
        await displayBannersApi.update(editingBanner.id, body);
      } else {
        await displayBannersApi.create(body);
      }
      setModalOpen(false);
      setEditingBanner(null);
      await fetchBanners();
    } catch (err: any) {
      setSaveError(
        err.response?.data?.message || "Failed to save the banner. Try again.",
      );
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (banner: DisplayBanner) => {
    if (
      !window.confirm(
        `Delete the banner "${banner.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      setDeletingId(banner.id);
      setError(null);
      await displayBannersApi.remove(banner.id);
      await fetchBanners();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to delete the banner. Try again.",
      );
      console.error(err);
    } finally {
      setDeletingId(null);
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
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Display Banners
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed mb-8">
            Announcements the mobile app shows on startup as a modal carousel.
            Active banners inside their display window are shown to every user.
          </p>

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
            New Banner
          </button>
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
              All Banners
            </h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">
              Startup carousel content
            </p>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-[11px] text-slate-300 font-bold font-mono">
              {banners.length} BANNER{banners.length === 1 ? "" : "S"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0f0f18] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pl-10 pr-6 py-5">Banner</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Display Window</th>
                <th className="px-6 py-5">Priority</th>
                <th className="px-6 py-5">Deeplink</th>
                <th className="px-6 py-5">Created</th>
                <th className="pl-6 pr-10 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="w-8 h-8 mx-auto border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : banners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <p className="text-slate-500 font-medium italic">
                      No banners yet
                    </p>
                    <button
                      onClick={openCreateModal}
                      className="mt-4 px-6 py-2.5 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 active:scale-95"
                    >
                      Create your first banner
                    </button>
                  </td>
                </tr>
              ) : (
                banners.map((banner) => (
                  <tr
                    key={banner.id}
                    className="hover:bg-white/[0.02] transition-colors group/row"
                  >
                    <td className="pl-10 pr-6 py-5 max-w-xs">
                      <p className="text-sm text-slate-200 font-semibold">
                        {banner.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {banner.content.length > 90
                          ? `${banner.content.slice(0, 90)}…`
                          : banner.content}
                      </p>
                      <p className="text-[9px] text-slate-700 font-mono mt-1 group-hover/row:text-slate-500 transition-colors">
                        #{banner.id}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          banner.active
                            ? "bg-emerald-400 text-black"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {banner.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400 whitespace-nowrap">
                        {formatEpoch(banner.startsAt)}
                      </p>
                      <p className="text-xs text-slate-600 whitespace-nowrap mt-0.5">
                        → {formatEpoch(banner.endsAt)}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400 font-mono">
                        {banner.priority ?? "—"}
                      </p>
                    </td>
                    <td className="px-6 py-5 max-w-[180px]">
                      {banner.deeplink ? (
                        <p
                          className="text-[11px] text-slate-400 font-mono truncate"
                          title={banner.deeplink}
                        >
                          {banner.deeplink}
                          {banner.urlExternal && (
                            <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-sans">
                              EXT
                            </span>
                          )}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs text-slate-400 whitespace-nowrap">
                        {formatEpoch(banner.createdAt)}
                      </p>
                    </td>
                    <td className="pl-6 pr-10 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(banner)}
                          className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-emerald-400 hover:text-black transition-all duration-300 active:scale-95"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(banner)}
                          disabled={deletingId === banner.id}
                          className="px-4 py-2 text-[11px] font-bold rounded-xl bg-white/[0.03] border border-white/10 text-red-400/80 hover:bg-red-500 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                        >
                          {deletingId === banner.id ? "Deleting..." : "Delete"}
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
                  {editingBanner ? "Edit Banner" : "New Banner"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {editingBanner
                    ? "Update this startup announcement"
                    : "Shown to users when the app starts"}
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
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => updateForm("content", e.target.value)}
                  rows={4}
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Image URL{" "}
                  <span className="text-slate-700 normal-case font-medium">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => updateForm("imageUrl", e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Deeplink{" "}
                  <span className="text-slate-700 normal-case font-medium">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.deeplink}
                  onChange={(e) => updateForm("deeplink", e.target.value)}
                  placeholder="/matches/123"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
                <p className="mt-1.5 text-[10px] text-slate-600">
                  in-app route e.g. /matches/123 or full https:// URL
                </p>
              </div>
              <div className="flex items-center justify-between gap-6 py-1">
                <div>
                  <p className="text-sm text-slate-200 font-semibold">
                    Opens externally
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Open the deeplink in the device browser
                  </p>
                </div>
                <Toggle
                  checked={form.urlExternal}
                  onChange={(checked) => updateForm("urlExternal", checked)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Button Label{" "}
                  <span className="text-slate-700 normal-case font-medium">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.buttonLabel}
                  onChange={(e) => updateForm("buttonLabel", e.target.value)}
                  placeholder="Learn More"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Starts At{" "}
                    <span className="text-slate-700 normal-case font-medium">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => updateForm("startsAt", e.target.value)}
                    className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Ends At{" "}
                    <span className="text-slate-700 normal-case font-medium">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => updateForm("endsAt", e.target.value)}
                    className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white [color-scheme:dark]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Priority{" "}
                  <span className="text-slate-700 normal-case font-medium">
                    (optional, higher shows first)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => updateForm("priority", e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-slate-700"
                />
              </div>
              <div className="flex items-center justify-between gap-6 py-1">
                <div>
                  <p className="text-sm text-slate-200 font-semibold">Active</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Only active banners are shown in the app
                  </p>
                </div>
                <Toggle
                  checked={form.active}
                  onChange={(checked) => updateForm("active", checked)}
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
                ) : editingBanner ? (
                  "Save Changes"
                ) : (
                  "Create Banner"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
