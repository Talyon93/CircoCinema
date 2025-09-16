import React from "react";
import { HistoryPosterTile } from "./HistoryPosterTile";
import { Viewing } from "../../types/viewing";

export function HistoryPosterGrid({
  items,
  onOpen,
  onResolve,
}: {
  items: Viewing[];
  onOpen: (v: Viewing) => void;
  onResolve?: (id: any, nextMovie: any) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((v) => (
        <HistoryPosterTile key={v.id} v={v} onClick={() => onOpen(v)} onResolve={onResolve} />
      ))}
    </div>
  );
}
