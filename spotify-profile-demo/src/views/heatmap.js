import { getRecentlyPlayed } from "../api.js";
import { loadHistory, saveHistory, dayKey } from "../util/history.js";

const RANGES = [
  { label: "30 days",  days: 30 },
  { label: "90 days",  days: 90 },
  { label: "6 months", days: 182 },
  { label: "1 year",   days: 365 },
  { label: "All time", days: null },
];

function buildDayBuckets(history) {
  const buckets = new Map();
  for (const entry of history) {
    const k = dayKey(new Date(entry.played_at));
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return buckets;
}

function gridCols(days) {
  if (!days || days > 300) return 26;
  if (days > 90) return 20;
  if (days > 30) return 15;
  return 10;
}

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Builds your listening history over time — syncs the last 50 plays to Redis on each visit so it grows forever.</p>
    <div class="controls">
      <label>Range:
        <select class="hm-range">
          ${RANGES.map((r, i) => `<option value="${i}"${i === 1 ? " selected" : ""}>${r.label}</option>`).join("")}
        </select>
      </label>
      <button class="hm-refresh">Sync now</button>
      <span class="hm-stats muted"></span>
    </div>
    <div class="hm-grid"></div>
    <div class="hm-recent"></div>
  `;

  const $ = (s) => container.querySelector(s);
  let allHistory = [];

  async function sync() {
    $(".hm-stats").textContent = "Syncing…";
    allHistory = await loadHistory();
    const seen = new Set(allHistory.map((e) => e.played_at + "|" + e.track_id));
    const newEntries = [];
    try {
      const data = await getRecentlyPlayed(50);
      for (const entry of data.items ?? []) {
        const key = entry.played_at + "|" + entry.track.id;
        if (!seen.has(key)) {
          newEntries.push({
            played_at: entry.played_at,
            track_id: entry.track.id,
            name: entry.track.name,
            artist: entry.track.artists.map((a) => a.name).join(", "),
          });
          seen.add(key);
        }
      }
      if (newEntries.length > 0) {
        await saveHistory(newEntries);
        allHistory = await loadHistory();
      }
      $(".hm-stats").textContent = `${allHistory.length} plays stored · +${newEntries.length} new`;
    } catch (e) {
      $(".hm-stats").textContent = `Sync failed: ${e.message}`;
    }
    paint();
  }

  function paint() {
    const rangeIdx = Number($(".hm-range").value);
    const { days } = RANGES[rangeIdx];

    // Filter history to the selected window
    const cutoff = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const filtered = cutoff
      ? allHistory.filter((e) => e.played_at >= cutoff)
      : allHistory;

    const buckets = buildDayBuckets(filtered);

    // Build the list of days to show
    const today = new Date();
    const dayList = [];
    if (days) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = dayKey(d);
        dayList.push({ key: k, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: buckets.get(k) ?? 0 });
      }
    } else {
      // All time — build from first recorded play to today
      const firstDate = allHistory.length
        ? new Date(allHistory[0].played_at)
        : today;
      const totalDays = Math.ceil((today - firstDate) / (1000 * 60 * 60 * 24)) + 1;
      for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = dayKey(d);
        dayList.push({ key: k, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: buckets.get(k) ?? 0 });
      }
    }

    const max = Math.max(1, ...dayList.map((d) => d.count));
    const cols = gridCols(days ?? dayList.length);

    const grid = $(".hm-grid");
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.innerHTML = "";

    for (const d of dayList) {
      const cell = document.createElement("div");
      cell.className = "hm-cell";
      const intensity = d.count === 0 ? 0 : 0.15 + 0.85 * (d.count / max);
      cell.style.background = intensity === 0
        ? "var(--bg-elev)"
        : `rgba(29, 185, 84, ${intensity})`;
      cell.title = `${d.key}: ${d.count} play${d.count !== 1 ? "s" : ""}`;
      // Only show labels if there aren't too many cells
      if (dayList.length <= 120) {
        cell.innerHTML = `<span class="hm-day">${d.label.split(" ")[1]}</span><span class="hm-count">${d.count || ""}</span>`;
      }
      grid.appendChild(cell);
    }

    // Recent plays list (always from full history)
    const recent = allHistory.slice(-20).reverse();
    const recentDiv = $(".hm-recent");
    recentDiv.innerHTML = `<h3>Most recent plays <span class="muted">(${filtered.length} plays in range)</span></h3>`;
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

  $(".hm-refresh").addEventListener("click", sync);
  $(".hm-range").addEventListener("change", paint);

  await sync();
}
