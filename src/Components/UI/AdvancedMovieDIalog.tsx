import React from "react";
import { createPortal } from "react-dom";
import { tmdbDetails, getPosterUrl, tmdbPersonImdbId } from "../../TMDBHelper";
import { ScoreDonut } from "./ScoreDonut";
import { VotesBar } from "./VotesBar";
import { formatScore } from "../../Utils/Utils";
import {
  X, Calendar, Timer, Film, Star, Globe, Languages, TrendingUp,
  Link as LinkIcon, Play, Tv, User, Clapperboard, Info
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { CompareRatingsCard } from "./CompareRatingsCard"; // <-- aggiorna il path se serve
import { QuotesAndTriviaSidebar } from "./QuotesAndTrivia";
import { fetchQuotesEn, fetchTriviaEn } from "../../TMDBHelper";

/* ---------- stats helpers ---------- */
const mean = (a:number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const median = (a:number[]) => { if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const variance = (a:number[]) => { if(!a.length) return null; const m=mean(a)!; return a.reduce((s,x)=>s+(x-m)**2,0)/a.length; };
const stdev  = (a:number[]) => { const v=variance(a); return v==null?null:Math.sqrt(v); };
const clamp  = (v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const quant  = (a:number[],p:number)=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const pos=(s.length-1)*p; const b=Math.floor(pos); const r=pos-b; return s[b+1]!=null?s[b]+r*(s[b+1]-s[b]):s[b]; };
const minmax = (a:number[]) => a.length ? [Math.min(...a), Math.max(...a)] as const : [null,null] as const;
const ci95   = (a:number[]) => { if(a.length<2) return null; const m=mean(a)!; const sd=stdev(a)!; const half=1.96*(sd/Math.sqrt(a.length)); return { lo:m-half, hi:m+half }; };
const skewness = (a:number[]) => { if(a.length<2) return null; const m=mean(a)!; const n=a.length; const s2=a.reduce((s,x)=>s+(x-m)**2,0)/n; const s3=a.reduce((s,x)=>s+(x-m)**3,0)/n; return s3/Math.pow(s2,1.5); };
const kurtosis = (a:number[]) => { if(a.length<2) return null; const m=mean(a)!; const n=a.length; const s2=a.reduce((s,x)=>s+(x-m)**2,0)/n; const s4=a.reduce((s,x)=>s+(x-m)**4,0)/n; return s4/(s2*s2)-3; };
const toHours = (m?:number)=> typeof m==="number" && m>0 ? `${Math.floor(m/60)}h ${m%60}m` : null;
const money = (n?:number)=> typeof n==="number" ? n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}) : null;

function Pill({children,icon:Icon,title,className=""}:{children:React.ReactNode;icon?:any;title?:string;className?:string}) {
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-700/70 px-2 py-0.5 text-xs text-zinc-200 ${className}`}>
      {Icon ? <Icon className="h-4 w-4 opacity-90" /> : null}
      {children}
    </span>
  );
}

/* ---------- small links ---------- */
function PersonLink({ id, name }: { id?: number; name: string }) {
  const base = id ? `https://www.themoviedb.org/person/${id}` : "#";
  const [href, setHref] = React.useState<string>(base);
  const prefetch = async () => {
    if (!id) return;
    const imdb = await tmdbPersonImdbId(Number(id));
    if (imdb) setHref(`https://www.imdb.com/name/${imdb}/`);
  };
  React.useEffect(() => { setHref(base); }, [base]);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onMouseEnter={prefetch}
       className="underline underline-offset-2 decoration-zinc-600 hover:decoration-zinc-400">
      {name}
    </a>
  );
}

function QuotesCardMini({ items }: { items: Array<{ text: string; by?: string }> }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 text-sm font-semibold text-zinc-200">Quotes</div>
      <ul className="space-y-2">
        {items.slice(0, 4).map((q, i) => (
          <li key={i} className="text-xs leading-relaxed text-zinc-300">
            <span className="text-zinc-400">“</span>
            {q.text}
            <span className="text-zinc-400">”</span>
            {q.by && <span className="ml-1 text-zinc-400">— {q.by}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TriviaCardMini({ items }: { items: Array<{ fact: string; source?: string }> }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 text-sm font-semibold text-zinc-200">Trivia</div>
      <ul className="space-y-2">
        {items.slice(0, 5).map((t, i) => (
          <li key={i} className="text-xs leading-relaxed text-zinc-300">
            • {t.fact}
            {t.source && <span className="ml-1 text-zinc-500">({t.source})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CastCard({ p }: { p: any }) {
  const img = p?.profile_path ? getPosterUrl(p.profile_path, "w185") : null;
  const tmdbLink = p?.id ? `https://www.themoviedb.org/person/${p.id}` : "#";
  const [href, setHref] = React.useState<string>(tmdbLink);
  const prefetch = async () => {
    if (!p?.id) return;
    const imdb = await tmdbPersonImdbId(Number(p.id));
    if (imdb) setHref(`https://www.imdb.com/name/${imdb}/`);
  };
  React.useEffect(() => { setHref(tmdbLink); }, [tmdbLink]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={prefetch}
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden hover:border-zinc-700 transition"
      title={p?.name || ""}
    >
      <div className="aspect-[2/3] bg-zinc-800">
        {img ? <img src={img} alt={p?.name || ""} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="p-2">
        <div className="truncate text-sm font-medium text-zinc-100">{p?.name}</div>
        {p?.character && <div className="truncate text-xs text-zinc-400">as {p.character}</div>}
      </div>
    </a>
  );
}


function scoreSimilarity(base: any, cand: any, baseKw: number[], baseGenres: number[]) {
  const g  = (cand?.genre_ids || (cand?.genres||[]).map((x:any)=>x.id)).filter(Boolean);
  const kw = (cand?.keywords?.keywords || cand?.keywords?.results || cand?.keywords || []).map((x:any)=>x.id).filter(Boolean);
  const set = <T,>(a:T[]) => new Set(a);
  const inter = (A:Set<any>, B:Set<any>) => [...A].filter(x=>B.has(x)).length;

  const G=set(baseGenres), Kg=set(g);
  const K=set(baseKw),     Kk=set(kw);

  const genreOverlap   = G.size ? inter(G, Kg)/Math.max(1,G.size) : 0;
  const keywordOverlap = K.size ? inter(K, Kk)/Math.max(1,K.size) : 0;

  const byear = Number(String(base?.release_date||"").slice(0,4))||null;
  const cyear = Number(String(cand?.release_date||"").slice(0,4))||null;
  const yearScore = (byear&&cyear) ? 1 - Math.min(15, Math.abs(byear-cyear))/15 : 0;

  const br = Number(base?.runtime)||null;
  const cr = Number(cand?.runtime)||null;
  const rtScore = (br&&cr) ? 1 - Math.min(60, Math.abs(br-cr))/60 : 0;

  const qa = Number(cand?.vote_average)||0;
  const qc = Math.max(0, Math.log((Number(cand?.vote_count)||0)+1));
  const qualScore = (qa/10) * (1 + qc/5);

  const pop = Number(cand?.popularity)||0;
  const popScore = Math.min(1, pop/200);

  return 3*genreOverlap + 2*keywordOverlap + yearScore + rtScore + 1.2*qualScore + 0.6*popScore;
}

function buildRankedSimilars(details:any) {
  const baseKw     = (details?.keywords?.keywords || details?.keywords?.results || []).map((k:any)=>k.id).filter(Boolean);
  const baseGenres = (details?.genres||[]).map((g:any)=>g.id).filter(Boolean);
  const sim  = (details?.similar?.results || []) as any[];
  const recs = (details?.recommendations?.results || []) as any[];

  const uniq = new Map<number,any>();
  [...recs, ...sim].forEach(m=>{ if(m?.id && !uniq.has(m.id)) uniq.set(m.id, m); });

  return [...uniq.values()]
    .map(m => ({ m, s: scoreSimilarity(details, m, baseKw, baseGenres) }))
    .sort((a,b)=>b.s-a.s)
    .map(x=>x.m);
}

function SimilarTile({ movie, href }: { movie:any; href:string }) {
  const poster = movie?.poster_path ? getPosterUrl(movie.poster_path, "w342") : null;
  const title  = movie?.title || movie?.name || "";
  const year   = String(movie?.release_date || movie?.first_air_date || "").slice(0,4);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-xl bg-zinc-900/40 shadow-sm shadow-black/30 transition hover:-translate-y-0.5 hover:shadow-black/50"
      onDragStart={(e)=>e.preventDefault()}
      title={title}
    >
      {poster ? (
        <img
          src={poster}
          alt={title}
          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          draggable={false}
          onDragStart={(e)=>e.preventDefault()}
        />
      ) : <div className="aspect-[2/3] w-full bg-zinc-800" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2">
        <div className="rounded-lg bg-black/60 px-2 py-1 text-[11px] leading-tight text-zinc-100 backdrop-blur">
          <div className="line-clamp-1 font-medium">{title}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-300/90">
            {year && <span>{year}</span>}
            <span className="mx-1">•</span>
            <span className="rounded-[4px] border border-yellow-600/30 bg-yellow-500/10 px-1 text-[10px] text-yellow-300">IMDb</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>
    </a>
  );
}


export function AdvancedMovieDialog({
  open,
  onClose,
  viewing,
}: {
  open: boolean;
  onClose: () => void;
  viewing: any;
}) {
  const v = viewing;
  const [details, setDetails] = React.useState<any>(null);

// NEW: quotes & trivia (EN)
const [quotesEn, setQuotesEn] = React.useState<Array<{ text: string; by?: string }>>([]);
const [triviaEn, setTriviaEn] = React.useState<Array<{ fact: string; source?: string }>>([]);


// ----- Similar movies state -----
const rankedSimilars = React.useMemo(
  () => (details ? buildRankedSimilars(details).slice(0, 12) : []),
  [details] // non solo [details?.id]
);

const [similarHrefMap, setSimilarHrefMap] = React.useState<Record<number,string>>({});
React.useEffect(() => {
  let alive = true;
  (async () => {
    if (!rankedSimilars.length) { if (alive) setSimilarHrefMap({}); return; }
    const out: Record<number,string> = {};
    await Promise.all(
      rankedSimilars.map(async (m:any) => {
        const det = await tmdbDetails(Number(m.id));
        const imdb = det?.external_ids?.imdb_id || det?.imdb_id;
        out[m.id] = imdb ? `https://www.imdb.com/title/${imdb}/` : `https://www.themoviedb.org/movie/${m.id}`;
      })
    );
    if (alive) setSimilarHrefMap(out);
  })();
  return () => { alive = false; };
}, [rankedSimilars]);

// ----- Horizontal scroller (drag + fling + progress) -----
const simRowRef = React.useRef<HTMLDivElement|null>(null);
const [scrollProgress, setScrollProgress] = React.useState(0);
const updateProgress = React.useCallback(()=>{
  const el = simRowRef.current;
  if (!el) return setScrollProgress(0);
  const p = el.scrollWidth > el.clientWidth ? el.scrollLeft/(el.scrollWidth-el.clientWidth) : 0;
  setScrollProgress(clamp(p,0,1));
},[]);

type DragState = {
  active:boolean; moved:boolean;
  startX:number; startLeft:number;
  lastX:number; lastT:number; vel:number; raf:number|null; pointerId:number|null;
};
const drag = React.useRef<DragState>({
  active:false, moved:false,
  startX:0, startLeft:0,
  lastX:0, lastT:0, vel:0, raf:null, pointerId:null
});

const dragState = React.useRef<{
  active: boolean;
  moved: boolean;
  startX: number; startLeft: number;
  lastX: number; lastT: number; vel: number;
  raf?: number | null;
  pid?: number | null;          // << aggiunto
}>({
  active: false,
  moved: false,
  startX: 0, startLeft: 0,
  lastX: 0, lastT: 0, vel: 0,
  raf: null,
  pid: null,                    // << aggiunto
});

const stopFling = () => {
  if (drag.current.raf) cancelAnimationFrame(drag.current.raf);
  drag.current.raf = null;
};

const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  const el = simRowRef.current; if (!el) return;
  if (dragState.current.raf) { cancelAnimationFrame(dragState.current.raf as number); dragState.current.raf = null; }
  dragState.current.pid = e.pointerId;     // << track id
  dragState.current.active = false;
  dragState.current.moved = false;
  dragState.current.startX = e.clientX;
  dragState.current.startLeft = el.scrollLeft;
  dragState.current.lastX = e.clientX;
  dragState.current.lastT = performance.now();
  dragState.current.vel = 0;
  (e.currentTarget as HTMLElement).style.cursor = "grab";
};


const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  const el = simRowRef.current; if (!el) return;
  if (dragState.current.pid !== e.pointerId) return; // << solo il nostro puntatore

  // tasto primario giù? (mouse) / touch in pressione?
  const primaryDown = e.buttons === 1 || e.pointerType === "touch" || e.pressure > 0;
  if (!primaryDown) return;                           // << blocca ri-attivazioni post-up

  const dx = e.clientX - dragState.current.startX;

  if (!dragState.current.active && Math.abs(dx) > 5) {
    dragState.current.active = true;
    dragState.current.moved = true;
    el.setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  }
  if (!dragState.current.active) return;

  el.scrollLeft = dragState.current.startLeft - dx;

  const now = performance.now();
  const dt = now - dragState.current.lastT || 16;
  dragState.current.vel =
    0.8 * dragState.current.vel + 0.2 * ((dragState.current.lastX - e.clientX) / dt);
  dragState.current.lastX = e.clientX;
  dragState.current.lastT = now;

  updateProgress();
};

const endDrag = ()=>{
  const el = simRowRef.current; if (!el) return;
  // nessuna inerzia se non veramente trascinato
  if (!drag.current.active || !drag.current.moved) { drag.current.active=false; drag.current.moved=false; drag.current.vel=0; return; }

  drag.current.active=false;
  let v = drag.current.vel*16; // px/frame
  const MIN_V = 2;
  const step = ()=>{
    v *= 0.95;
    if (Math.abs(v) < MIN_V) { stopFling(); drag.current.moved=false; drag.current.vel=0; return; }
    el.scrollLeft += v;
    updateProgress();
    drag.current.raf = requestAnimationFrame(step);
  };
  stopFling();
  drag.current.raf = requestAnimationFrame(step);
};

const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
  const el = simRowRef.current; if (!el) return;
  if (dragState.current.pid !== e.pointerId) return;  // ignora up di altri puntatori

  try { el.releasePointerCapture(e.pointerId); } catch {}
  (e.currentTarget as HTMLElement).style.cursor = "grab";

  const MIN_V = 2;
  const v0 = dragState.current.vel * 16;

  // reset immediato per permettere il click
  const hadDrag = dragState.current.active;
  dragState.current.active = false;
  dragState.current.moved  = false;   // << importante per far passare il click
  dragState.current.pid    = null;    // << reset id

  if (!hadDrag || Math.abs(v0) < MIN_V) {
    if (dragState.current.raf) { cancelAnimationFrame(dragState.current.raf as number); dragState.current.raf = null; }
    dragState.current.vel = 0;
    return;
  }

  let v = v0;
  const step = () => {
    v *= 0.95;
    if (Math.abs(v) < MIN_V) {
      dragState.current.raf = null;
      dragState.current.vel = 0;
      return;
    }
    el.scrollLeft += v;
    updateProgress();
    dragState.current.raf = requestAnimationFrame(step);
  };
  if (dragState.current.raf) cancelAnimationFrame(dragState.current.raf as number);
  dragState.current.raf = requestAnimationFrame(step);
};


// sicurezza: se il mouse esce dalla finestra, ferma
React.useEffect(()=>{
  const stop = ()=>{ stopFling(); drag.current.active=false; drag.current.moved=false; drag.current.vel=0; };
  window.addEventListener("mouseup", stop);
  window.addEventListener("mouseleave", stop);
  window.addEventListener("blur", stop);
  return ()=>{ window.removeEventListener("mouseup", stop); window.removeEventListener("mouseleave", stop); window.removeEventListener("blur", stop); };
},[]);

// sync progress on scroll/resize
React.useEffect(()=>{
  const el = simRowRef.current; if (!el) return;
  updateProgress();
  const onScroll = ()=>updateProgress();
  el.addEventListener("scroll", onScroll, { passive:true });
  window.addEventListener("resize", updateProgress);
  return ()=>{ el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", updateProgress); };
}, [rankedSimilars, updateProgress]);

const pageScroll = (dir:1|-1)=>{
  const el = simRowRef.current; if (!el) return;
  el.scrollBy({ left: dir * Math.round(el.clientWidth*0.9), behavior:"smooth" });
};



React.useEffect(() => {
  if (!open) return;
  let alive = true;

  (async () => {
    // IMDb ID sicuro: prima dal movie, poi da TMDB external_ids
    const imdbIdSafe =
      v?.movie?.imdb_id ||
      details?.external_ids?.imdb_id ||
      details?.imdb_id ||
      null;

    // Se non abbiamo ancora l'IMDb ID ma abbiamo il tmdb_id, aspetta il prossimo render
    if (!imdbIdSafe && (v?.movie?.tmdb_id || v?.movie?.id)) return;

    const movieForFetch = {
      id: v?.movie?.tmdb_id || v?.movie?.id,
      imdb_id: imdbIdSafe,
      title: v?.movie?.title || details?.title,
    };

    try {
      const [q, t] = await Promise.all([
        fetchQuotesEn(movieForFetch),
        fetchTriviaEn(movieForFetch),
      ]);
      if (alive) {
        setQuotesEn(Array.isArray(q) ? q : []);
        setTriviaEn(Array.isArray(t) ? t : []);
      }
    } catch {
      if (alive) {
        setQuotesEn([]);
        setTriviaEn([]);
      }
    }
  })();

  return () => { alive = false; };
}, [
  open,
  v?.movie?.tmdb_id,
  v?.movie?.id,
  v?.movie?.imdb_id,
  details?.external_ids?.imdb_id, // <-- trigger quando arrivano gli external_ids
]);


  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const tmdbId = (v?.movie?.tmdb_id || v?.movie?.id) as number | undefined;
      if (!tmdbId) { setDetails(null); return; }
      try {
        // tmdbDetails deve includere: credits, keywords, release_date, runtime, genres,
        // production_countries, spoken_languages, popularity, imdb_id, status, budget, revenue, backdrop_path
        const det = await tmdbDetails(tmdbId);
        if (alive) setDetails(det || null);
      } catch { if (alive) setDetails(null); }
    })();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { alive = false; document.removeEventListener("keydown", onKey); };
  }, [open, v?.movie?.tmdb_id, v?.movie?.id, onClose]);

  if (!open) return null;

  /* ---------- merge ---------- */
  const title = v?.movie?.title || details?.title || "Untitled";
  const release_date = v?.movie?.release_date || details?.release_date;
  const year = release_date ? String(release_date).slice(0,4) : (v?.movie?.release_year ?? null);
  const runtime = v?.movie?.runtime ?? details?.runtime;
  const genres = (Array.isArray(v?.movie?.genres) ? v.movie.genres : details?.genres) || [];
  const countries = (v?.movie?.production_countries ?? details?.production_countries) || [];
  const languages = (v?.movie?.spoken_languages ?? details?.spoken_languages) || [];
  const imdb_id = v?.movie?.imdb_id || details?.imdb_id;
  const tmdb_avg = typeof v?.movie?.tmdb_vote_average === "number" ? v.movie.tmdb_vote_average : details?.vote_average;
  const tmdb_votes = typeof v?.movie?.tmdb_vote_count === "number" ? v.movie.tmdb_vote_count : details?.vote_count;
  const popularity = v?.movie?.popularity ?? details?.popularity;
  const status = details?.status;
  const budget = details?.budget;
  const revenue = details?.revenue;
  const keywords = (details?.keywords?.keywords || details?.keywords?.results || []) as any[];
  const poster_path = v?.movie?.poster_path || details?.poster_path;
  const backdrop_path = v?.movie?.backdrop_path || details?.backdrop_path;
  const poster = poster_path ? getPosterUrl(poster_path, "w500") : "";
  const backdrop = backdrop_path ? getPosterUrl(backdrop_path, "w1280") : "";

  /* ---------- local ratings (aggregate only) ---------- */
  const ratings = (v?.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, s]) => Number(s)).filter(Number.isFinite);
  const avg = scores.length ? mean(scores) : null;
  const med = median(scores);
  const sd  = stdev(scores);
  const [mn, mx] = minmax(scores);
  const q1 = quant(scores, 0.25); const q3 = quant(scores, 0.75); const iqr = q1!=null && q3!=null ? q3-q1 : null;
  const likeRate = scores.length ? (scores.filter(s => s >= 8).length / scores.length) : null;
  const ci = ci95(scores);
  const sk = skewness(scores);
  const ku = kurtosis(scores);

  // distribuzione (bucket 0.5)
  const dist = Array.from({length: 19}, (_,i) => {
    const xnum = 1 + i*0.5; const x = xnum.toFixed(1);
    const count = scores.reduce((c,s)=> c + (Math.round((clamp(s,1,10)-1)/0.5)===i?1:0), 0);
    return { x, xnum, count };
  });
  const maxCount = Math.max(1, ...dist.map(d=>d.count));

  /* ---------- credits ---------- */
  const cast = Array.isArray(details?.credits?.cast) ? details.credits.cast.slice(0, 12) : [];
  const crew = Array.isArray(details?.credits?.crew) ? details.credits.crew : [];
  const directors = crew.filter((c:any)=>String(c?.job).toLowerCase()==="director").slice(0,3);
  const writers   = crew.filter((c:any)=>/writer|screenplay/i.test(String(c?.job))).slice(0,3);

  /* ---------- links ---------- */
  const jwLink  = title ? `https://www.justwatch.com/it/ricerca?q=${encodeURIComponent(title)}` : "#";
  const netflix = title ? `https://www.netflix.com/search?q=${encodeURIComponent(title)}` : "#";
  const prime   = title ? `https://www.primevideo.com/search?phrase=${encodeURIComponent(title)}` : "#";
  const imdbUrl = imdb_id ? `https://www.imdb.com/title/${imdb_id}/` : null;
  const tmdbUrl = details?.id ? `https://www.themoviedb.org/movie/${details.id}` : null;


  // Trailer (TMDB -> YouTube)
  const videos = (details?.videos?.results ?? []) as any[];
  const trailer =
    videos.find(v => v?.site === "YouTube" && v?.type === "Trailer" && v?.official) ||
    videos.find(v => v?.site === "YouTube" && v?.type === "Trailer") ||
    videos.find(v => v?.site === "YouTube"); // fallback
  const trailerKey = trailer?.key as string | undefined;

  // Recensioni
  const tmdbReviews = (details?.reviews?.results ?? []) as any[];
  const imdbReviewsUrl = imdb_id ? `https://www.imdb.com/title/${imdb_id}/reviews?sort=userRating&dir=desc` : null;

  // Foto (backdrop/poster/stills)
  const backdrops = (details?.images?.backdrops ?? []) as any[];
  const stills    = (details?.images?.stills ?? []) as any[];
  const postersI  = (details?.images?.posters ?? []) as any[];
  const photos = [...backdrops, ...stills, ...postersI].slice(0, 12);


const imdbAvgRef = typeof v?.movie?.imdb_rating === "number" ? v.movie.imdb_rating : null;

// Delta (our avg − IMDb)
const deltaData =
  imdbAvgRef != null && avg != null
    ? [{
        t: Date.parse(v?.started_at || v?.movie?.release_date || new Date().toISOString()),
        val: Number((avg - imdbAvgRef).toFixed(2)),
        title, // opzionale, lo supporta
        label: `${formatScore(avg)} vs IMDb ${formatScore(imdbAvgRef)}`, // opzionale
      }]
    : [];
  
    
return createPortal(
  <div
    className="fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto bg-black/75 p-4"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      className="relative w-full max-w-[1280px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Hero */}
      <div className="relative">
        {backdrop ? (
          <img src={backdrop} alt="" className="h-[260px] md:h-[300px] w-full object-cover opacity-35" />
        ) : (
          <div className="h-20 w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 md:px-6">
        <h4 className="truncate text-xl font-semibold">
          {title}{year ? ` (${year})` : ""}
        </h4>
        <div className="flex items-center gap-2">
          {imdbUrl && (
            <a href={imdbUrl} target="_blank" rel="noreferrer"
               className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs hover:bg-zinc-900">
              <LinkIcon className="mr-1 inline h-4 w-4" /> IMDb
            </a>
          )}
          {tmdbUrl && (
            <a href={tmdbUrl} target="_blank" rel="noreferrer"
               className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs hover:bg-zinc-900">
              <LinkIcon className="mr-1 inline h-4 w-4" /> TMDB
            </a>
          )}
          <button onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-sm hover:bg-zinc-900">
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid gap-6 lg:gap-8 p-4 md:grid-cols-[260px,1fr,320px] md:p-6">
        {/* LEFT: Poster + providers */}
        <div>
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="h-[390px] w-[260px] rounded-2xl border border-zinc-800 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-[390px] w-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-xs text-zinc-400">
              No poster
            </div>
          )}
          <div className="mt-3 space-y-2">
            <a href={jwLink} target="_blank" rel="noreferrer"
               className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs hover:bg-zinc-900">
               <Play className="h-4 w-4" /> JustWatch
            </a>
<div className="mt-4">
<CompareRatingsCard
  ourAvg={avg ?? null}
  imdbAvg={typeof v?.movie?.imdb_rating === "number" ? v.movie.imdb_rating : null}
  votes={entries.length}
/>

</div>
<div className="mt-4">
  <QuotesAndTriviaSidebar
    quotes={quotesEn}       // Array<{ text, by? }>
    trivia={triviaEn}       // Array<{ fact, source? }>
  />
  {(!quotesEn?.length && !triviaEn?.length) && (
    <div className="mt-2 text-[11px] text-zinc-500">No quotes or trivia found.</div>
  )}
</div>

          </div>
        </div>

        {/* CENTER: Main */}
        <div className="min-w-0">
          {/* meta pills */}
          <div className="mb-4 flex flex-wrap items-center gap-2 lg:gap-2.5">
            {year && <Pill icon={Calendar}>{year}</Pill>}
            {typeof runtime === "number" && runtime > 0 && <Pill icon={Timer}>{toHours(runtime) || `${runtime} min`}</Pill>}
            {!!genres?.length && <Pill icon={Film}>{genres.map((g:any)=>g?.name).filter(Boolean).join(", ")}</Pill>}
            {!!countries?.length && <Pill icon={Globe}>{countries.map((c:any)=>c?.name || c?.iso_3166_1).filter(Boolean).join(", ")}</Pill>}
            {!!languages?.length && <Pill icon={Languages}>{languages.map((l:any)=>l?.english_name || l?.name).filter(Boolean).join(", ")}</Pill>}
            {typeof tmdb_avg === "number" && (
              <Pill icon={Star} title={`${tmdb_votes?.toLocaleString?.() || ""} votes`}>TMDB {formatScore(tmdb_avg)}</Pill>
            )}
            {typeof popularity === "number" && <Pill icon={TrendingUp}>Pop {formatScore(popularity)}</Pill>}
          </div>

          {/* overview */}
          <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
            {(v?.movie?.overview || details?.overview || "").trim() || "No description available."}
          </p>

          {/* Trailer */}
          {trailerKey && (
            <div className="mb-6 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4 lg:p-5">
              <div className="mb-2 text-sm font-semibold text-zinc-200">Trailer</div>
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-md">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${trailerKey}`}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Foto */}
          {photos.length > 0 && (
            <div className="mb-6 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4 lg:p-5">
              <div className="mb-3 text-sm font-semibold text-zinc-200">Foto</div>
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {photos.map((ph:any, idx:number) => {
                  const thumb = ph?.file_path ? getPosterUrl(ph.file_path, "w300") : null;
                  const full  = ph?.file_path ? getPosterUrl(ph.file_path, "original") : "#";
                  return (
                    <a key={`${ph?.file_path || idx}`} href={full} target="_blank" rel="noopener noreferrer"
                       className="group overflow-hidden rounded-xl border border-zinc-800/70 shadow-lg" title="Apri immagine">
                      {thumb ? (
                        <img src={thumb} alt="" loading="lazy"
                             className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="aspect-video bg-zinc-800" />
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top cast */}
          {!!cast.length && (
            <div className="mb-6">
              <div className="mb-3 text-sm font-semibold text-zinc-200">Top cast</div>
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {cast.map((p:any) => <CastCard key={`${p?.id}-${p?.name}`} p={p} />)}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT: Facts sidebar */}
<aside className="space-y-3">
  
          {/* IMDb-like quick credits */}
          {(directors.length || writers.length || (Array.isArray(details?.credits?.cast) && details.credits.cast.length)) && (
            <div className="mb-2 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 px-4 py-3 lg:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Clapperboard className="h-4 w-4" /> Crew
              </div>
              <div className="space-y-2 text-sm">
                {directors.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-28 shrink-0 text-zinc-400">Regia</div>
                    <div className="min-w-0">
                      {directors.map((p:any, i:number) => (
                        <React.Fragment key={p?.id || p?.name}>
                          <PersonLink id={p?.id} name={p?.name} />
                          {i < directors.length - 1 ? <span className="mx-2 text-zinc-500">·</span> : null}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
                {writers.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-28 shrink-0 text-zinc-400">Sceneggiatura</div>
                    <div className="min-w-0">
                      {writers.map((p:any, i:number) => (
                        <React.Fragment key={p?.id || p?.name}>
                          <PersonLink id={p?.id} name={p?.name} />
                          {i < writers.length - 1 ? <span className="mx-2 text-zinc-500">·</span> : null}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
  <div className="rounded-2xl border border-zinc-800 p-4">
    <div className="mb-2 text-sm font-semibold text-zinc-200">Facts</div>
    <dl className="space-y-1 text-sm">
      {status && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Status</dt>
          <dd className="text-zinc-200">{status}</dd>
        </div>
      )}
      {release_date && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Release</dt>
          <dd className="text-zinc-200">
            {new Date(release_date).toLocaleDateString()}
          </dd>
        </div>
      )}
      {languages?.length > 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Language</dt>
          <dd className="text-zinc-200 truncate">
            {languages.map((l: any) => l.english_name || l.name).join(", ")}
          </dd>
        </div>
      )}
      {money(budget) && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Budget</dt>
          <dd className="text-zinc-200">{money(budget!)}</dd>
        </div>
      )}
      {money(revenue) && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Revenue</dt>
          <dd className="text-zinc-200">{money(revenue!)}</dd>
        </div>
      )}
      {typeof tmdb_avg === "number" && (
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">TMDB</dt>
          <dd className="text-zinc-200">
            {formatScore(tmdb_avg)} ({tmdb_votes?.toLocaleString?.() || "0"})
          </dd>
        </div>
      )}
    </dl>
  </div>

  {!!keywords?.length && (
    <div className="rounded-2xl border border-zinc-800 p-4">
      <div className="mb-2 text-sm font-semibold text-zinc-200">Keywords</div>
      <div className="flex flex-wrap gap-2">
        {keywords.slice(0, 18).map((k: any) => (
          <span
            key={k?.id || k?.name}
            className="rounded-full border border-zinc-700/70 px-2 py-0.5 text-xs text-zinc-300"
          >
            {k?.name}
          </span>
        ))}
      </div>
    </div>
  )}


  {/* User reviews moved here */}
  {(tmdbReviews?.length || imdbReviewsUrl) && (
    <div className="rounded-2xl border border-zinc-800/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">
          Recensioni degli utenti
        </div>
        {imdbReviewsUrl && (
          <a
            href={imdbReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs hover:bg-zinc-900"
            title="Apri le recensioni su IMDb"
          >
            IMDb reviews →
          </a>
        )}
      </div>
      {tmdbReviews?.length ? (
        <ul className="space-y-3">
          {tmdbReviews.slice(0, 3).map((r: any) => {
            const rating = r?.author_details?.rating;
            const date = r?.created_at ? new Date(r.created_at) : null;
            return (
              <li
                key={r?.id}
                className="rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-3"
              >
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-zinc-100">
                    {r?.author || "Anon"}
                  </span>
                  {typeof rating === "number" && (
                    <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      {rating}/10
                    </span>
                  )}
                  {date && (
                    <span className="text-xs text-zinc-500">
                      {date.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="line-clamp-5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                  {(r?.content || "").trim()}
                </p>
                {r?.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
                  >
                    Leggi su TMDB
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-xs text-zinc-500">
          Nessuna recensione disponibile qui. Prova su IMDb.
        </div>
      )}
    </div>
  )}
</aside>

      </div>

      {rankedSimilars.length > 0 && (
  <div className="mt-4 px-4 md:px-6">
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">
          Similar movies <span className="ml-1 text-xs text-zinc-400">({rankedSimilars.length})</span>
        </div>
        <div className="hidden md:block w-32 h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-zinc-200" style={{ width: `${Math.round(scrollProgress*100)}%` }} />
        </div>
      </div>

      <div
        ref={simRowRef}
        className="no-scrollbar overflow-x-auto pb-2 outline-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={(e) => {
          // se hai trascinato, sopprimi il click
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        tabIndex={0}
        onKeyDown={(e)=>{
          if (e.key==="ArrowLeft")  { e.preventDefault(); pageScroll(-1); }
          if (e.key==="ArrowRight") { e.preventDefault(); pageScroll(1); }
        }}
      >
        <div className="flex snap-x snap-mandatory gap-3 md:gap-4">
          {rankedSimilars.map((m:any)=>(
            <div key={m.id} className="w-[150px] sm:w-[170px] md:w-[190px] lg:w-[200px] flex-none snap-start">
              <SimilarTile
                movie={m}
                href={similarHrefMap[m.id] || `https://www.themoviedb.org/movie/${m.id}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* gradient edge masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-950/95 via-zinc-950/60 to-transparent rounded-l-2xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-950/95 via-zinc-950/60 to-transparent rounded-r-2xl" />
    </div>
  </div>
)}

    </div>
  </div>,
  document.body
);


}
