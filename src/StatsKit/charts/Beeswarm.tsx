// charts/Beeswarm.tsx
import React from "react";

type Val = { score: number; key: string; label?: string };

export function Beeswarm({
  values,
  height = 240,
  padding = 24,
  radius = 4,
}: {
  values: Val[];
  height?: number;
  padding?: number;
  radius?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(560);
  const [hover, setHover] = React.useState<null | {
    x: number;
    y: number;
    v: Val;
    boxX: number;
    boxY: number;
  }>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) =>
      setW(Math.max(360, Math.floor(e[0].contentRect.width)))
    );
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!values?.length) return <div className="text-sm text-zinc-500">No data</div>;

  const H = height;
  const innerH = H - padding * 2;

  // scala Y (1..10 -> top..bottom)
  const ny = (s: number) => padding + (1 - (s - 1) / 9) * innerH;

  // griglia Y
  const ticks = [2, 4, 6, 8, 10];

  // swarm layout ---------------------------------------------------
  const cx = W / 2;
  const r = radius;
  const minDist = r * 2 + 0.5; // piccolo gap
  const minDist2 = minDist * minDist;
  const step = r * 2.2; // passo orizzontale tra colonne del “pannello”
  const order = (n: number) => (n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2)); // 0, +1, -1, +2, -2...

  // ordina per y (quindi per score); tie-break deterministico con key
  const data = values
    .slice()
    .sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));

  type Node = { x: number; y: number; v: Val };
  const placed: Node[] = [];

  function place(y: number): number {
    // prova posizioni simmetriche intorno a cx: 0, ±1, ±2 ...
    for (let k = 0; k < 1000; k++) {
      const col = order(k);
      const cand = cx + col * step;

      // collision check con i punti "vicini" in verticale
      let ok = true;
      for (let i = placed.length - 1; i >= 0; i--) {
        const n = placed[i];
        if (Math.abs(n.y - y) > minDist) {
          // troppo lontano verticalmente per collidere
          if (n.y < y - minDist && placed.length - i > 40) break;
          continue;
        }
        const dx = cand - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy < minDist2) {
          ok = false;
          break;
        }
      }
      if (ok) return cand;
    }
    // fallback estremo (non dovrebbe mai servire)
    return cx;
  }

  const nodes: Node[] = data.map((v) => {
    const y = ny(v.score);
    const x = place(y);
    const n = { x, y, v };
    placed.push(n);
    return n;
  });

  function toLocal(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect();
    return { boxX: e.clientX - rect.left + 10, boxY: e.clientY - rect.top + 10 };
    }

  function colorFor(score: number) {
    if (score <= 3) return "text-rose-400";
    if (score <= 6) return "text-amber-300";
    return "text-emerald-400";
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} className="block">
        {/* griglia orizzontale */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={48}
            x2={W - 24}
            y1={ny(t)}
            y2={ny(t)}
            stroke="currentColor"
            className="text-zinc-800"
            strokeDasharray="2 3"
          />
        ))}

        {/* swarm */}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={hover?.v.key === n.v.key ? r + 1.5 : r}
            className={colorFor(n.v.score)}
            fill="currentColor"
            onMouseEnter={(e) => setHover({ ...toLocal(e), ...n })}
            onMouseMove={(e) => setHover((prev) => ({ ...(prev || n), ...toLocal(e) }))}
            onMouseLeave={() => setHover(null)}
          >
            <title>Score: {n.v.score.toFixed(1)}</title>
          </circle>
        ))}

        {/* etichette asse Y */}
        {ticks.map((t) => (
          <text
            key={t}
            x={8}
            y={ny(t) + 3}
            className="fill-current text-[10px] text-zinc-500"
          >
            {t}
          </text>
        ))}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-zinc-700/60 bg-zinc-900/90 px-2.5 py-1.5 text-xs shadow-xl"
          style={{
            left: Math.min(Math.max(0, hover.boxX), W - 220),
            top: Math.min(Math.max(0, hover.boxY), H - 60),
          }}
        >
          {hover.v.label && <div className="font-semibold">{hover.v.label}</div>}
          <div>Score: {hover.v.score.toFixed(1)}</div>
        </div>
      )}
    </div>
  );
}
