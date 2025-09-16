// StatsKit/sections/UserPanelClassic/parts/InfoBadge.tsx
import React from "react";
import { Info } from "lucide-react";

type Props = {
  text: string;
  /** "inline" = dentro layout (default). "floating" = assoluto nell'angolo. */
  variant?: "inline" | "floating";
  className?: string;
};

export function InfoBadge({ text, variant = "inline", className = "" }: Props) {
  if (variant === "floating") {
    // per i riquadri dove vuoi la "i" nell’angolo in overlay
    return (
      <div
        className={`group relative ${className}`}
        style={{ position: "absolute", right: 8, top: 8 }} // <-- floating vero
      >
        <button
          type="button"
          aria-label="Info"
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-zinc-200 ring-1 ring-inset ring-white/15 backdrop-blur-sm hover:bg-white/15"
        >
          <Info className="h-4 w-4" />
        </button>
        <div className="pointer-events-none absolute right-0 top-8 z-10 hidden w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300 shadow-lg group-hover:block">
          {text}
        </div>
      </div>
    );
  }

  // INLINE (default): nessun absolute, perfetto per Card.Header a destra
  return (
    <div className={`group relative ${className}`}>
      <button
        type="button"
        aria-label="Info"
        className="grid h-7 w-7 place-items-center rounded-full bg-white/08 text-zinc-200 ring-1 ring-inset ring-white/12 hover:bg-white/12"
      >
        <Info className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute right-0 top-8 z-10 hidden w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300 shadow-lg group-hover:block">
        {text}
      </div>
    </div>
  );
}

export default InfoBadge;
