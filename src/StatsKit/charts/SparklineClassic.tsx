
// charts/SparklineClassic.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
export function SparklineClassic({ data, height=120, padding=12 }:{ data:Array<{t:number; avg:number}>; height?:number; padding?:number; }){
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(420);
  React.useEffect(()=>{
    if (!ref.current) return;
    const ro = new ResizeObserver((e)=> setW(Math.max(260, Math.floor(e[0].contentRect.width))));
    ro.observe(ref.current); return ()=>ro.disconnect();
  },[]);
  if (!data.length) return <div className="h-[72px] text-sm text-zinc-500">No data</div>;
  const xs = data.map(d=>d.t), ys = data.map(d=>d.avg);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = 4, maxY = 10;
  const H = height, innerW = W - padding*2, innerH = H - padding*2;
  const nx = (x:number)=> padding + (maxX===minX?0.5:(x-minX)/(maxX-minX))*innerW;
  const ny = (y:number)=> padding + (1 - (y-minY)/(maxY-minY))*innerH;
  const pts = data.map(p=>({ x:nx(p.t), y:ny(p.avg), val:p.avg }));
  const d = pts.map((p,i)=> `${i?'L':'M'}${p.x},${p.y}`).join(' ');
  const yTicks = [4,5,6,7,8,9,10];
  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} className="block">
        {yTicks.map((y)=>(<line key={y} x1={padding} x2={W-padding} y1={ny(y)} y2={ny(y)} stroke="currentColor" className="text-zinc-800" strokeWidth={0.5} />))}
        <path d={`${d} L ${W - padding},${H - padding} L ${padding},${H - padding} Z`} fill="currentColor" className="text-emerald-500/10" />
        <path d={d} fill="none" strokeWidth={2.5} className="text-emerald-500" stroke="currentColor" />
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} className="text-emerald-500" fill="currentColor" />
            <circle cx={p.x} cy={p.y} r={12} fill="white" fillOpacity="0" pointerEvents="all">
              <title>{formatScore(p.val)}</title>
            </circle>
          </g>
        ))}
        {yTicks.map((y)=>(<text key={y} x={4} y={ny(y)+3} className="fill-current text-[10px] text-zinc-500">{y}</text>))}
      </svg>
    </div>
  );
}
