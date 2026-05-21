import { getTopTracks, getTopArtists } from "../api.js";

const RANGES = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

function rankMap(items) {
  const m = new Map();
  items.forEach((it, i) => m.set(it.id, { rank: i + 1, item: it }));
  return m;
}

function deltaArrow(curRank, prevMap) {
  if (!prevMap) return "";
  const prev = prevMap.get(arguments[2]);
  if (!prev) return `<span class="tt-new">NEW</span>`;
  const diff = prev.rank - curRank;
  if (diff > 0) return `<span class="tt-up">▲ ${diff}</span>`;
  if (diff < 0) return `<span class="tt-down">▼ ${-diff}</span>`;
  return `<span class="tt-same">—</span>`;
}

function buildColumn(title, items, prevMap) {
  const col = document.createElement("div");
  col.className = "tt-col";
  col.innerHTML = `<h3>${title}</h3>`;
  const list = document.createElement("ol");
  list.className = "tt-list";
  items.slice(0, 10).forEach((it, i) => {
    const li = document.createElement("li");
    const rank = i + 1;
    const prev = prevMap?.get(it.id);
    let delta;
    if (!prevMap) delta = "";
    else if (!prev) delta = `<span class="tt-new">NEW</span>`;
    else {
      const diff = prev.rank - rank;
      if (diff > 0) delta = `<span class="tt-up">▲${diff}</span>`;
      else if (diff < 0) delta = `<span class="tt-down">▼${-diff}</span>`;
      else delta = `<span class="tt-same">—</span>`;
    }
    const subtitle = it.artists ? it.artists.map((a) => a.name).join(", ") : (it.genres ?? []).slice(0, 2).join(", ");
    li.innerHTML = `
      <span class="tt-rank">${rank}</span>
      <div class="tt-meta">
        <strong>${it.name}</strong>
        <small>${subtitle}</small>
      </div>
      <span class="tt-delta">${delta}</span>
    `;
    list.appendChild(li);
  });
  col.appendChild(list);
  return col;
}

export async function render(container) {
  container.innerHTML = `
    <p class="muted">How your taste shifts across time ranges. Arrows compare each item's rank vs. the next-longer range.</p>
    <div class="controls">
      <label>Show:
        <select class="tt-mode">
          <option value="tracks" selected>Tracks</option>
          <option value="artists">Artists</option>
        </select>
      </label>
    </div>
    <div class="tt-grid"></div>
  `;

  const grid = container.querySelector(".tt-grid");
  const modeSel = container.querySelector(".tt-mode");

  async function load() {
    grid.innerHTML = `<p class="loading">Loading…</p>`;
    const mode = modeSel.value;
    const fetchFn = mode === "tracks" ? getTopTracks : getTopArtists;
    const [shortT, medT, longT] = await Promise.all([
      fetchFn("short_term", 50),
      fetchFn("medium_term", 50),
      fetchFn("long_term", 50),
    ]);
    const sM = rankMap(shortT.items);
    const mM = rankMap(medT.items);
    const lM = rankMap(longT.items);
    grid.innerHTML = "";
    grid.appendChild(buildColumn("Last 4 weeks", shortT.items, mM));
    grid.appendChild(buildColumn("Last 6 months", medT.items, lM));
    grid.appendChild(buildColumn("All time", longT.items, null));
  }

  modeSel.addEventListener("change", () => load().catch((e) => {
    grid.innerHTML = `<p class="error">Failed: ${e.message}</p>`;
  }));

  await load();
}
