import { Viewing } from "../types/viewing";

export function exportHistoryJSON(list: Viewing[]) {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `circo_history_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
