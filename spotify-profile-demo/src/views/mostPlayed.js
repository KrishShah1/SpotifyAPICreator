import { loadHistory } from "../util/history.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Most-played tracks and artists across your stored history. Different from Spotify's "top tracks" — this counts what you've actually played in the window we've been observing.</p>
    <div class="controls">
      <label>Show:
        <select class="mp-mode">
          <option value="tracks" selected>Tracks</option>
          <option value="artists">Artists</option>
        </select>
      </label>
      <span class="mp-stats muted"></span>
    </div>
    <ol class="mp-list track-list"></ol>
  `;

  const $ = (s) => container.querySelector(s);
  const list = $(".mp-list");
  const stats = $(".mp-stats");
  const history = loadHistory();

  if (history.length === 0) {
    stats.innerHTML = `<span class="muted">No history yet — open the Heatmap tab to start tracking.</span>`;
    return;
  }

  function paint() {
    const mode = $(".mp-mode").value;
    const counts = new Map();
    for (const e of history) {
      const key = mode === "tracks" ? `${e.track_id}` : e.artist;
      const display = mode === "tracks" ? `${e.name} — ${e.artist}` : e.artist;
      const cur = counts.get(key) ?? { display, count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
    const rows = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 50);
    stats.textContent = `${counts.size} unique ${mode} across ${history.length} plays`;
    list.innerHTML = "";
    const max = rows[0]?.count ?? 1;
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "track-row";
      li.innerHTML = `
        <span class="tt-rank">${i + 1}</span>
        <div class="track-meta"><strong>${r.display}</strong></div>
        <div class="bar" style="width: 120px;"><div class="bar-fill" style="width:${(r.count / max) * 100}%"></div></div>
        <span class="track-duration">${r.count}</span>
      `;
      list.appendChild(li);
    });
  }

  $(".mp-mode").addEventListener("change", paint);
  paint();
}
