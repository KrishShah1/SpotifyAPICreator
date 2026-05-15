import { getTopArtists } from "../api.js";

const TIME_RANGES = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

export async function render(container) {
  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `
    <label>Time range:
      <select class="time-range">
        ${TIME_RANGES.map(
          (r) => `<option value="${r.value}" ${r.value === "medium_term" ? "selected" : ""}>${r.label}</option>`
        ).join("")}
      </select>
    </label>
  `;
  container.appendChild(controls);

  const grid = document.createElement("div");
  grid.className = "card-grid";
  container.appendChild(grid);

  await populate(grid, "medium_term");

  controls.querySelector(".time-range").addEventListener("change", async (e) => {
    grid.innerHTML = '<p class="loading">Loading…</p>';
    try {
      await populate(grid, e.target.value);
    } catch (err) {
      grid.innerHTML = `<p class="error">Couldn't load: ${err.message}</p>`;
    }
  });
}

async function populate(grid, timeRange) {
  const data = await getTopArtists(timeRange, 50);
  grid.innerHTML = "";
  for (const artist of data.items) {
    const card = document.createElement("a");
    card.className = "card artist-card";
    card.href = artist.external_urls.spotify;
    card.target = "_blank";
    card.rel = "noopener";
    const img = artist.images?.[0]?.url
      ? `<img src="${artist.images[0].url}" alt="">`
      : `<div class="img-placeholder"></div>`;
    const genres = (artist.genres ?? []).slice(0, 3).join(", ");
    card.innerHTML = `
      ${img}
      <div class="card-body">
        <strong>${artist.name}</strong>
        <small>${genres}</small>
        <div class="bar"><div class="bar-fill" style="width:${artist.popularity}%"></div></div>
      </div>
    `;
    grid.appendChild(card);
  }
}
