
// charts/ScatterRuntime.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
import { mean } from "../../Utils/math";
export function ScatterRuntime({ points, height=260, padding=36 }:{ points:Array<{ x:number; y:number; size:number; title:string }>; height?:number; padding?:number; }){
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(520);
  const [hover, setHover] = React.useState<null | {x:number;y:number;p:any}>(null);
  React.useEffect(()=>{
    if (!ref.current) return;
    const ro = new ResizeObserver((es)=> setW(Math.max(300, Math.floor(es[0].contentRect.width))));
    ro.observe(ref.current); return ()=>ro.disconnect();
  },[]);
  if (!points.length) return <div className="text-sm text-zinc-500">No data</div>;
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = 4, maxY = 10;
  const H = height, innerW = W - padding*2, innerH = H - padding*2;
  const nx = (x:number)=> padding + (maxX===minX?0.5:(x-minX)/(maxX-minX))*innerW;
  const ny = (y:number)=> padding + (1 - (y-minY)/(maxY-minY))*innerH;
  const xbar = mean(xs), ybar = mean(ys);
  let num = 0, den = 0; for (let i=0;i<points.length;i++){ num += (xs[i]-xbar)*(ys[i]-ybar); den += (xs[i]-xbar)**2; }
  const b = den===0?0:(num/den), a = ybar - b*xbar;
  const xLine = [minX, maxX], yLine = xLine.map(x=> a + b*x);
  function toLocal(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left + 10, y: e.clientY - r.top + 10 };
  }
  const sMin = Math.min(...points.map(p=>p.size)), sMax = Math.max(...points.map(p=>p.size));
  const rScale = (s:number)=> 3 + 9*((s - sMin)/Math.max(1,(sMax - sMin)));
  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="block">
        <line x1={padding} x2={W-padding} y1={ny(4)} y2={ny(4)} stroke="currentColor" className="text-zinc-700" />
        <line x1={padding} x2={W-padding} y1={ny(6)} y2={ny(6)} stroke="currentColor" className="text-zinc-800" strokeDasharray="3 3" />
        <line x1={padding} x2={W-padding} y1={ny(8)} y2={ny(8)} stroke="currentColor" className="text-zinc-800" strokeDasharray="3 3" />
        <line x1={padding} x2={W-padding} y1={ny(10)} y2={ny(10)} stroke="currentColor" className="text-zinc-700" />
        <line x1={nx(xLine[0])} y1={ny(yLine[0])} x2={nx(xLine[1])} y2={ny(yLine[1])} stroke="currentColor" className="text-emerald-500" strokeWidth={2} />
        {points.map((p,i)=>(
          <g key={i}>
            <circle cx={nx(p.x)} cy={ny(p.y)} r={rScale(p.size)} className="text-emerald-400/90" fill="currentColor" />
            <circle cx={nx(p.x)} cy={ny(p.y)} r={Math.max(12, rScale(p.size)+4)} fill="white" fillOpacity="0" pointerEvents="all"
              onMouseEnter={(e)=>setHover({ ...toLocal(e), p })} onMouseMove={(e)=>setHover({ ...toLocal(e), p })} onMouseLeave={()=>setHover(null)} />
          </g>
        ))}
        <text x={W/2} y={H-4} textAnchor="middle" className="fill-current text-[11px] text-zinc-400">Runtime (min)</text>
        <text x={8} y={ny(10)} className="fill-current text-[10px] text-zinc-500">10</text>
        <text x={8} y={ny(8)} className="fill-current text-[10px] text-zinc-500">8</text>
        <text x={8} y={ny(6)} className="fill-current text-[10px] text-zinc-500">6</text>
        <text x={8} y={ny(4)} className="fill-current text-[10px] text-zinc-500">4</text>
      </svg>
      {hover && (
        <div className="pointer-events-none absolute rounded-lg border border-zinc-700/60 bg-zinc-900/90 px-3 py-2 text-xs shadow-xl"
            style={{left: Math.min(hover.x, W-200), top: Math.min(hover.y, H-70)}}>
          <div className="font-semibold">{hover.p.title}</div>
          <div>Runtime: {hover.p.x}′</div>
          <div>Avg: {formatScore(hover.p.y)} · Votes: {hover.p.size}</div>
        </div>
      )}
    </div>
  );
}
