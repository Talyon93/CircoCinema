// components/WinnerModal.tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FireworksCanvas } from "../Effects/FireworksOverlay";

type WinnerModalProps = {
  isOpen: boolean;
  winnerName: string;
  winnerAvatarUrl?: string;
  onClose?: () => void;
  onArchive?: () => void;
};

export default function WinnerModal({
  isOpen,
  winnerName,
  winnerAvatarUrl,
  onClose,
  onArchive,
}: WinnerModalProps) {
  const portalHostRef = useRef<HTMLDivElement | null>(null);
  if (!portalHostRef.current) {
    portalHostRef.current = document.createElement("div");
    portalHostRef.current.setAttribute("data-portal", "winner-modal");
  }

  useEffect(() => {
    if (!isOpen) return;
    const root = document.getElementById("modal-root") ?? document.body;
    root.appendChild(portalHostRef.current!);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      try {
        root.removeChild(portalHostRef.current!);
      } catch {}
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* fireworks */}
      <FireworksCanvas running={true} />

      {/* card */}
      <div
        className={[
          "relative w-full max-w-xl overflow-hidden rounded-2xl",
          "border border-emerald-400/30 bg-zinc-950/85 ring-1 ring-black/60",
          "shadow-[0_30px_80px_-10px_rgba(0,0,0,.7)]",
          "animate-[winnerIn_.36s_cubic-bezier(.2,.85,.25,1)_both]"
        ].join(" ")}
      >
        {/* header con titolo centrato e X a destra */}
        <div className="relative flex items-center justify-center px-6 py-4 border-b border-emerald-400/10">
          <h2 className="text-[14px] sm:text-[16px] font-extrabold uppercase tracking-[0.22em] text-emerald-300 text-center">
            Up Next to Pick the Movie
          </h2>
          <button
            onClick={onClose}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex flex-col items-center text-center px-6 py-8">
          {/* winner pill */}
          <div
            className={[
              "relative inline-flex items-center gap-3 rounded-full",
              "border border-emerald-400/30 bg-zinc-900/70 px-6 py-3",
              "ring-1 ring-black/40 shadow-[0_10px_30px_-10px_rgba(16,185,129,.35)]",
              "animate-[popIn_.32s_cubic-bezier(.2,.85,.25,1)_both]"
            ].join(" ")}
          >
            <span className="ml-0.5 text-yellow-400 text-xl" aria-hidden>👑</span>
            <span className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-white/10">
              {winnerAvatarUrl ? (
                <img src={winnerAvatarUrl} alt={winnerName} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                  {winnerName?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </span>
            <span
              id="winner-title"
              className="select-none text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-emerald-300"
              style={{ textShadow: "0 1px 0 rgba(0,0,0,.6)" }}
            >
              {winnerName}
            </span>
          </div>

          {/* button */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={onArchive}
              className={[
                "inline-flex items-center justify-center rounded-xl",
                "bg-amber-400 px-6 py-3 text-sm font-semibold text-black",
                "shadow-[0_10px_30px_-10px_rgba(251,191,36,.7)]",
                "transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/60 active:scale-[.98]"
              ].join(" ")}
            >
              Close &amp; go to Archive
            </button>
          </div>
        </div>

        {/* border highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-emerald-500/10" />
      </div>

      {/* animations */}
      <style>{`
        @keyframes winnerIn {
          0% { opacity: 0; transform: translateY(12px) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(.92); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, portalHostRef.current!);
}
