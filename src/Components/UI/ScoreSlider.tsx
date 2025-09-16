// filepath: src/Components/UI/ScoreSlider.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";

export default function ScoreSlider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.25,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const snap = (n: number) => Number((Math.round(n / step) * step).toFixed(2));
  const toPct = (n: number) => ((clamp(n) - min) / (max - min)) * 100;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const calcFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const x = Math.min(rect.right, Math.max(rect.left, clientX));
      const pct = (x - rect.left) / w;
      const raw = min + pct * (max - min);
      return snap(raw);
    },
    [min, max, step, value]
  );

  const startDrag = (clientX: number) => {
    onChange(calcFromClientX(clientX));
    setDragging(true);

    const onMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
      let cx = 0;
      if ("clientX" in e) {
        cx = (e as PointerEvent | MouseEvent).clientX;
      } else if ("touches" in e && (e as TouchEvent).touches?.[0]) {
        cx = (e as TouchEvent).touches[0].clientX;
        try { (e as TouchEvent).preventDefault(); } catch {}
      }
      onChange(calcFromClientX(cx));
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("touchend", onUp);
    };

    window.addEventListener("pointermove", onMove as any);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mousemove", onMove as any);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as any, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const pct = useMemo(() => toPct(value), [value, min, max]);
  const mid = min + (max - min) / 2;

  return (
    <div
      className="select-none"
      tabIndex={0}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        className="relative z-50 h-3 w-full cursor-pointer rounded-full bg-zinc-800/80"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) { e.preventDefault(); startDrag(t.clientX); }
        }}
      >
        <div
          className="absolute left-0 top-0 h-3 rounded-full bg-gradient-to-r from-lime-500 to-lime-400"
          style={{ width: `${pct}%` }}
        />

        {Array.from({ length: Math.floor(max - min) + 1 }, (_, i) => i + min).map((n) => (
          <div
            key={n}
            className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-white/35"
            style={{ left: `calc(${toPct(n)}% - 1px)` }}
          />
        ))}

        <div
          className={`pointer-events-none absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white shadow-lg ring-4 ring-lime-500/30 dark:bg-zinc-50 ${dragging ? "scale-[1.04]" : ""}`}
          style={{ left: `calc(${pct}% - 16px)`, transition: dragging ? "none" : "transform .08s ease" }}
        />
        <div
          className="pointer-events-none absolute -top-9 rounded-lg border border-zinc-700/70 bg-zinc-950 px-2 py-0.5 text-sm font-bold text-white shadow-lg"
          style={{ left: `calc(${pct}% - 18px)` }}
        >
          {Number(value).toFixed(2)}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between">
        <span className="rounded-md bg-white/90 px-1.5 py-[2px] text-[12px] font-semibold text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-zinc-900/85 dark:text-zinc-50 dark:ring-zinc-700">
          {min}
        </span>
        <span className="rounded-md bg-white/90 px-1.5 py-[2px] text-[12px] font-semibold text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-zinc-900/85 dark:text-zinc-50 dark:ring-zinc-700">
          {mid}
        </span>
        <span className="rounded-md bg-white/90 px-1.5 py-[2px] text-[12px] font-semibold text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-zinc-900/85 dark:text-zinc-50 dark:ring-zinc-700">
          {max}
        </span>
      </div>
    </div>
  );
}
