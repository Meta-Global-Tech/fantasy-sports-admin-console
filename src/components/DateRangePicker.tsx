"use client";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const QUICK_RANGES = [
  { label: "Today", days: 0 },
  { label: "Next 3d", days: 3 },
  { label: "Next 7d", days: 7 },
  { label: "Next 30d", days: 30 },
];

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  function applyQuick(days: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    onChange(toDateInputValue(start), toDateInputValue(end));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick ranges */}
      <div className="flex gap-1">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => applyQuick(r.days)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* From */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-slate-500">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
        />
      </div>

      {/* To */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-slate-500">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
        />
      </div>
    </div>
  );
}
