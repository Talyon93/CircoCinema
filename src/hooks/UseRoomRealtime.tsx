// hooks/useRoomRealtime.ts
import { useEffect, useRef } from "react";
import { getRoomChannel } from "../supabaseClient";
import type { RTAny } from "../RealtimeTypes";

export function useRoomRealtime(
  roomId: string,
  handlers: {
    onStart?: (p: any) => void;
    onEnd?: (p: any) => void;
    onVote?: (p: any) => void;
  }
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const ch = getRoomChannel(roomId);

    ch.on("broadcast", { event: "slot" }, ({ payload }) => {
      const p = payload as RTAny;
      if (p.kind === "slot.start") handlersRef.current.onStart?.(p);
      if (p.kind === "slot.end") handlersRef.current.onEnd?.(p);
    });

    ch.on("broadcast", { event: "vote" }, ({ payload }) => {
      const p = payload as RTAny;
      if (p.kind === "vote.cast") handlersRef.current.onVote?.(p);
    });

    return () => {
      // non chiudiamo il canale (cache globale). Se vuoi: ch.unsubscribe()
    };
  }, [roomId]);

  function send(event: "slot" | "vote", payload: RTAny) {
    const ch = getRoomChannel(roomId);
    ch.send({ type: "broadcast", event, payload });
  }

  return { send };
}
