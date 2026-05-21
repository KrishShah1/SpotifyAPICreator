export const HISTORY_KEY = "play_history_v1";

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function uniqueDays(history) {
  const set = new Set();
  for (const e of history) set.add(dayKey(new Date(e.played_at)));
  return [...set].sort();
}
