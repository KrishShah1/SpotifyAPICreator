import { getTopArtists, getMyPlaylists, getFollowedArtists } from "../api.js";
import { aggregateGenres } from "../util/genres.js";

export async function render(container) {
  const [artists, playlists, following] = await Promise.all([
    getTopArtists("medium_term", 50).catch(() => ({ items: [] })),
    getMyPlaylists(50).catch(() => ({ items: [] })),
    getFollowedArtists(50).catch(() => ({ artists: { items: [] } })),
  ]);

  const genres = aggregateGenres(artists.items);
  const max = genres[0]?.count ?? 1;

  const intro = document.createElement("p");
  intro.className = "muted";
  intro.textContent = "Genres derived from your top 50 artists in the last 6 months.";
  container.appendChild(intro);

  const counts = document.createElement("div");
  counts.className = "stats-row";
  counts.innerHTML = `
    <div class="stat"><span class="stat-num">${playlists.items?.length ?? 0}</span><span class="stat-label">playlists</span></div>
    <div class="stat"><span class="stat-num">${following.artists?.items?.length ?? 0}</span><span class="stat-label">followed artists</span></div>
    <div class="stat"><span class="stat-num">${genres.length}</span><span class="stat-label">distinct genres</span></div>
  `;
  container.appendChild(counts);

  const top = genres.slice(0, 15);
  const list = document.createElement("ul");
  list.className = "genre-list";
  for (const { genre, count } of top) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="genre-name">${genre}</span>
      <div class="bar"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      <span class="genre-count">${count}</span>
    `;
    list.appendChild(li);
  }
  container.appendChild(list);
}
