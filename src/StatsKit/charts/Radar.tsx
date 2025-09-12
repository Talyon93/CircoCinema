
// charts/Radar.tsx
import React from "react";
import { linspace } from "../utils/math";
export function Radar({ axes, size=240 }:{ axes:Array<{label:string; value:number}>; size?:number; }){
  const R = size/2 - 24;
  const cx = size/2, cy = size/2;
  const N = Math.max(3, axes.length);
  const angle = (i:number)=> (Math.PI*2*i)/N - Math.PI/2;
  const frame = linspace(0.25, 1, 4).map((k,idx)=>{
    const pts = axes.map((_,i)=> { const a = angle(i), r = R*k; return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`; }).join(" L ");
    return <path key={idx} d={`M ${pts} Z`} fill="none" stroke="currentColor" className="text-zinc-800" />;
  });
  const dataPts = axes.map((ax,i)=>{ const a = angle(i), r = R*(ax.value||0); return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`; }).join(" L ");
  return (
    <svg width={size} height={size} className="block">
      {frame}
      {axes.map((ax,i)=>{ const a = angle(i); return <line key={i} x1={cx} y1={cy} x2={cx + R*Math.cos(a)} y2={cy + R*Math.sin(a)} className="text-zinc-800" stroke="currentColor" />; })}
      <path d={`M ${dataPts} Z`} fill="currentColor" className="text-emerald-500/30" />
      <path d={`M ${dataPts} Z`} fill="none" stroke="currentColor" className="text-emerald-400" />
      {axes.map((ax,i)=>{ const a = angle(i), r = R+10; const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
        return <text key={i} x={x} y={y} textAnchor={Math.cos(a)>0.1?"start":Math.cos(a)<-0.1?"end":"middle"} dy={Math.sin(a)>0.1?12:Math.sin(a)<-0.1?-4:4} className="fill-current text-[11px]">{ax.label}</text>; })}
    </svg>
  );
}
