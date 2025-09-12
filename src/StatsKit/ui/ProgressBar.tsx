
// ui/ProgressBar.tsx
import React from "react";
export function ProgressBar({ value, max=10 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
