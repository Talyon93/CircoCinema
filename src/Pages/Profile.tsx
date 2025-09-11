import React from "react";
import { Card } from "../Components/UI/Card";
import { HistoryCardExtended } from "../Components/UI/HistoryCardExtended";
import { fetchAvatarUrl, uploadAvatar, removeAvatar } from "../AvatarStorage";

export function Profile({
  user,
  history,
  onAvatarSaved,
}: {
  user: string;
  history: any[];
  onAvatarSaved?: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Carica l’avatar pubblico dal bucket all’apertura / cambio utente
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAvatarUrl(user)
      .then((url) => alive && setAvatarUrl(url))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  const pickedByMe = React.useMemo(
    () => history.filter((h) => h?.picked_by === user),
    [history, user]
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const url = await uploadAvatar(user, file); // upload su bucket + upsert tabella
      setAvatarUrl(url);                          // URL pubblico pronto
      onAvatarSaved?.();
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Upload avatar non riuscito.");
    } finally {
      setLoading(false);
      e.currentTarget.value = ""; // reset input
    }
  }

  async function onClear() {
    try {
      setLoading(true);
      await removeAvatar(user); // opzionale: pulisce tabella e (se vuoi) file
      setAvatarUrl(null);
      onAvatarSaved?.();
    } catch (err) {
      console.error("Remove avatar failed:", err);
      alert("Rimozione avatar non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <h3 className="mb-3 text-lg font-semibold">👤 Your profile</h3>

        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              className="h-20 w-20 rounded-full object-cover"
              alt={user}
              onError={() => setAvatarUrl(null)}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-xl font-bold dark:bg-zinc-800 dark:text-white">
              {user.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              Logged in as <b>{user}</b>
            </div>

            <div className="mt-2 flex gap-2">
              <label className={`cursor-pointer rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 ${loading ? "pointer-events-none opacity-50" : ""}`}>
                {loading ? "Uploading..." : "Change image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                  disabled={loading}
                />
              </label>

              {avatarUrl && (
                <button
                  className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-50"
                  onClick={onClear}
                  disabled={loading}
                >
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
            <div className="text-sm text-gray-600 dark:text-zinc-400">
              No movies yet. Start one from the “Vote” tab.
            </div>
          ) : (
            pickedByMe
              .slice()
              .sort((a, b) => {
                const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
                const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
                if (ta !== tb) return tb - ta;
                if (typeof a.id === "number" && typeof b.id === "number")
                  return a.id - b.id;
                return 0;
              })
              .map((v) => <HistoryCardExtended key={v.id} v={v} />)
          )}
        </div>
      </Card>
    </>
  );
}
