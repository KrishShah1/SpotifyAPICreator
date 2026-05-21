import { getRecentlyPlayed } from "../api.js";
import { HISTORY_KEY, loadHistory, dayKey } from "../util/history.js";

const DAYS_TO_SHOW = 30;

function saveHistory(items) {
  const trimmed = items.slice(-2000);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

function buildDayBuckets(history) {
  const buckets = new Map();
  for (const entry of history) {
    const d = new Date(entry.played_at);
    const k = dayKey(d);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return buckets;
}

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Builds a real listening history by appending recently-played plays to localStorage every time you load this page (Spotify only returns the last 50 directly).</p>
    <div class="controls">
      <button class="hm-refresh">Refresh now</button>
      <button class="hm-clear">Clear history</button>
      <span class="hm-stats muted"></span>
    </div>
    <div class="hm-grid"></div>
    <div class="hm-recent"></div>
  `;

  const $ = (s) => container.querySelector(s);

  async function refresh() {
    const stored = loadHistory();
    const seen = new Set(stored.map((e) => e.played_at + "|" + e.track_id));
    try {
      const data = await getRecentlyPlayed(50);
      for (const entry of data.items ?? []) {
        const key = entry.played_at + "|" + entry.track.id;
        if (!seen.has(key)) {
          stored.push({
            played_at: entry.played_at,
            track_id: entry.track.id,
            name: entry.track.name,
            artist: entry.track.artists.map((a) => a.name).join(", "),
          });
          seen.add(key);
        }
      }
      stored.sort((a, b) => a.played_at.localeCompare(b.played_at));
      saveHistory(stored);
    } catch (e) {
      $(".hm-stats").textContent = `(refresh failed: ${e.message})`;
    }
    paint();
  }

  function paint() {
    const history = loadHistory();
    $(".hm-stats").textContent = `${history.length} plays tracked`;

    const buckets = buildDayBuckets(history);
    const today = new Date();
    const days = [];
    for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      days.push({ key: k, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: buckets.get(k) ?? 0 });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    const grid = $(".hm-grid");
    grid.innerHTML = "";
    for (const d of days) {
      const cell = document.createElement("div");
      cell.className = "hm-cell";
      const intensity = d.count === 0 ? 0 : 0.2 + 0.8 * (d.count / max);
      cell.style.background = `rgba(29, 185, 84, ${intensity})`;
      cell.title = `${d.label}: ${d.count} plays`;
      cell.innerHTML = `<span class="hm-day">${d.label.split(" ")[1]}</span><span class="hm-count">${d.count}</span>`;
      grid.appendChild(cell);
    }

    const recent = history.slice(-20).reverse();
    const recentDiv = $(".hm-recent");
    recentDiv.innerHTML = "<h3>Most recent plays</h3>";
    const list = document.createElement("ol");
    list.className = "track-list";
    for (const e of recent) {
      const li = document.createElement("li");
      li.className = "track-row";
      li.innerHTML = `
        <div class="img-placeholder small"></div>
        <div class="track-meta"><strong>${e.name}</strong><small>${e.artist}</small></div>
        <span class="track-duration">${new Date(e.played_at).toLocaleString()}</span>
      `;
      list.appendChild(li);
    }
    recentDiv.appendChild(list);
  }

  $(".hm-refresh").addEventListener("click", () => refresh());
  $(".hm-clear").addEventListener("click", () => {
    if (confirm("Clear all stored play history?")) {
      localStorage.removeItem(HISTORY_KEY);
      paint();
    }
  });

  await refresh();
}
