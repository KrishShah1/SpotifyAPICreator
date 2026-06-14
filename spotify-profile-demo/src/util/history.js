export const HISTORY_KEY = "play_history_v1";

const IS_LOCAL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

// --- Local fallback (dev only) ---

function localLoad() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function localSave(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-2000)));
}

// --- Remote (Redis via API route) ---

export async function loadHistory() {
  if (IS_LOCAL) return localLoad();
  try {
    const r = await fetch("/api/history");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { history } = await r.json();
    return history ?? [];
  } catch {
    return localLoad();
  }
}

export async function saveHistory(entries) {
  if (IS_LOCAL) {
    localSave(entries);
    return;
  }
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
  } catch {
    localSave(entries);
  }
}

// --- Helpers ---

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function uniqueDays(history) {
  const set = new Set();
  for (const e of history) set.add(dayKey(new Date(e.played_at)));
  return [...set].sort();
}
