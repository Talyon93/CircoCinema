import { formatScore } from "../../Utils/Utils";

function donutColor(score: number) {
  const s = Math.max(1, Math.min(10, score));
  if (s <= 4) return `hsl(0 85% 50%)`;               // rosso fisso fino a 5
  const hue = ((s - 4) / 4) * 120;                   // 5→0°, 10→120°
  return `hsl(${hue} 85% 50%)`;
}

export function ScoreDonut({ value, size = 64 }: { value: number; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
        <circle
          cx="32" cy="32" r={r} strokeWidth="8"
          className="fill-none"
          style={{ stroke: donutColor(value) }}       // ⟵ colore dinamico
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-bold text-zinc-900 dark:text-white">
        {formatScore(value)}
      </div>
    </div>
  );
}
