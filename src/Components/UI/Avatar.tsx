import React from "react";
import { fetchAvatarUrl } from "../../AvatarStorage";

type BaseProps = {
  name: string;
  size?: number;
  className?: string;
  ringClassName?: string;
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

export function Avatar({ name, size = 32, className = "", ringClassName = "", alt }: BaseProps) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchAvatarUrl(name).then((u) => alive && setSrc(u));
    return () => { alive = false; };
  }, [name]);

  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={`rounded-full object-cover ${ringClassName} ${className}`}
        style={{ width: size, height: size }}
        onError={() => setSrc(null)} // se l'URL scade/404, fallback
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

export function AvatarInline(props: BaseProps) { return <Avatar {...props} />; }

export function ChipAvatar({
  name, score, size = 20, className = "",
}: { name: string; score: number; size?: number; className?: string }) {
  const ring =
    score >= 8 ? "ring-emerald-500/60" :
    score >= 6 ? "ring-amber-400/60"  :
                 "ring-rose-500/60";
  return <Avatar name={name} size={size} ringClassName={`ring-2 ${ring}`} className={className} alt={name} />;
}
