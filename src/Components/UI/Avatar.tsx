import React from "react";
import { loadAvatarFor } from "../../localStorage";

type BaseProps = {
  name: string;
  size?: number;         // px
  className?: string;    // class extra
  ringClassName?: string;// class per ring (es: colore)
  alt?: string;
};

function initialsFrom(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}

/** Avatar tondo generico (foto se presente, altrimenti iniziali) */
export function Avatar({ name, size = 32, className = "", ringClassName = "", alt }: BaseProps) {
  const src = loadAvatarFor(name);
  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={`rounded-full object-cover ${ringClassName} ${className}`}
        style={style}
      />
    );
  }
  return (
    <div
      className={`grid place-items-center rounded-full 
              bg-gray-200 text-xs font-semibold text-zinc-900
              dark:bg-zinc-800 dark:text-white 
              ${ringClassName} ${className}`}
      style={style}
      aria-label={alt || name}
      title={name}
    >
      {initialsFrom(name)}
    </div>
  );
}

/** Variante “inline” identica a Avatar, lasciata per compatibilità */
export function AvatarInline(props: BaseProps) {
  return <Avatar {...props} />;
}

/** Avatar piccolo con ring colorato in base allo score (per chip/list) */
export function ChipAvatar({
  name,
  score,
  size = 20,
  className = "",
}: { name: string; score: number; size?: number; className?: string }) {
  const ring =
    score >= 8 ? "ring-emerald-500/60" :
    score >= 6 ? "ring-amber-400/60"  :
                 "ring-rose-500/60";
  return <Avatar name={name} size={size} ringClassName={`ring-2 ${ring}`} className={className} alt={name} />;
}
