// Components/SidePanels/QuotesAndTrivia.tsx
import React from "react";
import {
  Quote, BookOpen, RefreshCw, Copy, ChevronDown, ChevronRight,
  Search, Pause, Play, ExternalLink
} from "lucide-react";

/* ---------- utils ---------- */
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}
function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function useRotatingIndex<T>(items: T[], everyMs = 7000, enabled = true) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (!enabled || items.length <= 1) return;
    const id = setInterval(() => setI(v => (v + 1) % items.length), everyMs);
    return () => clearInterval(id);
  }, [items, everyMs, enabled]);
  return [i, setI] as const;
}

/* ---------- Modal base ---------- */
function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-4" onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          <button onClick={onClose} className="rounded-md border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900">Close</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- QuoteCard (enhanced) ---------- */
export type QuoteItem = { text: string; by?: string; source?: string; sourceUrl?: string };

export function QuotesCard({
  quotes,
  className = "",
  title = "Quotes",
  maxVisible = 8,
  autoRotateMs = 7000,
}: {
  quotes: QuoteItem[];
  className?: string;
  title?: string;
  maxVisible?: number;
  autoRotateMs?: number;
}) {
  const [paused, setPaused] = React.useState(false);
  const [i, setI] = useRotatingIndex(quotes, autoRotateMs, !paused);
  const [openList, setOpenList] = React.useState(false);
  const [expand, setExpand] = React.useState(false);

  if (!quotes?.length) return null;

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }
  async function copyAll() {
    try {
      const all = quotes.map(q => `“${q.text}”${q.by ? ` — ${q.by}` : ""}`).join("\n");
      await navigator.clipboard.writeText(all);
    } catch {}
  }

  const visible = expand ? quotes : quotes.slice(0, maxVisible);
  const rotating = quotes[i];

  return (
    <div className={cn("rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3", className)}>
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-zinc-400" />
          <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
        </div>
        
      </div>

      {/* list (grid compact) */}
      <ul className={cn("grid gap-2", expand ? "grid-cols-1" : "grid-cols-1")}>
        {visible.map((q, idx) => (
          <li key={idx} className="rounded-lg border border-zinc-800/70 p-2">
            <div className="text-[13px] leading-relaxed text-zinc-200">“{q.text}”</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
              {q.by && <span>— {q.by}</span>}
              {q.sourceUrl && (
                <a href={q.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300">
                  <ExternalLink className="h-3 w-3" /> source
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- TriviaCard (enhanced) ---------- */
export type TriviaItem = { fact: string; source?: string; sourceUrl?: string };

export function TriviaCard({
  items,
  className = "",
  title = "Trivia",
  maxVisible = 8,
}: {
  items: TriviaItem[];
  className?: string;
  title?: string;
  maxVisible?: number;
}) {
  const [expand, setExpand] = React.useState(false);
  const [openList, setOpenList] = React.useState(false);
  if (!items?.length) return null;

  const visible = expand ? items : items.slice(0, maxVisible);

  return (
    <div className={cn("rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-zinc-400" />
          <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
        </div>
        <div className="flex items-center gap-1">
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((t, i) => (
          <li key={i} className="rounded-lg border border-zinc-800/70 p-2 text-sm leading-relaxed text-zinc-200">
            • {t.fact}
            {(t.source || t.sourceUrl) && (
              <span className="ml-1 text-xs text-zinc-500">
                {t.source && <span>({t.source})</span>}
                {t.sourceUrl && (
                  <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300">
                    <ExternalLink className="h-3 w-3" /> source
                  </a>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Browsers (modal content) ---------- */
function useSearch<T>(items: T[], key: (t: T) => string) {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(it => key(it).toLowerCase().includes(s));
  }, [items, q, key]);
  return { q, setQ, filtered };
}

function QuotesBrowser({ items }: { items: QuoteItem[] }) {
  const { q, setQ, filtered } = useSearch(items, q => `${q.text} ${q.by || ""}`);
  const people = uniq(items.map(i => i.by).filter(Boolean) as string[]);
  const [who, setWho] = React.useState<string | null>(null);
  const list = filtered.filter(i => !who || i.by === who);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2">
          <Search className="h-4 w-4 text-zinc-500" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search quotes…" className="bg-transparent p-1 text-sm outline-none" />
        </div>
        {!!people.length && (
          <select className="rounded-md border border-zinc-800 bg-zinc-900/40 p-1 text-sm"
                  value={who ?? ""} onChange={e=>setWho(e.target.value || null)}>
            <option value="">All characters/authors</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <button
          onClick={async () => {
            const all = list.map(q => `“${q.text}”${q.by ? ` — ${q.by}` : ""}`).join("\n");
            try { await navigator.clipboard.writeText(all); } catch {}
          }}
          className="ml-auto rounded-md border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900"
        >
          Copy {list.length} quotes
        </button>
      </div>

      <ul className="space-y-2">
        {list.map((q, i) => (
          <li key={i} className="rounded-lg border border-zinc-800/70 p-3">
            <div className="text-sm text-zinc-200">“{q.text}”</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              {q.by && <span>— {q.by}</span>}
              {q.sourceUrl && (
                <a href={q.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300">
                  <ExternalLink className="h-3 w-3" /> source
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!list.length && <div className="py-8 text-center text-sm text-zinc-500">No results.</div>}
    </div>
  );
}

function TriviaBrowser({ items }: { items: TriviaItem[] }) {
  const { q, setQ, filtered } = useSearch(items, t => `${t.fact} ${t.source || ""}`);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2">
          <Search className="h-4 w-4 text-zinc-500" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search trivia…" className="bg-transparent p-1 text-sm outline-none" />
        </div>
        <button
          onClick={async () => {
            const all = filtered.map(t => `• ${t.fact}${t.source ? ` (${t.source})` : ""}`).join("\n");
            try { await navigator.clipboard.writeText(all); } catch {}
          }}
          className="ml-auto rounded-md border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900"
        >
          Copy {filtered.length} trivia
        </button>
      </div>

      <ul className="space-y-2">
        {filtered.map((t, i) => (
          <li key={i} className="rounded-lg border border-zinc-800/70 p-3 text-sm leading-relaxed text-zinc-200">
            • {t.fact}
            {(t.source || t.sourceUrl) && (
              <span className="ml-1 text-xs text-zinc-500">
                {t.source && <span>({t.source})</span>}
                {t.sourceUrl && (
                  <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300">
                    <ExternalLink className="h-3 w-3" /> source
                  </a>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!filtered.length && <div className="py-8 text-center text-sm text-zinc-500">No results.</div>}
    </div>
  );
}

/* ---------- Wrapper ---------- */
export function QuotesAndTriviaSidebar({
  quotes,
  trivia,
  className = "",
}: {
  quotes: QuoteItem[];
  trivia: TriviaItem[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <QuotesCard quotes={quotes} />
      <TriviaCard items={trivia} />
    </div>
  );
}
