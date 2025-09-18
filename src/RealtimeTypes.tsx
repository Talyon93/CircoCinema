// realtimeTypes.ts
export type SlotStartPayload = {
  kind: "slot.start";
  runId: string;
  roomId: string;
  startedBy: string;
  startedAt: number;     // Date.now()
  durationMs: number;    // es. 6000
  entries: string[];     // congelata per la run
  targetIndex: number;   // indice in entries
  loops: number;         // giri interi prima di fermarsi
};

export type SlotEndPayload = {
  kind: "slot.end";
  runId: string;
  roomId: string;
  winner: string;
  endedAt: number;
};

export type VoteEventPayload = {
  kind: "vote.cast";
  roomId: string;
  runId?: string;        // opzionale se il voto è legato alla run
  voter: string;         // user id/username
  value: number;         // 1..10 (o la tua scala)
  targetId: string;      // es. movieId/viewingId
  ts: number;
};

export type RTAny = SlotStartPayload | SlotEndPayload | VoteEventPayload;
