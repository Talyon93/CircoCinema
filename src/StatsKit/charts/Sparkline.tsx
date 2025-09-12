// charts/Sparkline.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";

type Pt = { t:number; val?:number; avg?:number; title?:string; label?:string };
type Band = { from:number; to:number; className:string };

type Mode = "avg" | "delta";

export type Viewing = {
  movie?: { title?: string };
  ratings?: Record<string, number>;
  picked_by?: string; // o pickedBy
  pickedBy?: string;
  started_at?: string; // ISO
  date?: string;       // fallback
  created_at?: string; // fallback
};

function toT(view: Viewing, fallbackIndex: number) {
  const ts =
    Date.parse(view.started_at || view.date || view.created_at || "") || 0;
  return ts || fallbackIndex; // ordine stabile anche senza date
}

export function buildVotesGiven(history: Viewing[], user: string) {
  const items = history
    .map((h, i) => {
      const v = Number(h.ratings?.[user]);
      if (!Number.isFinite(v)) return null;
      return {
        t: toT(h, i),
        val: v,
        title: h.movie?.title,
      };
    })
    .filter(Boolean) as { t: number; val: number; title?: string }[];

  // reindex per evitare buchi temporali
  return items
    .sort((a, b) => a.t - b.t)
    .map((p, i) => ({ ...p, t: i }));
}

export function buildVotesReceived(history: Viewing[], user: string) {
  const mine = history.filter(
    (h) => (h.picked_by ?? h.pickedBy) === user
  );

  const items = mine.map((h, i) => {
    const vals = Object.values(h.ratings ?? {})
      .map(Number)
      .filter((x) => Number.isFinite(x));
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      t: i,
      val: avg,
      title: h.movie?.title,
      label: `${vals.length} votes`,
    };
  });

  return (items.filter(Boolean) as any[]).sort((a, b) => a.t - b.t);
}

type BaseProps = {
  data: Pt[];
  height?: number;
  padding?: number;
  /** Bande orizzontali (es: zone ±1). Ignorate se non passate */
  bands?: Band[];
  /** Disegna la linea a y=0 (utile per mode="delta") */
  zeroLine?: boolean;
  /** Forza il dominio Y: [min,max] o "auto". Di default: avg→[4,10], delta→auto */
  yDomain?: [number, number] | "auto";
  /** "avg" (4..10) oppure "delta" (auto) */
  mode?: Mode;
  /** Mostra le tacche orizzontali fisse 4..10 (solo mode="avg") */
  gridForAvg?: boolean;
};

export function Sparkline({
  data,
  height = 120,
  padding = 12,
  bands,
  zeroLine,
  yDomain,
  mode = "avg",
  gridForAvg = true,
}: BaseProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(420);
  const [hover, setHover] = React.useState<null | {
    boxX:number; boxY:number; d:{ x:number; y:number; val:number; title?:string; label?:string };
  }>(null);

  const gid = (React as any).useId ? (React as any).useId() : "sg";

  React.useEffect(()=>{
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setW(Math.max(260, Math.floor(es[0].contentRect.width))));
    ro.observe(ref.current);
    return ()=>ro.disconnect();
  },[]);

  // normalizza i dati: usa val oppure avg
  const norm = (data || [])
    .map(p => ({ t:p.t, val: Number.isFinite(p.val) ? (p.val as number) : (p.avg as number), title:p.title, label:p.label }))
    .filter(p => Number.isFinite(p.val));

  if (!norm.length) return <div className="h-[72px] text-sm text-zinc-500">No data</div>;

  // domini
  const xs = norm.map(d => d.t);
  const minX = Math.min(...xs), maxX = Math.max(...xs);

  let minY: number, maxY: number;
  if (yDomain && yDomain !== "auto") {
    [minY, maxY] = yDomain;
  } else if (mode === "avg") {
    minY = 4; maxY = 10;
  } else {
    const ys = norm.map(d => d.val);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
    if (bands?.length) {
      for (const b of bands) {
        if (Number.isFinite(b.from)) minY = Math.min(minY, b.from);
        if (Number.isFinite(b.to))   maxY = Math.max(maxY, b.to);
      }
    }
  }
  if (!(isFinite(minY) && isFinite(maxY)) || minY === maxY) { minY -= 1; maxY += 1; }

  const H = height, innerW = W - padding*2, innerH = H - padding*2;
  const nx = (x:number)=> padding + (maxX===minX?0.5:(x-minX)/(maxX-minX))*innerW;
  const ny = (y:number)=> padding + (1 - (y-minY)/(maxY-minY || 1))*innerH;

  // proietta e ordina per x
  const pts = norm.map(p => ({ ...p, x:nx(p.t), y:ny(p.val as number) })).sort((a,b)=>a.x-b.x);
  const d = pts.map((p,i)=> `${i?'L':'M'}${p.x},${p.y}`).join(" ");

  function toLocal(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { boxX: e.clientX - r.left + 10, boxY: e.clientY - r.top + 10 };
  }

  // nearest point
  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const r = (e.target as SVGRectElement).getBoundingClientRect();
    const mx = e.clientX - r.left;
    let best = pts[0], bestDx = Math.abs(mx - pts[0].x);
    for (let i=1;i<pts.length;i++){
      const dx = Math.abs(mx - pts[i].x);
      if (dx < bestDx) { best = pts[i]; bestDx = dx; } else if (pts[i].x > mx && dx > bestDx) break;
    }
    setHover({ ...toLocal(e as any), d: { ...best, val: best.val as number }});
  }
  function handleLeave(){ setHover(null); }

  const yTicksAvg = [4,5,6,7,8,9,10];

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="block">
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopOpacity="0.35" />
            <stop offset="100%" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid per media 4..10 */}
        {mode === "avg" && gridForAvg && yTicksAvg.map((y)=>(
          <line key={y} x1={padding} x2={W-padding} y1={ny(y)} y2={ny(y)}
                stroke="currentColor" className="text-zinc-800" strokeWidth={0.5} />
        ))}

        {/* Bande orizzontali */}
        {bands && bands.map((b,i)=>{
          const y1 = ny(b.from), y2 = ny(b.to);
          const top = Math.min(y1, y2), h = Math.abs(y1 - y2);
          return <rect key={i} x={padding} y={top} width={innerW} height={h}
                       className={b.className} pointerEvents="none" />;
        })}

        {/* area + linea */}
        <path d={`${d} L ${W - padding},${H - padding} L ${padding},${H - padding} Z`}
              fill={`url(#area-${gid})`} pointerEvents="none" />
        <path d={d} fill="none" strokeWidth={2.5} className="text-emerald-500"
              stroke="currentColor" pointerEvents="none" />

        {/* zero line opzionale */}
        {(zeroLine ?? mode === "delta") && (
          <line x1={padding} x2={W - padding} y1={ny(0)} y2={ny(0)}
                className="text-zinc-600/60" stroke="currentColor" strokeDasharray="4 3"
                pointerEvents="none" />
        )}

        {/* puntini */}
        {pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r={3} className="text-emerald-500" fill="currentColor">
            <title>
              {(p.title ? `${p.title} • ` : "") +
               `${formatScore(p.val as number)} / 10` +
               (p.label ? `\n${p.label}` : "")}
            </title>
          </circle>
        ))}

        {/* overlay trasparente per hover */}
        <rect
          x={padding} y={padding} width={innerW} height={innerH}
          fill="white" fillOpacity={0} pointerEvents="all"
          onMouseMove={handleMove} onMouseLeave={handleLeave}
        />

        {/* etichette Y per "avg" */}
        {mode === "avg" && gridForAvg && yTicksAvg.map((y)=>(
          <text key={y} x={4} y={ny(y)+3}
                className="fill-current text-[10px] text-zinc-500">{y}</text>
        ))}

        {/* etichette Y per "delta" */}
        {mode === "delta" && yDomain !== "auto" && Array.isArray(yDomain) && (
          <>
            {Array.from({ length: 5 }).map((_, i) => {
              const yVal = yDomain[0] + ((yDomain[1] - yDomain[0]) * i) / 4;
              return (
                <text
                  key={i}
                  x={4}
                  y={ny(yVal) + 3}
                  className="fill-current text-[10px] text-zinc-500"
                >
                  {yVal.toFixed(1)}
                </text>
              );
            })}
          </>
        )}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-[280px] rounded-lg border border-zinc-700/60 bg-zinc-900/90 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(0, hover.boxX), W - 220),
                   top:  Math.min(Math.max(0, hover.boxY), H - 70) }}
        >
          {hover.d.title && <div className="font-semibold">{hover.d.title}</div>}
          {hover.d.label && <div className="opacity-70">{hover.d.label}</div>}
          {mode === "delta" ? (
            <div className="mt-1">Δ: {formatScore(hover.d.val)}</div>
          ) : (
            <div className="mt-1">Value: {formatScore(hover.d.val)}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========== WRAPPERS RETRO-COMPATIBILI =========== */

export function SparklineClassic({
  data, height = 120, padding = 12,
}: { data:Array<{ t:number; avg:number }>; height?:number; padding?:number; }) {
  return <Sparkline mode="avg" data={data as Pt[]} height={height} padding={padding} />;
}

export function SparklineDelta({
  data, height = 120, padding = 12, bands, zeroLine = true,
}: {
  data:Array<{ t:number; val:number; title?:string; label?:string }>;
  height?:number; padding?:number; bands?:Band[]; zeroLine?:boolean;
}) {
  return (
    <Sparkline
      mode="delta"
      data={data as Pt[]}
      height={height}
      padding={padding}
      bands={bands}
      zeroLine={zeroLine}
      yDomain="auto"
    />
  );
}
