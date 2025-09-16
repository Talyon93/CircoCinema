// StatsKit/sections/UserPanelClassic/parts/OldStyleCompareCard.tsx
import React from "react";
import { Card } from "../../../../Components/UI/Card";
import { InfoBadge } from "./InfoBadge";

/* ----------------------- Delta badge ----------------------- */
function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset
        ${up
          ? "bg-emerald-500/12 text-emerald-300 ring-emerald-500/30"
          : "bg-rose-500/12 text-rose-300 ring-rose-500/30"}`}
      title={(value > 0 ? "+" : "") + value.toFixed(2)}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={up ? "M12 5l7 7h-4v7H9v-7H5l7-7z" : "M12 19l-7-7h4V5h6v7h4l-7 7z"} />
      </svg>
      {(value > 0 ? "+" : "") + value.toFixed(2)}
    </span>
  );
}

/* ----------------------- Bar comparativa ----------------------- */
function OldStyleBar({
  a,
  b,
  min = 0,
  max = 10,
  leftLabel = "A",
  rightLabel = "B",
}: {
  a: number | null | undefined;
  b: number | null | undefined;
  min?: number;
  max?: number;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const aPct = typeof a === "number" ? clamp(a) : 0;
  const bPct = typeof b === "number" ? clamp(b) : 0;
  const fillColor =
    a != null && b != null && a < b ? "bg-rose-500/50" : "bg-emerald-500/50";

  return (
    <div className="mt-3">
      <div className="relative h-2 w-full rounded-full bg-zinc-800">
        {/* riempimento principale */}
        <div
          className={`absolute left-0 top-0 h-2 rounded-full ${fillColor}`}
          style={{ width: `${aPct}%` }}
        />
        {/* marker A */}
        {typeof a === "number" && (
          <div
            className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-emerald-400 shadow"
            style={{ left: `${aPct}%` }}
            title={`${leftLabel} ${a.toFixed(2)}`}
          />
        )}
        {/* marker B */}
        {typeof b === "number" && (
          <div
            className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-sky-400 shadow"
            style={{ left: `${bPct}%` }}
            title={`${rightLabel} ${b.toFixed(2)}`}
          />
        )}

        {/* ticks */}
        <div className="absolute -bottom-4 left-0 text-[10px] text-zinc-500">{min}</div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">
          {((min + max) / 2).toFixed(0)}
        </div>
        <div className="absolute -bottom-4 right-0 text-[10px] text-zinc-500">{max}</div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {leftLabel}
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          {rightLabel}
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Card principale ----------------------- */
export function OldStyleCompareCard({
  title,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  hint,
}: {
  title: string;
  leftLabel: string;
  leftValue: number | null | undefined;
  rightLabel: string;
  rightValue: number | null | undefined;
  hint?: string;
}) {
  const hasBoth = leftValue != null && rightValue != null;
  const delta = hasBoth ? Number(leftValue) - Number(rightValue) : null;

  return (
    <Card>
      {/* Header: icona a sinistra, titolo centrale, info + delta a destra */}
      <Card.Header
        icon={<span>📏</span>}
        title={title}
        info={
           <div className="flex items-center gap-2">
      <DeltaBadge value={delta} />
      <InfoBadge text="Media voti ricevuti vs IMDb sui film portati." /> {/* inline by default */}
    </div>
        }
      />

      {/* Sezione valori: container scuro, riquadri numerici interni chiari */}
      <Card.Section padding="md" inset tone="base" className="mt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-zinc-800/60">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{leftLabel}</div>
            <div className="mt-1 text-2xl font-semibold md:text-3xl">
              {typeof leftValue === "number" ? leftValue.toFixed(2) : "—"}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.02] p-3 text-right ring-1 ring-inset ring-zinc-800/60">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{rightLabel}</div>
            <div className="mt-1 text-2xl font-semibold md:text-3xl">
              {typeof rightValue === "number" ? rightValue.toFixed(2) : "—"}
            </div>
          </div>
        </div>

        {/* barra comparativa */}
        <OldStyleBar
          a={leftValue}
          b={rightValue}
          leftLabel={leftLabel}
          rightLabel={rightLabel}
        />
      </Card.Section>
    </Card>
  );
}
