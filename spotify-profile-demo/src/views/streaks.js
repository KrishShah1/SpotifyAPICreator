import { loadHistory, uniqueDays } from "../util/history.js";

function diffDays(a, b) {
  const d1 = new Date(a + "T00:00:00Z").getTime();
  const d2 = new Date(b + "T00:00:00Z").getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function computeStreaks(days) {
  if (days.length === 0) return { longest: 0, current: 0, longestRange: null };
  let longest = 1;
  let cur = 1;
  let longestStart = days[0];
  let longestEnd = days[0];
  let curStart = days[0];

  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) === 1) {
      cur++;
    } else {
      if (cur > longest) {
        longest = cur;
        longestStart = curStart;
        longestEnd = days[i - 1];
      }
      cur = 1;
      curStart = days[i];
    }
  }
  if (cur > longest) {
    longest = cur;
    longestStart = curStart;
    longestEnd = days[days.length - 1];
  }

  const today = new Date().toISOString().slice(0, 10);
  const last = days[days.length - 1];
  const gap = diffDays(last, today);
  const current = gap <= 1 ? cur : 0;

  return { longest, current, longestRange: { start: longestStart, end: longestEnd } };
}

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Consecutive days you listened, based on your stored history. Visit the Heatmap tab to grow this over time.</p>
    <div class="streaks-stats"></div>
    <p class="muted">Day-by-day:</p>
    <div class="streaks-list"></div>
  `;

  const stats = container.querySelector(".streaks-stats");
  const list = container.querySelector(".streaks-list");
  const history = loadHistory();

  if (history.length === 0) {
    stats.innerHTML = `<p class="muted">No history yet.</p>`;
    return;
  }

  const days = uniqueDays(history);
  const { longest, current, longestRange } = computeStreaks(days);

  stats.innerHTML = `
    <div class="stats-row">
      <div class="stat"><span class="stat-num">${current}</span><span class="stat-label">current streak (days)</span></div>
      <div class="stat"><span class="stat-num">${longest}</span><span class="stat-label">longest streak</span></div>
      <div class="stat"><span class="stat-num">${days.length}</span><span class="stat-label">unique listening days</span></div>
    </div>
    ${longestRange ? `<p class="muted">Longest streak: ${longestRange.start} → ${longestRange.end}</p>` : ""}
  `;

  const playsByDay = new Map();
  for (const e of history) {
    const k = new Date(e.played_at).toISOString().slice(0, 10);
    playsByDay.set(k, (playsByDay.get(k) ?? 0) + 1);
  }
  const rows = [...playsByDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  list.innerHTML = "";
  const ol = document.createElement("ol");
  ol.className = "streaks-day-list";
  for (const [day, count] of rows) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${day}</span><span class="muted">${count} plays</span>`;
    ol.appendChild(li);
  }
  list.appendChild(ol);
}
