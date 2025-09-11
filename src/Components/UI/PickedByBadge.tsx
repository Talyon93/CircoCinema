import React, { useEffect, useMemo, useState } from "react";

import {
  loadAvatarFor,
} from "../../localStorage";
import { AvatarInline } from "./Avatar";


export function PickedByBadge({ name }: { name?: string }) {
  if (!name) return null;
  const initial = name?.[0]?.toUpperCase() || "?";

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-amber-400/40
                 bg-amber-500/15 px-2.5 py-1.5 text-amber-200 shadow-sm backdrop-blur
                 ring-1 ring-amber-400/20"
      title={`Picked by: ${name}`}
    >
      <ClapperIcon className="text-amber-300" />
      <AvatarInline
        name={name}
        size={20}
        ringClassName="ring-2 ring-amber-400/50"
      />
      <span className="text-xs font-bold">{name || initial}</span>
    </span>
  );
}

const ClapperIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="currentColor" aria-hidden="true">
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm18-2v2H3V6a2 2 0 0 1 2-2h2l2 2h3l-2-2h3l2 2h3l-2-2h3a2 2 0 0 1 2 2Z"/>
  </svg>
);