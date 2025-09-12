
// charts/SparklineDelta.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
export function SparklineDelta({
  data, height=120, padding=12, bands, zeroLine=false
}:{ data:Array<{ t:number; val:number; title?:string; label?:string }>; height?:number; padding?:number;
   bands?: Array<{ from:number; to:number; className:string }>; zeroLine?: boolean; }){
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(420);
  const [hover, setHover] = React.useState<null | {x:number;y:number;d:any}>(null);
  React.useEffect(()=>{
    if (!ref.current) return;
    const ro = new ResizeObserver((e)=> setW(Math.max(260, Math.floor(e[0].contentRect.width))));
    ro.observe(ref.current); return ()=>ro.disconnect();
  },[]);
  if (!data.length) return <div className="h-[72px] text-sm text-zinc-500">No data</div>;
  const xs = data.map(d=>d.t), ys = data.map(d=>d.val);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys, ...(bands||[]).flatMap(b=>[b.from,b.to]).filter(v=>Number.isFinite(v as any)) as number[]);
  const maxY = Math.max(...ys, ...(bands||[]).flatMap(b=>[b.from,b.to]).filter(v=>Number.isFinite(v as any)) as number[]);
  const H = height, innerW = W - padding*2, innerH = H - padding*2;
  const nx = (x:number)=> padding + (maxX===minX?0.5:(x-minX)/(maxX-minX))*innerW;
  const ny = (y:number)=> padding + (1 - (y-minY)/(maxY-minY || 1))*innerH;
  const pts = data.map(p=>({ x:nx(p.t), y:ny(p.val), ...p }));
  const d = pts.map((p,i)=> `${i?'L':'M'}${p.x},${p.y}`).join(' ');
  function toLocal(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left + 10, y: e.clientY - rect.top + 10 };
  }
  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="block">
        {bands && bands.map((b,i)=>{
          const y1 = ny(b.from), y2 = ny(b.to);
          const top = Math.min(y1, y2), h = Math.abs(y1 - y2);
          return <rect key={i} x={padding} y={top} width={innerW} height={h} className={b.className} />;
        })}
        <path d={`${d} L ${W - padding},${H - padding} L ${padding},${H - padding} Z`} fill="currentColor" className="text-emerald-500/10" />
        <path d={d} fill="none" strokeWidth={2.5} className="text-emerald-500" stroke="currentColor" />
        {zeroLine && (<line x1={padding} x2={W - padding} y1={ny(0)} y2={ny(0)} className="text-zinc-600/60" stroke="currentColor" strokeDasharray="4 3" />)}
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} className="text-emerald-500" fill="currentColor" />
            <circle cx={p.x} cy={p.y} r={14} fill="white" fillOpacity="0" pointerEvents="all"
              onMouseEnter={(e)=>setHover({ ...toLocal(e), d:p })}
              onMouseMove={(e)=>setHover({ ...toLocal(e), d:p })}
              onMouseLeave={()=>setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute max-w-[280px] rounded-lg border border-zinc-700/60 bg-zinc-900/90 px-3 py-2 text-xs shadow-xl"
             style={{ left: Math.min(Math.max(0, hover.x), W - 180), top: Math.min(Math.max(0, hover.y), H - 60) }}>
          {hover.d.title && <div className="font-semibold">{hover.d.title}</div>}
          {hover.d.label && <div className="opacity-70">{hover.d.label}</div>}
          <div className="mt-1">Δ: {formatScore(hover.d.val)}</div>
        </div>
      )}
    </div>
  );
}
