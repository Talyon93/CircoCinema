// StatsKit/ui/StatBadge.tsx
import React from "react";
import { InfoBadge } from "./InfoBadge";

type Tone = "default" | "positive" | "negative" | "warning";

export function StatBadge({
  label,
  value,
  sub,
  icon,
  delta,
  tone = "default",
  className = "",
  infoText,
  infoTone,
  align = "left",      // ⬅️ NEW
  compact = false,     // ⬅️ NEW
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  delta?: number;
  tone?: Tone;
  className?: string;
  infoText?: string;
  infoTone?: Tone;
  align?: "left" | "center"; // ⬅️ NEW
  compact?: boolean;         // ⬅️ NEW
}) {
  const toneRing: Record<Tone, string> = {
    default: "ring-white/5",
    positive: "ring-emerald-500/30",
    negative: "ring-rose-500/30",
    warning: "ring-amber-500/30",
  };
  const toneDot: Record<Tone, string> = {
    default: "bg-zinc-400/50",
    positive: "bg-emerald-400",
    negative: "bg-rose-400",
    warning: "bg-amber-400",
  };

  const trend =
    typeof delta === "number"
      ? {
          label:
            (delta > 0 ? "▲ " : delta < 0 ? "▼ " : "• ") +
            Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 2 }),
          cls: delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-zinc-400",
        }
      : null;

  const isCenter = align === "center";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-zinc-200/10",
        "bg-gradient-to-b from-zinc-900/40 to-zinc-900/10",
        compact ? "p-3" : "p-4",                    // ⬅️ compact
        "shadow-sm ring-1 transition hover:shadow-md",
        toneRing[tone],
        className,
      ].join(" ")}
    >
      {/* top accent */}
      <div className={`absolute inset-x-0 top-0 h-[2px] ${toneDot[tone]}`} />

      {/* floating info badge (tonale) */}
      {infoText && <InfoBadge text={infoText} tone={infoTone ?? tone} variant="floating" />}

      <div className={`flex ${isCenter ? "justify-center" : "items-start gap-3"}`}>
        {icon && !isCenter && (
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-zinc-800/60">
            <div className="text-zinc-200">{icon}</div>
          </div>
        )}

        <div className={`min-w-0 ${isCenter ? "text-center" : "flex-1"}`}>
          {/* Header row */}
          {isCenter ? (
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              {label}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                {label}
              </div>
              {trend && <div className={`shrink-0 text-xs font-semibold ${trend.cls}`}>{trend.label}</div>}
            </div>
          )}

          {/* Value */}
          <div className={`${compact ? "mt-0.5" : "mt-1"} text-2xl font-semibold leading-none text-zinc-100`}>
            {value}
          </div>

          {/* Trend (in basso, se centrato) */}
          {isCenter && trend && (
            <div className={`mt-1 text-xs font-semibold ${trend.cls}`}>{trend.label}</div>
          )}

          {/* Sub copy */}
          {sub && <div className={`${compact ? "mt-1" : "mt-1.5"} text-xs leading-5 text-zinc-400`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
