import { loadHistory } from "../util/history.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">When in the day you listen most. Built from your stored play history (visit the Heatmap tab to grow it over time).</p>
    <div class="tod-grid"></div>
    <div class="tod-summary"></div>
  `;

  const grid = container.querySelector(".tod-grid");
  const summary = container.querySelector(".tod-summary");
  const history = loadHistory();

  if (history.length === 0) {
    summary.innerHTML = `<p class="muted">No history stored yet — open the Heatmap tab once to seed it.</p>`;
    return;
  }

  const buckets = new Array(24).fill(0);
  for (const e of history) {
    const h = new Date(e.played_at).getHours();
    buckets[h]++;
  }
  const max = Math.max(1, ...buckets);
  grid.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement("div");
    cell.className = "tod-bar";
    const intensity = buckets[h] === 0 ? 0 : 0.2 + 0.8 * (buckets[h] / max);
    cell.style.background = `rgba(29, 185, 84, ${intensity})`;
    cell.title = `${h}:00 — ${buckets[h]} plays`;
    cell.innerHTML = `
      <span class="tod-count">${buckets[h]}</span>
      <span class="tod-hour">${String(h).padStart(2, "0")}</span>
    `;
    grid.appendChild(cell);
  }

  const peakHour = buckets.indexOf(max);
  const total = buckets.reduce((a, b) => a + b, 0);
  summary.innerHTML = `
    <div class="stats-row">
      <div class="stat"><span class="stat-num">${peakHour}:00</span><span class="stat-label">peak hour</span></div>
      <div class="stat"><span class="stat-num">${max}</span><span class="stat-label">plays in peak hour</span></div>
      <div class="stat"><span class="stat-num">${total}</span><span class="stat-label">total plays tracked</span></div>
    </div>
  `;
}
