import React from "react";
import { formatScore } from "../../Utils/Utils"; // <-- verifica/aggiusta path

type Props = {
  values: number[];      // voti 1..10
  height?: number;
  padding?: number;
  binWidth?: number;     // grandezza bin istogramma (default 0.5)
};

export default function DistributionInsight({
  values,
  height = 260,
  padding = 28,
  binWidth = 0.5,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(560);
  const [hover, setHover] = React.useState<null | {
    x: number; y: number; score: number; density: number; percentile: number; around: number; boxX: number; boxY: number;
  }>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(420, Math.floor(e[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const xs = (values || []).map(Number).filter(x => Number.isFinite(x) && x>=1 && x<=10);
  const n = xs.length;
  if (!n) return <div className="text-sm text-zinc-500">No data</div>;

  // helpers
  const clamp = (v:number,a:number,b:number)=> Math.max(a, Math.min(b,v));
  const mean = (arr:number[]) => arr.reduce((a,b)=>a+b,0)/arr.length;
  const stdev = (arr:number[]) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s,x)=> s+(x-m)*(x-m),0)/arr.length);
  };
  const quantile = (arr:number[], q:number) => {
    if (!arr.length) return NaN;
    const a = arr.slice().sort((x,y)=>x-y);
    const pos = clamp((a.length-1)*q, 0, a.length-1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo===hi ? a[lo] : a[lo] + (a[hi]-a[lo])*(pos-lo);
  };

  // stats
  const mu  = mean(xs);
  const sd  = stdev(xs);
  const p50 = quantile(xs, 0.5);
  const p25 = quantile(xs, 0.25);
  const p75 = quantile(xs, 0.75);
  const p10 = quantile(xs, 0.10);
  const p90 = quantile(xs, 0.90);
  const shareGE8 = xs.filter(x => x>=8).length / n;

  // istogramma
  const domainMin = 1, domainMax = 10;
  const bins: Array<{x0:number; x1:number; count:number}> = [];
  for (let b = domainMin; b < domainMax + 1e-6; b += binWidth) {
    bins.push({ x0:b, x1:Math.min(domainMax, b+binWidth), count:0 });
  }
  for (const v of xs) {
    const idx = Math.min(bins.length-1, Math.max(0, Math.floor((v - domainMin)/binWidth)));
    bins[idx].count += 1;
  }
  const maxCount = Math.max(1, ...bins.map(b => b.count));

  // KDE gauss
  const gridN = 200;
  const grid = Array.from({length:gridN}, (_,i)=> domainMin + (i*(domainMax-domainMin))/(gridN-1));
  const h = Math.max(0.25, 1.06 * (sd || 1) * Math.pow(n, -1/5));
  const norm = 1 / (Math.sqrt(2*Math.PI) * h * n);
  const density = grid.map(x => {
    let s = 0;
    for (let i=0;i<n;i++){
      const z = (x - xs[i]) / h;
      s += Math.exp(-0.5*z*z);
    }
    return norm * s;
  });
  const maxDens = Math.max(...density);

  // CDF approx
  const cdf: number[] = [];
  let accum = 0;
  for (let i=0;i<grid.length;i++){
    if (i===0) { cdf.push(0); continue; }
    const dx = grid[i] - grid[i-1];
    accum += 0.5 * (density[i] + density[i-1]) * dx;
    cdf.push(accum);
  }
  const totalArea = accum || 1;
  for (let i=0;i<cdf.length;i++) cdf[i] /= totalArea;

  // layout
  const H = height;
  const innerW = W - padding*2;
  const innerH = H - padding*2;
  const nx = (x:number)=> padding + (x - domainMin)/(domainMax-domainMin) * innerW;
  const nyCount = (c:number)=> padding + innerH - (c / maxCount) * innerH * 0.6;
  const nyDens  = (d:number)=> padding + innerH - (d / maxDens) * innerH * 0.9;

  const kdPath = grid.map((x,i)=> `${i?'L':'M'}${nx(x)},${nyDens(density[i])}`).join(" ") +
                 ` L ${nx(domainMax)},${padding+innerH} L ${nx(domainMin)},${padding+innerH} Z`;

  function toLocal(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { boxX: e.clientX - r.left + 10, boxY: e.clientY - r.top + 10 };
  }
  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const r = (e.target as SVGRectElement).getBoundingClientRect();
    const mx = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const x = domainMin + (mx / r.width) * (domainMax-domainMin);
    // nearest grid pt
    let k = 0, best = Math.abs(grid[0]-x);
    for (let i=1;i<grid.length;i++){
      const d = Math.abs(grid[i]-x);
      if (d<best) { best=d; k=i; } else if (grid[i]>x && d>best) break;
    }
    const pct = (cdf[k] || 0);
    const low = x - binWidth/2, high = x + binWidth/2;
    const around = xs.filter(v => v>=low && v<high).length;
    setHover({ ...toLocal(e), x: nx(x), y: nyDens(density[k]), score: x, density: density[k], percentile: pct, around });
  }
  function handleLeave(){ setHover(null); }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="block">
        {/* griglia Y */}
        {[2,4,6,8,10].map((t)=>(
          <line key={t} x1={padding} x2={W-padding}
                y1={padding+innerH - (t-1)/(9) * innerH}
                y2={padding+innerH - (t-1)/(9) * innerH}
                stroke="currentColor" className="text-zinc-800" strokeDasharray="2 3" />
        ))}

        {/* istogramma */}
        {bins.map((b,i)=>{
          const x0 = nx(b.x0), x1 = nx(b.x1);
          const y  = nyCount(b.count);
          const h  = padding+innerH - y;
          const mid = (b.x0 + b.x1)/2;
          const cls = mid >= 8 ? "text-emerald-500" : (mid<=5 ? "text-rose-500" : "text-amber-400");
          return (
            <rect key={i} x={x0+0.5} y={y}
                  width={Math.max(0,x1-x0-1)} height={Math.max(2,h)}
                  className={cls} opacity={0.18} fill="currentColor" rx={2} />
          );
        })}

        {/* KDE area + linea */}
        <path d={kdPath} className="text-emerald-500" fill="currentColor" fillOpacity={0.12} pointerEvents="none" />
        <path d={grid.map((x,i)=> `${i?'L':'M'}${nx(x)},${nyDens(density[i])}`).join(" ")}
              className="text-emerald-400" stroke="currentColor" strokeWidth={2} fill="none" pointerEvents="none" />

        {/* IQR + whisker + median */}
        <rect x={nx(p25)} y={padding} width={nx(p75)-nx(p25)} height={innerH}
              className="text-amber-400" fill="currentColor" fillOpacity={0.06} pointerEvents="none" />
        <line x1={nx(p10)} x2={nx(p10)} y1={padding} y2={padding+innerH} stroke="currentColor" className="text-zinc-700" strokeDasharray="4 3" />
        <line x1={nx(p90)} x2={nx(p90)} y1={padding} y2={padding+innerH} stroke="currentColor" className="text-zinc-700" strokeDasharray="4 3" />
        <line x1={nx(p50)} x2={nx(p50)} y1={padding} y2={padding+innerH} stroke="currentColor" className="text-emerald-500" strokeWidth={2} />

        {/* ticks X */}
        {[1,2,3,4,5,6,7,8,9,10].map(t => (
          <text key={t} x={nx(t)} y={padding+innerH+14} textAnchor="middle"
                className="fill-current text-[10px] text-zinc-500">{t}</text>
        ))}

        {/* overlay per hover */}
        <rect x={padding} y={padding} width={innerW} height={innerH}
              fill="white" fillOpacity={0} pointerEvents="all"
              onMouseMove={handleMove} onMouseLeave={handleLeave} />

        {/* crosshair */}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={padding} y2={padding+innerH}
                stroke="currentColor" className="text-zinc-600/70" strokeDasharray="3 3" />
        )}
      </svg>

      {/* KPI chips */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">n = <b>{n}</b></span>
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">mean = <b>{formatScore(mu)}</b></span>
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">median = <b>{formatScore(p50)}</b></span>
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">σ = <b>{formatScore(sd)}</b></span>
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">% ≥ 8 = <b>{Math.round(shareGE8*100)}%</b></span>
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5">IQR = <b>{formatScore(p25)}–{formatScore(p75)}</b></span>
      </div>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-zinc-700/60 bg-zinc-900/90 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(0, hover.boxX), W - 220), top: Math.min(Math.max(0, hover.boxY), H - 76) }}
        >
          <div>score ≈ <b>{formatScore(hover.score)}</b></div>
          <div className="opacity-80">percentile ≈ {(hover.percentile*100).toFixed(0)}%</div>
          <div className="opacity-80">density: {hover.density.toFixed(3)}</div>
          <div className="opacity-80">count ±{binWidth/2}: {hover.around}</div>
        </div>
      )}
    </div>
  );
}
