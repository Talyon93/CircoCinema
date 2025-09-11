import {
  formatScore,
} from "../../Utils/Utils";


export function ScoreDonut({ value, size = 64 }: { value: number; size?: number }) {
  // style identico al tuo AvgRing (r=26, stroke=8 su viewBox 64)
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
        <circle
          cx="32"
          cy="32"
          r={r}
          strokeWidth="8"
          className="fill-none stroke-lime-400"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      {/* numero centrale — bianco in dark mode */}
      <div className="absolute inset-0 grid place-items-center text-sm font-bold text-zinc-900 dark:text-white">
        {formatScore(value)}
      </div>
    </div>
  );
}