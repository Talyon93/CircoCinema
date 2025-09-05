import React, { useEffect, useState } from "react";

/**
 * Circo Cinema – con sessione di voto (demo senza backend)
 *
 * Flusso "Vota":
 * 1) "Avvia votazione" su un film → salva sessione attiva in localStorage
 * 2) Chi entra mentre è attiva vede il film e può votare subito
 * 3) "Termina votazione" → sposta nei "Storico" con tutti i voti, pulisce sessione
 */

// ============================
// 🔧 CONFIG
// ============================
const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";

// Storage keys
const K_USER = "cn_user";
const K_VIEWINGS = "cn_viewings";
const K_ACTIVE_VOTE = "cn_active_vote";
const K_ACTIVE_RATINGS = "cn_active_ratings";

// ============================
// 🧠 Utilities
// ============================
async function tmdbSearch(query: string) {
  const q = (query || "").trim();
  if (!q) return [] as any[];
  try {
    if (!TMDB_API_KEY) return [];
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&language=it-IT`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []) as any[];
  } catch {
    return [];
  }
}

async function tmdbDetails(tmdbId: number) {
  try {
    if (!TMDB_API_KEY) return null;
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function posterUrl(p?: string, size: "w185" | "w342" = "w185") {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

function formatScore(n: number) {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
function roundToQuarter(n: number) { return Math.round(n / 0.25) * 0.25; }

function lsGetJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function lsSetJSON(key: string, value: any) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

// ============================
// 🎬 UI
// ============================
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl shadow p-4 bg-white border border-gray-200">{children}</div>;
}

function Header({ user, onLogout, tab, setTab }: { user: string; onLogout: () => void; tab: "vota" | "storico"; setTab: (t: "vota" | "storico") => void }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-2">
      <h1 className="text-2xl font-bold">🎞️ Circo Cinema</h1>
      <div className="flex items-center gap-4">
        <nav className="flex gap-2">
          <button onClick={()=>setTab("vota")} className={`px-3 py-2 rounded-xl border ${tab==='vota' ? 'bg-black text-white' : 'bg-white'}`}>Vota</button>
          <button onClick={()=>setTab("storico")} className={`px-3 py-2 rounded-xl border ${tab==='storico' ? 'bg-black text-white' : 'bg-white'}`}>Storico</button>
        </nav>
        <span className="text-sm">Ciao, <b>{user}</b></span>
        <button onClick={onLogout} className="px-3 py-1 rounded-xl border">Esci</button>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="max-w-md mx-auto mt-24">
      <Card>
        <h2 className="text-xl font-semibold mb-2">Entra con un nome</h2>
        <p className="text-sm text-gray-600 mb-4">Scegli un nome: sarà il tuo nickname.</p>
        <div className="flex gap-2">
          <input className="flex-1 border rounded-xl px-3 py-2" placeholder="Es. Tommy" value={name} onChange={e=>setName(e.target.value.trimStart())}/>
          <button className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-30" disabled={!name} onClick={()=>onLogin(name)}>Entra</button>
        </div>
      </Card>
    </div>
  );
}

function SearchMovie({ onPick }: { onPick: (movie: any) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    setErr(null); setLoading(true);
    try {
      const res = await tmdbSearch(q);
      setResults(res.slice(0, 12));
    } catch (e: any) {
      setErr(e?.message || "Errore di ricerca");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm">Cerca film</label>
          <input className="w-full border rounded-xl px-3 py-2" placeholder="Es. Matrix" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter' && search()} />
        </div>
        <button onClick={search} className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-30" disabled={!q || loading}>{loading? '...' : 'Cerca'}</button>
      </div>
      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {results.map((r) => (
          <div key={r.id} className="flex gap-3 border rounded-xl p-2 hover:bg-gray-50 cursor-pointer" onClick={()=>onPick(r)}>
            {r.poster_path && <img src={posterUrl(r.poster_path, 'w185')} alt={r.title} className="w-16 h-24 object-cover rounded-lg"/>}
            <div className="flex-1">
              <div className="font-semibold">{r.title} {r.release_date ? <span className="text-gray-500">({r.release_date?.slice(0,4)})</span> : null}</div>
              <div className="text-sm line-clamp-3 text-gray-700">{r.overview}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RatingBar({ value, onChange }: { value: number; onChange: (v:number)=>void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={1} max={10} step={0.25} value={value} onChange={(e)=>onChange(parseFloat((e.target as HTMLInputElement).value))} className="w-full" />
      <div className="w-12 text-center font-semibold">{formatScore(value)}</div>
    </div>
  );
}

function MovieCard({ movie, onStartVoting }: { movie: any; onStartVoting: (m:any)=>void }) {
  return (
    <Card>
      <div className="flex gap-4">
        {movie.poster_path && <img src={posterUrl(movie.poster_path, 'w342')} className="w-32 h-48 object-cover rounded-xl" alt={movie.title}/>} 
        <div className="flex-1">
          <h3 className="text-xl font-bold">{movie.title} {movie.release_date ? <span className="text-gray-500">({movie.release_date.slice(0,4)})</span>:null}</h3>
          <p className="mt-1 text-gray-700 whitespace-pre-wrap">{movie.overview}</p>
          <div className="flex gap-2 mt-3">
            <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={()=>onStartVoting(movie)}>Avvia votazione</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ActiveVoting({ movie, currentUser, onRate, onEnd, ratings }: { movie: any; currentUser: string; onRate: (score:number)=>void; onEnd: ()=>void; ratings: Record<string, number> }) {
  const you = ratings[currentUser];
  const allScores = Object.values(ratings).map(Number) as number[];
  const avg = allScores.length ? (allScores.reduce((a,b)=>a+b,0)/allScores.length) : null;
  return (
    <Card>
      <div className="flex gap-4">
        {movie.poster_path && <img src={posterUrl(movie.poster_path, 'w342')} className="w-32 h-48 object-cover rounded-xl" alt={movie.title}/>} 
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold">Votazione in corso · {movie.title}</h3>
            {avg !== null && <div className="ml-auto text-sm">Media provvisoria: <b>{formatScore(avg)}</b> ({allScores.length} voti)</div>}
          </div>
          <p className="mt-1 text-gray-700 line-clamp-3">{movie.overview}</p>
          <div className="mt-3">
            <div className="text-sm mb-1">Il tuo voto: {you ? <b>{formatScore(you)}</b> : <i>non votato</i>}</div>
            <RatingBar value={you ?? 7} onChange={(v)=>onRate(roundToQuarter(v))} />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-4 py-2 rounded-xl border" onClick={onEnd}>Termina votazione</button>
          </div>
          {Object.keys(ratings).length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="mr-2">Voti:</span>
              {Object.entries(ratings).map(([n,s]) => (
                <span key={n} className="mr-2">{n}: <b>{formatScore(Number(s))}</b></span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function HistoryCard({ v }: { v: any }) {
  const ratings = v.ratings || {} as Record<string, number>;
  const allScores = Object.values(ratings).map(Number) as number[];
  const avg = allScores.length ? (allScores.reduce((a,b)=>a+b,0)/allScores.length) : null;
  return (
    <Card>
      <div className="flex gap-4">
        {v.movie.poster_path && <img src={posterUrl(v.movie.poster_path, 'w185')} className="w-16 h-24 object-cover rounded-lg"/>}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <div className="font-semibold">{v.movie.title}</div>
            <div className="text-xs text-gray-500">{new Date(v.started_at).toLocaleString()}</div>
            {avg !== null && <div className="ml-auto text-sm">Media: <b>{formatScore(avg)}</b> ({allScores.length} voti)</div>}
          </div>
          <div className="text-sm text-gray-700 line-clamp-2">{v.movie.overview}</div>
          {Object.keys(ratings).length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="mr-2">Voti:</span>
              {Object.entries(ratings).map(([n,s])=> (
                <span key={n} className="mr-2">{n}: <b>{formatScore(Number(s))}</b></span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function CinemaNightApp() {
  const [user, setUser] = useState<string>("");
  const [picked, setPicked] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tab, setTab] = useState<'vota' | 'storico'>("vota");

  // Active vote state (demo)
  const [activeVote, setActiveVote] = useState<any | null>(null); // { id, movie, started_at }
  const [activeRatings, setActiveRatings] = useState<Record<string, number>>({});

  // Init
  useEffect(() => {
    const saved = lsGetJSON<string | null>(K_USER, "") || "";
    setUser(saved);
    setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
    setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
    setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));

    // sync tra tab (stesso browser)
    const onStorage = (e: StorageEvent) => {
      if (e.key === K_ACTIVE_VOTE) setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
      if (e.key === K_ACTIVE_RATINGS) setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));
      if (e.key === K_VIEWINGS) setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (name: string) => { localStorage.setItem(K_USER, name); setUser(name); };
  const logout = () => { localStorage.removeItem(K_USER); setUser(""); };

  const onPick = async (res: any) => { const details = await tmdbDetails(res.id); setPicked(details || res); };

  const startVoting = (movie: any) => {
    const session = { id: Date.now(), movie, started_at: new Date().toISOString() };
    lsSetJSON(K_ACTIVE_VOTE, session);
    lsSetJSON(K_ACTIVE_RATINGS, {});
    setActiveVote(session);
    setActiveRatings({});
  };

  const rateActive = (score: number) => {
    if (!activeVote || !user) return;
    const fixed = roundToQuarter(score);
    const next = { ...activeRatings, [user]: fixed };
    lsSetJSON(K_ACTIVE_RATINGS, next);
    setActiveRatings(next);
  };

  const endVoting = () => {
    if (!activeVote) return;
    const entry = { id: activeVote.id, started_at: activeVote.started_at, movie: activeVote.movie, ratings: activeRatings };
    const L = lsGetJSON<any[]>(K_VIEWINGS, []);
    L.unshift(entry);
    lsSetJSON(K_VIEWINGS, L);
    localStorage.removeItem(K_ACTIVE_VOTE);
    localStorage.removeItem(K_ACTIVE_RATINGS);
    setHistory(L);
    setActiveVote(null);
    setActiveRatings({});
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
      {!user ? (
        <Login onLogin={login} />
      ) : (
        <div className="max-w-4xl mx-auto">
          <Header user={user} onLogout={logout} tab={tab} setTab={setTab} />

          {tab === 'vota' && (
            <div className="grid gap-4 mt-2">
              {activeVote ? (
                <ActiveVoting movie={activeVote.movie} currentUser={user} ratings={activeRatings} onRate={rateActive} onEnd={endVoting} />
              ) : (
                <>
                  <SearchMovie onPick={(m)=>setPicked(m)} />
                  {picked && <MovieCard movie={picked} onStartVoting={startVoting} />}
                </>
              )}
            </div>
          )}

          {tab === 'storico' && (
            <div className="mt-2">
              <Card>
                <h3 className="text-lg font-semibold mb-2">📜 Storia serate</h3>
                <div className="grid gap-3">
                  {history.length === 0 && <div className="text-sm text-gray-600">Nessuna visione ancora. Avvia una votazione in Vota.</div>}
                  {history.map((v) => (
                    <HistoryCard key={v.id} v={v} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini smoke tests in console
try {
  console.assert(formatScore(7) === '7', 'formatScore 7');
  console.assert(formatScore(7.5) === '7.5', 'formatScore 7.5');
  console.assert(formatScore(7.25) === '7.25', 'formatScore 7.25');
  console.assert(roundToQuarter(7.12) === 7.0, 'roundToQuarter 7.12');
  console.assert(roundToQuarter(7.62) === 7.5, 'roundToQuarter 7.62');
} catch {}
