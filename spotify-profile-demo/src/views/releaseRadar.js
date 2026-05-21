import { getFollowedArtists, getArtistAlbums } from "../api.js";

const DAYS_DEFAULT = 30;

function daysSince(dateStr) {
  // Spotify gives "YYYY-MM-DD" or "YYYY" or "YYYY-MM"
  const padded = dateStr.length === 4 ? `${dateStr}-01-01` : dateStr.length === 7 ? `${dateStr}-01` : dateStr;
  const d = new Date(padded);
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

export async function render(container) {
  container.innerHTML = `
    <p class="muted">New albums and singles from artists you follow, in the last N days.</p>
    <div class="controls">
      <label>Window:
        <select class="rr-window">
          <option value="14">Last 2 weeks</option>
          <option value="30" selected>Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </label>
      <button class="rr-go">Refresh</button>
      <span class="rr-status muted"></span>
    </div>
    <div class="card-grid rr-grid"></div>
  `;

  const $ = (s) => container.querySelector(s);
  const grid = $(".rr-grid");
  const status = $(".rr-status");

  async function load() {
    grid.innerHTML = "";
    const window = Number($(".rr-window").value);
    status.textContent = "Fetching followed artists…";
    const followed = await getFollowedArtists(50);
    const artists = followed.artists?.items ?? [];
    if (artists.length === 0) {
      status.textContent = "You don't follow any artists.";
      return;
    }
    status.textContent = `Checking releases from ${artists.length} artists…`;
    const all = [];
    const results = await Promise.all(
      artists.map((a) =>
        getArtistAlbums(a.id, 10, 0, "album,single").then((r) => ({ artist: a, albums: r.items ?? [] })).catch(() => ({ artist: a, albums: [] }))
      )
    );
    for (const { artist, albums } of results) {
      for (const al of albums) {
        if (daysSince(al.release_date) <= window) {
          all.push({ ...al, follower_artist: artist.name });
        }
      }
    }
    all.sort((a, b) => b.release_date.localeCompare(a.release_date));
    status.textContent = `${all.length} recent releases.`;
    grid.innerHTML = "";
    for (const al of all) {
      const card = document.createElement("a");
      card.className = "card";
      card.href = al.external_urls.spotify;
      card.target = "_blank";
      card.rel = "noopener";
      const img = al.images?.[0]?.url
        ? `<img src="${al.images[0].url}" alt="">`
        : `<div class="img-placeholder"></div>`;
      card.innerHTML = `
        ${img}
        <div class="card-body">
          <strong>${al.name}</strong>
          <small>${al.artists.map((a) => a.name).join(", ")}</small>
          <small class="muted">${al.album_type} · ${al.release_date}</small>
        </div>
      `;
      grid.appendChild(card);
    }
  }

  $(".rr-go").addEventListener("click", () => load().catch((e) => {
    status.innerHTML = `<span class="error">${e.message}</span>`;
  }));
  await load();
}
