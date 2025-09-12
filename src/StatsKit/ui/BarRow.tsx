
// ui/BarRow.tsx
import React from "react";
export function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const colors = [
    "from-sky-500 to-indigo-500",
    "from-emerald-500 to-teal-400",
    "from-rose-500 to-pink-400",
    "from-amber-400 to-yellow-300",
    "from-purple-500 to-fuchsia-400",
  ];
  const color = colors[label.charCodeAt(0) % colors.length];
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="truncate">{label}</span>
          <span className="text-xs tabular-nums">{value}</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className={`h-2 rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
