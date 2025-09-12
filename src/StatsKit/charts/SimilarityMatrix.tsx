// charts/SimilarityMatrix.tsx
import React from "react";

type Cell = { i:number; j:number; corr:number; n:number };
type Props = { users:string[]; cells:Cell[] };

// helper: clamp + lerp colore rosso→grigio→verde
const clamp = (x:number, a:number, b:number)=> Math.max(a, Math.min(b, x));
function lerp(a:number, b:number, t:number){ return a + (b-a)*t; }
function colorForCorr(c:number){
  // c ∈ [-1,1] -> t ∈ [0,1]
  const t = clamp((c + 1) / 2, 0, 1);
  // due segmenti: rosso (#ef4444) → grigio (#9ca3af) → verde (#22c55e)
  const neg = [239, 68, 68], mid = [156, 163, 175], pos = [34, 197, 94];
  const col = t < 0.5
    ? [ lerp(neg[0], mid[0], t*2), lerp(neg[1], mid[1], t*2), lerp(neg[2], mid[2], t*2) ]
    : [ lerp(mid[0], pos[0], (t-0.5)*2), lerp(mid[1], pos[1], (t-0.5)*2), lerp(mid[2], pos[2], (t-0.5)*2) ];
  return `rgb(${col.map(x=>Math.round(x)).join(",")})`;
}

export function SimilarityMatrix({ users, cells }: Props){
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(520);
  const [hover, setHover] = React.useState<null | {i:number;j:number; corr:number; n:number; boxX:number; boxY:number}>(null);

  React.useEffect(()=>{
    if(!ref.current) return;
    const ro = new ResizeObserver(es => setW(Math.max(360, Math.floor(es[0].contentRect.width))));
    ro.observe(ref.current);
    return ()=>ro.disconnect();
  },[]);

  const N = users.length;
  if (!N) return null;

  // padding dinamico: spazio per le labels
  const longest = users.reduce((m,u)=> Math.max(m, u.length), 0);
  const padL = clamp(12 + longest*7.2, 80, 160);   // sinistra per labels riga
  const padT = clamp(16 + longest*7.2, 80, 220);   // TOP per labels colonna (verticali)
  const padR = 12, padB = 18;

  // cell responsive
  const availW = w - padL - padR;
  const cell = clamp(Math.floor(availW / N), 18, 18);
  const gridW = cell * N;
  const W = padL + gridW + padR;
  const H = padT + cell * N + padB;

  // comodo: indice -> (i,j)->cell
  const get = (i:number, j:number) => cells.find(c => c.i===i && c.j===j)!;

  function toLocal(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { boxX: e.clientX - r.left + 10, boxY: e.clientY - r.top + 10 };
  }

  const over = hover ? { ri: hover.i, cj: hover.j } : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="block">
       {/* Col labels verticali (−90°) */}
        {users.map((u, idx) => {
          const x = padL + idx*cell + cell/2;
          const y = padT - 60; // ⬅️ aumenta il valore negativo per alzarli ancora di più
          return (
            <text
              key={`col-${idx}`}
              x={x}
              y={y}
              transform={`rotate(-90 ${x} ${y})`}
              textAnchor="end"
              dominantBaseline="central"
              className={`fill-current text-[11px] ${over && over.cj===idx ? "opacity-100" : "opacity-80"}`}
            >
              {u}
            </text>
          );
        })}

        {/* Row labels */}
        {users.map((u, idx) => (
          <text
            key={`row-${idx}`}
            x={padL - 8}
            y={padT + idx*cell + cell*0.7}
            textAnchor="end"
            className={`fill-current text-[11px] ${over && over.ri===idx ? "opacity-100" : "opacity-80"}`}
          >
            {u}
          </text>
        ))}

        {/* Cornice griglia */}
        <rect
          x={padL-1}
          y={padT-1}
          width={gridW+2}
          height={cell*N+2}
          fill="none"
          stroke="currentColor"
          className="text-zinc-700"
          rx={6}
        />

        {/* Celle */}
        {Array.from({length:N*N}).map((_,k)=>{
          const i = Math.floor(k / N);
          const j = k % N;
          const c = get(i,j);
          const x = padL + j*cell;
          const y = padT + i*cell;

          const isDiag = i===j;
          const fill = isDiag ? "rgb(82,82,91)" /* zinc-700 */ : colorForCorr(c.corr);

          // attenua fuori da riga/colonna in hover
          const alpha =
            over
              ? (over.ri===i || over.cj===j ? 1 : 0.35)
              : 1;

          return (
            <g key={k}>
              <rect
                x={x+0.5} y={y+0.5}
                width={cell-1} height={cell-1}
                rx={3}
                fill={fill}
                opacity={alpha}
                onMouseEnter={(e)=> setHover({ ...toLocal(e), i, j, corr:c.corr, n:c.n })}
                onMouseMove={(e)=> setHover(prev => ({ ...(prev||{}), ...toLocal(e) }))}
                onMouseLeave={()=> setHover(null)}
              />
              {/* contorno su hover cella */}
              {hover && hover.i===i && hover.j===j && (
                <rect
                  x={x+0.5} y={y+0.5}
                  width={cell-1} height={cell-1}
                  rx={3}
                  fill="none"
                  stroke="white"
                  strokeWidth={1.2}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-zinc-700/60 bg-zinc-900/90 px-2.5 py-1.5 text-xs shadow-xl"
          style={{
            left: Math.min(Math.max(0, hover.boxX), W - 220),
            top:  Math.min(Math.max(0, hover.boxY), H - 60),
          }}
        >
          <div className="font-semibold">
            {users[hover.i]} <span className="opacity-60">×</span> {users[hover.j]}
          </div>
          <div className="mt-0.5 opacity-80">in comune: {hover.n}</div>
          <div className="mt-0.5">corr: {hover.corr.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
