// src/Components/history/ViewingModal.tsx
import React from "react";
import { createPortal } from "react-dom";
import { HistoryCardExtended } from "../UI/HistoryCardExtended";
import { Viewing } from "../../types/viewing";

export function ViewingModal({
  v,
  onClose,
  onEdit,
  onResolve,
  currentUser,
   rank,
  total,
}: {
  v: Viewing | null;
  onClose: () => void;
  onEdit?: (id: any) => void;
  onResolve?: (id: any, nextMovie: any) => void;
  currentUser?: string;
  rank?: number;  
  total?: number;
}) {
  if (!v) return null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-5xl overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
        {/* Contenuto */}
        <HistoryCardExtended
          v={v}
          onEdit={() => onEdit?.(v.id)}
          onMetaResolved={onResolve}
          currentUser={currentUser}
          rank={rank}          
  total={total}
          inModal
        />

        {/* Close in alto a destra */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex items-center justify-center rounded-lg bg-zinc-800/70 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700/70 focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
          aria-label="Close modal"
        >
          Close
        </button>
      </div>

      {/* Click sulla backdrop per chiudere */}
      <button
        type="button"
        className="fixed inset-0 -z-10 cursor-auto"
        onClick={onClose}
        aria-label="Close overlay"
      />
    </div>,
    document.body
  );
}
