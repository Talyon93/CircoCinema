// filepath: src/CinemaNightApp.tsx
import React, { useEffect, useMemo, useState } from "react";
import { TableCellsIcon, ArrowsPointingOutIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

// Helpers / SDK
import { tmdbDetails, ensureGenres, normalizeSingleCountry, mergeMovie } from "./TMDBHelper";
import { sb } from "./supabaseClient";
import { loadSharedState, saveSharedState, subscribeSharedState, setRatingAtomic } from "./state";
import { loadHistoryLive, persistHistoryLive, subscribeHistoryLive, ensureLiveFileExists } from "./storage";
import { K_USER, K_VIEWINGS, K_ACTIVE_VOTE, K_ACTIVE_RATINGS, lsGetJSON, lsSetJSON } from "./localStorage";
import { formatScore } from "./Utils/Utils";

// UI
import { Card } from "./Components/UI/Card";
import { Stats } from "./Pages/Stats";
import { HistoryCardExtended } from "./Components/UI/HistoryCardExtended";
import { Profile } from "./Pages/Profile";
import { Header } from "./Components/UI/Header";
import { Login } from "./Pages/Login";
import VotePage from "./Pages/Vote";
import { EditViewingDialog } from "./Components/EditViewingDialog";

// Split nuovi
import { exportHistoryJSON } from "./Utils/exportHistoryJSON";
import { useHistoryBackfills } from "./hooks/useHistoryBackfills";
import { HistoryPosterGrid } from "./Components/history/HistoryPosterGrid";
import { ViewingModal } from "./Components/history/ViewingModal";
import { Viewing } from "./types/viewing";
import { roundToQuarter } from "./Utils/math";
import { buildDenseRanking } from "./Utils/ranking";
import { exportPeopleJSON, exportPeopleCSV, backfillPeopleAndSave } from "./ExportPeople";

export default function CinemaNightApp() {
  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history" | "profile" | "stats">("vote");
  const [editingViewing, setEditingViewing] = useState<{ id: any; title: string } | null>(null);
  const [openViewing, setOpenViewing] = useState<Viewing | null>(null);

  const [pickedMovie, setPickedMovie] = useState<any | null>(null);
  const [history, setHistory] = useState<Viewing[]>([]);
  const [activeVote, setActiveVote] = useState<any | null>(null);
  const [activeRatings, setActiveRatings] = useState<Record<string, number>>({});
  const [historyMode, setHistoryMode] = useState<"extended" | "compact">("compact");

  // Filters / sort
  const [filterPicker, setFilterPicker] = useState<string>("");
  const [filterGenre, setFilterGenre] = useState<string>("");
  const [sortKey, setSortKey] = useState<"date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc">("date-desc");

  const pickerOptions = useMemo(() => {
    const s = new Set<string>();
    for (const h of history) if (h?.picked_by) s.add(h.picked_by);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [history]);

  const genreOptions = useMemo(() => {
    const s = new Set<string>();
    for (const h of history) {
      const arr = (h?.movie?.genres || []) as Array<{ id: number; name: string }>;
      arr?.forEach((g) => g?.name && s.add(g.name));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [history]);

  const knownUsers = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      Object.keys(h?.ratings || {}).forEach((u) => set.add(u));
      if (h?.picked_by) set.add(h.picked_by);
    }
    if (user) set.add(user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history, user]);

  const ranking = useMemo(() => buildDenseRanking(history), [history]);

  // ---------- INIT + REALTIME ----------
  useEffect(() => {
    let offLive = () => {};
    let offState = () => {};

    (async () => {
      setUser(lsGetJSON<string>(K_USER, ""));

      if (sb) {
        await ensureLiveFileExists();
        const [live, shared] = await Promise.all([loadHistoryLive(), loadSharedState()]);
        setHistory(Array.isArray(live) ? (live as Viewing[]) : []);
        setActiveVote(shared?.active ?? null);
        setActiveRatings(shared?.ratings ?? {});

        offLive = subscribeHistoryLive((next) => setHistory(Array.isArray(next) ? (next as Viewing[]) : []));
        offState = subscribeSharedState((row) => {
          setActiveVote(row?.active ?? null);
          setActiveRatings(row?.ratings ?? {});
        });

        return;
      }

      // Offline fallback
      const hist = lsGetJSON<Viewing[]>(K_VIEWINGS, []);
      setHistory(hist);
      setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
      setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));

      const onStorage = (e: StorageEvent) => {
        if (e.key === K_ACTIVE_VOTE) setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
        if (e.key === K_ACTIVE_RATINGS) setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));
        if (e.key === K_VIEWINGS) setHistory(lsGetJSON<Viewing[]>(K_VIEWINGS, []));
      };
      window.addEventListener("storage", onStorage);
      offLive = () => window.removeEventListener("storage", onStorage);
    })();

    return () => {
      offLive?.();
      offState?.();
    };
  }, []);

  // ---------- BACKFILLS ----------
  const { isBackfillingRuntime, backfillHistoryRuntime } = useHistoryBackfills(history, setHistory);

  // ---------- Vote flow ----------
  const onPick = async (res: any) => {
    const details = await tmdbDetails(res.id);
    setPickedMovie(details || res);
  };

  const startVoting = async (movie: any, pickedBy: string) => {
    const movieWithGenres = await ensureGenres(movie);

    let det: any = null;
    if (movieWithGenres?.id) {
      try { det = await tmdbDetails(movieWithGenres.id); } catch {}
    }

    let m = det ? mergeMovie(movieWithGenres, det) : movieWithGenres;
    if (Array.isArray(det?.production_countries)) m.production_countries = det.production_countries;
    if (Array.isArray(det?.origin_country))       m.origin_country       = det.origin_country;

    m = normalizeSingleCountry(m);

    const session = {
      id: Date.now(),
      movie: { ...m, genres: Array.isArray(m?.genres) ? m.genres : [] },
      picked_by: pickedBy,
      opened_by: user,
      started_at: new Date().toISOString(),
    };

    setActiveVote(session);
    setActiveRatings({});
    if (sb) await saveSharedState({ active: session, ratings: {} });
    else {
      lsSetJSON(K_ACTIVE_VOTE, session);
      lsSetJSON(K_ACTIVE_RATINGS, {});
    }
  };

  const sendVote = async (score: number) => {
    if (!user || !activeVote) return;
    const fixed = roundToQuarter(score);
    setActiveRatings((prev) => ({ ...prev, [user]: fixed }));
    if (sb) {
      await setRatingAtomic(user, fixed);
    } else {
      const next = { ...lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}), [user]: fixed };
      lsSetJSON(K_ACTIVE_RATINGS, next);
    }
  };

  const endVoting = async () => {
    if (!activeVote) return;
    if (activeVote.opened_by && activeVote.opened_by !== user) {
      alert("Only the host can end this voting.");
      return;
    }

    const entry: Viewing = {
      id: activeVote.id,
      started_at: activeVote.started_at,
      picked_by: activeVote.picked_by,
      movie: activeVote.movie,
      ratings: activeRatings,
      opened_by: activeVote.opened_by,
    };

    const nextHistory = [entry, ...history];
    setHistory(nextHistory);
    setActiveVote(null);
    setActiveRatings({});

    if (sb) {
      await persistHistoryLive(nextHistory);
      await saveSharedState({ active: null, ratings: {} });
    } else {
      const L = lsGetJSON<Viewing[]>(K_VIEWINGS, []);
      L.unshift(entry);
      lsSetJSON(K_VIEWINGS, L);
      localStorage.removeItem(K_ACTIVE_VOTE);
      localStorage.removeItem(K_ACTIVE_RATINGS);
    }
  };

  const cancelVoting = async () => {
    if (!activeVote) return;
    if (activeVote.opened_by && activeVote.opened_by !== user) {
      alert("Only the host can cancel this voting.");
      return;
    }
    setActiveVote(null);
    setActiveRatings({});
    if (sb) {
      await saveSharedState({ active: null, ratings: {} });
    } else {
      localStorage.removeItem(K_ACTIVE_VOTE);
      localStorage.removeItem(K_ACTIVE_RATINGS);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {!user ? (
        <Login
  onLogin={(name) => {
    setUser(name);
    localStorage.setItem("cn_user", name);

    // forza sempre tab iniziale = Archive
    setTab("history");
    localStorage.setItem("CN_TAB", "history");
  }}
/>
      ) : (
        <div className="mx-auto max-w-6xl">
          <Header user={user} onLogout={() => { localStorage.removeItem(K_USER); setUser(""); }} tab={tab} setTab={setTab} />

          {tab === "vote" && (
            <VotePage
              currentUser={user}
              knownUsers={knownUsers}
              activeVote={activeVote}
              activeRatings={activeRatings}
              onStartVoting={startVoting}
              onSendVote={sendVote}
              onEndVoting={endVoting}
              onCancelVoting={cancelVoting}
              historyViewings={history}
            />
          )}

          {tab === "stats" && (
            <div className="mt-2 grid gap-4">
              <Card>
                <Stats history={history} backfillRuntime={backfillHistoryRuntime} isLoading={isBackfillingRuntime} />
              </Card>
            </div>
          )}

          {tab === "history" && (
            <div className="mt-2">
              <Card>
                {/* Modals / editing */}
                {editingViewing && (
                  <EditViewingDialog
                    open
                    viewing={history.find((h) => h.id === editingViewing.id)!}
                    knownUsers={knownUsers}
                    currentUser={user}
                    onClose={() => setEditingViewing(null)}
                    onSave={async (next) => {
                      const list = history.map((h) => (h.id === next.id ? next : h));
                      setHistory(list);
                      await persistHistoryLive(list);
                      setEditingViewing(null);
                    }}
                    onDelete={async () => {
                      const nextList = history.filter((v) => v.id !== editingViewing.id);
                      setHistory(nextList);
                      await persistHistoryLive(nextList);
                      setEditingViewing(null);
                    }}
                    onRequestChangeMovie={() => {
                      const v = history.find((h) => h.id === editingViewing!.id) || null;
                      if (!v) return;
                      setOpenViewing(v);   // apri il resolver
                      setEditingViewing(null);
                    }}
                  />
                )}

                {/* Filters */}
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Picked by</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      value={filterPicker}
                      onChange={(e) => setFilterPicker(e.target.value)}
                    >
                      <option value="">All</option>
                      {pickerOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Genre</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      value={filterGenre}
                      onChange={(e) => setFilterGenre(e.target.value)}
                    >
                      <option value="">All</option>
                      {genreOptions.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Sort by</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as any)}
                    >
                      <option value="date-desc">Date ↓ (newest)</option>
                      <option value="date-asc">Date ↑ (oldest)</option>
                      <option value="avg-desc">Average ↓</option>
                      <option value="avg-asc">Average ↑</option>
                      <option value="votes-desc">Votes count ↓</option>
                      <option value="votes-asc">Votes count ↑</option>
                    </select>
                  </div>

                  <div className="flex items-end justify-between">
                    <button
                      className="rounded-xl border px-3 py-2 dark:border-zinc-700"
                      onClick={() => { setFilterPicker(""); setFilterGenre(""); setSortKey("date-desc"); }}
                    >
                      Reset
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryMode(historyMode === "extended" ? "compact" : "extended")}
                        title={historyMode === "extended" ? "Switch to Compact view" : "Switch to Extended view"}
                        aria-label={historyMode === "extended" ? "Switch to Compact view" : "Switch to Extended view"}
                        className="p-2 rounded-lg bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 shadow-sm"
                      >
                        {historyMode === "extended" ? (
                          <TableCellsIcon className="h-6 w-6" />
                        ) : (
                          <ArrowsPointingOutIcon className="h-6 w-6" />
                        )}
                      </button>

                      <button
                        onClick={() => exportHistoryJSON(history)}
                        title="Export JSON"
                        aria-label="Export JSON"
                        className="p-2 rounded-lg bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 shadow-sm"
                      >
                        <ArrowDownTrayIcon className="h-6 w-6" />
                      </button>
                      {/* Rebuild People (force) */}
<button
  onClick={async () => {
    try {
      if (!history || history.length === 0) {
        alert("History vuota o non caricata.");
        return;
      }
      const ok = confirm(
        "Rebuild People (force): ricalcolo regista principale e top cast per TUTTI i film e salvo. Procedo?"
      );
      if (!ok) return;

      const saveHistory = async (nextHistory: any[]) => {
        if (sb) {
          await persistHistoryLive(nextHistory);
        } else {
          lsSetJSON(K_VIEWINGS, nextHistory);
        }
      };

      // forziamo il ricalcolo per TUTTI (onlyMissing: false)
      const report = await backfillPeopleAndSave(history, saveHistory, {
        throttleMs: 160,
        onlyMissing: false,
        logEvery: 5,
        dryRun: false,
      });

      alert(
        `Rebuild completato.\n` +
        `Totale: ${report.total}\n` +
        `Aggiornati: ${report.updated}\n` +
        `Skippati: ${report.skipped}\n` +
        `Salvato: ${report.saved ? "Sì" : "No"}`
      );

      // ricarica la history
      if (sb) {
        const live = await loadHistoryLive();
        setHistory(Array.isArray(live) ? (live as Viewing[]) : []);
      } else {
        setHistory(lsGetJSON<Viewing[]>(K_VIEWINGS, []));
      }
    } catch (err) {
      console.error(err);
      alert("Rebuild fallito. Controlla la console.");
    }
  }}
  title="Rebuild People (force)"
  aria-label="Rebuild People (force)"
  className="p-2 rounded-lg bg-indigo-700/70 hover:bg-indigo-600 border border-indigo-600 shadow-sm"
>
  <span className="px-1 text-sm">Rebuild People</span>
</button>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="mt-4 grid gap-3">
                  {history.length === 0 && (
                    <div className="text-sm text-gray-600 dark:text-zinc-400">
                      No entries yet. Start a vote from the “Vote” tab.
                    </div>
                  )}

                  {(() => {
                    let L = history.slice();
                    if (filterPicker) L = L.filter((h) => h?.picked_by === filterPicker);
                    if (filterGenre) {
                      L = L.filter((h) =>
                        ((h?.movie?.genres as Array<{ name: string }>) || []).some((g) => g?.name === filterGenre)
                      );
                    }

                    const getAvg = (r?: Record<string, number> | null) => {
                      if (!r) return null;
                      const vals = Object.values(r).map(Number);
                      if (!vals.length) return null;
                      return vals.reduce((a, b) => a + b, 0) / vals.length;
                    };

                    L.sort((a, b) => {
                      const aDate = a?.started_at ? new Date(a.started_at).getTime() : 0;
                      const bDate = b?.started_at ? new Date(b.started_at).getTime() : 0;
                      const aAvg = getAvg(a?.ratings);
                      const bAvg = getAvg(b?.ratings);
                      const aVotes = a?.ratings ? Object.keys(a.ratings).length : 0;
                      const bVotes = b?.ratings ? Object.keys(b.ratings).length : 0;

                      switch (sortKey) {
                        case "date-asc":
                          return aDate - bDate;
                        case "date-desc":
                          return bDate - aDate;
                        case "avg-asc":
                          return (aAvg ?? -Infinity) - (bAvg ?? -Infinity);
                        case "avg-desc":
                          return (bAvg ?? -Infinity) - (aAvg ?? -Infinity);
                        case "votes-asc":
                          return aVotes - bVotes;
                        case "votes-desc":
                          return bVotes - aVotes;
                        default:
                          return 0;
                      }
                    });

                    return historyMode === "compact" ? (
                      <HistoryPosterGrid
                        items={L}
                        onOpen={setOpenViewing}
                        onResolve={(id, nextMovie) => {
                          const list = history.map((v) => (v.id === id ? { ...v, movie: nextMovie } : v));
                          setHistory(list);
                          persistHistoryLive(list);
                        }}
                      />
                    ) : (
                      L.map((v) => (
                        <HistoryCardExtended
  key={v.id}
  v={v as any}
  onEdit={() => setEditingViewing({ id: v.id, title: v?.movie?.title || "" })}
  onMetaResolved={(id, nextMovie) => {
    const list = history.map((x) => (x.id === id ? { ...x, movie: nextMovie } : x));
    setHistory(list);
    persistHistoryLive(list);
  }}
  rank={ranking.map.get(v.id)}
  total={ranking.total}
  // ➜ NEW
  currentUser={user}
  onQuickVote={(id, score) => {
    const fixed = roundToQuarter(score);
    const list = history.map((x) =>
      x.id === id ? { ...x, ratings: { ...(x.ratings || {}), [user]: fixed } } : x
    );
    setHistory(list);
    persistHistoryLive(list);
  }}
/>
                      ))
                    );
                  })()}
                </div>

                {/* Resolver modal: sempre montato nel tab History */}
                <ViewingModal
                  v={openViewing}
                  onClose={() => setOpenViewing(null)}
                  onEdit={(id) => {
                    setEditingViewing({ id, title: history.find((x) => x.id === id)?.movie?.title || "" });
                    setOpenViewing(null);
                  }}
                  onResolve={(id, nextMovie) => {
                    const list = history.map((v) => (v.id === id ? { ...v, movie: nextMovie } : v));
                    setHistory(list);
                    persistHistoryLive(list);
                    setOpenViewing(null);
                  }}
                  currentUser={user}
                />
              </Card>
            </div>
          )}

          {tab === "profile" && (
            <div className="mt-2 grid gap-4">
              <Profile user={user} history={history as any[]} onAvatarSaved={() => {}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
