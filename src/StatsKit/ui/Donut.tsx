
// ui/Donut.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
export function Donut({ value, size=96 }: { value: number; size?: number }) {
  const clamped = Math.max(1, Math.min(10, value));
  const pct = (clamped - 1) / 9;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;
  const dash = c * pct;
  const hue = 20 + pct * 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`translate(${size/2}, ${size/2})`}>
        <circle r={r} cx={0} cy={0} stroke="currentColor" className="text-zinc-300 dark:text-zinc-800" strokeWidth={stroke} fill="none" />
        <circle r={r} cx={0} cy={0} stroke={`hsl(${hue} 80% 50%)`} strokeWidth={stroke} fill="none" strokeDasharray={`${dash} ${c-dash}`} transform="rotate(-90)" strokeLinecap="round" />
        <text x={0} y={6} textAnchor="middle" className="fill-current text-xl font-bold tabular-nums">{formatScore(clamped)}</text>
      </g>
    </svg>
  );
}
