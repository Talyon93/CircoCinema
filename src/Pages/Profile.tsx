import React, { useEffect, useMemo, useState } from "react";


import {
  K_PROFILE_PREFIX,
  lsSetJSON,
  loadAvatarFor,
} from "../localStorage";

import {
  Card,
} from "../Components/UI/Card";

import {
  HistoryCardExtended,
} from "../Components/UI/HistoryCardExtended";


export function Profile({ user, history, onAvatarSaved }: { user: string; history: any[]; onAvatarSaved?: () => void }) {
  const profileKey = `${K_PROFILE_PREFIX}${user}`;
  const [avatar, setAvatar] = useState<string | null>(loadAvatarFor(user));
  const pickedByMe = useMemo(() => history.filter((h) => h?.picked_by === user), [history, user]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatar(dataUrl);
      lsSetJSON(profileKey, { avatar: dataUrl });
      onAvatarSaved?.();
    };
    reader.readAsDataURL(file);
  }
  function clearAvatar() {
    localStorage.removeItem(profileKey);
    setAvatar(null);
    onAvatarSaved?.();
  }

  return (
    <>
      <Card>
        <h3 className="mb-3 text-lg font-semibold">👤 Your profile</h3>
        <div className="flex items-start gap-3">
          {avatar ? (
            <img src={avatar} className="h-20 w-20 rounded-full object-cover" alt={user} />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-xl font-bold">
              {user.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              Logged in as <b>{user}</b>
            </div>
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm dark:border-zinc-700">
                Change image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                />

              </label>
              {avatar && (
                <button className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-700" onClick={clearAvatar}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">🎬 Movies you picked</h3>
        <div className="grid gap-3">
          {pickedByMe.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-zinc-400">No movies yet. Start one from the “Vote” tab.</div>
          ) : (
            pickedByMe
              .slice()
              .sort((a, b) => {
                const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
                const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
                if (ta !== tb) return tb - ta;
                if (typeof a.id === "number" && typeof b.id === "number") return a.id - b.id;
                return 0;
              })
              .map((v) => <HistoryCardExtended key={v.id} v={v} />)
          )}
        </div>
      </Card>
    </>
  );
}
