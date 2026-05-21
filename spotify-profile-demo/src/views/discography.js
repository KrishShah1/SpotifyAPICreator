import { getTopArtists, getFollowedArtists, getArtistAlbums, getAlbumTracks } from "../api.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Pick an artist (your top + followed) to browse their full discography.</p>
    <div class="controls">
      <select class="dc-artist"><option>Loading artists…</option></select>
    </div>
    <div class="dc-album-grid card-grid"></div>
    <div class="dc-album-detail"></div>
  `;

  const $ = (s) => container.querySelector(s);
  const sel = $(".dc-artist");
  const albumGrid = $(".dc-album-grid");
  const albumDetail = $(".dc-album-detail");

  const [top, followed] = await Promise.all([
    getTopArtists("medium_term", 50).catch(() => ({ items: [] })),
    getFollowedArtists(50).catch(() => ({ artists: { items: [] } })),
  ]);
  const artistsMap = new Map();
  for (const a of top.items ?? []) artistsMap.set(a.id, a);
  for (const a of followed.artists?.items ?? []) artistsMap.set(a.id, a);
  const artists = [...artistsMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (artists.length === 0) {
    sel.innerHTML = `<option>No artists found</option>`;
    return;
  }
  sel.innerHTML = artists.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");

  async function loadAlbums(artistId) {
    albumGrid.innerHTML = `<p class="loading">Loading albums…</p>`;
    albumDetail.innerHTML = "";
    const data = await getArtistAlbums(artistId, 50, 0, "album,single,compilation");
    const seen = new Set();
    const unique = [];
    for (const al of data.items ?? []) {
      const key = al.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(al);
      }
    }
    unique.sort((a, b) => b.release_date.localeCompare(a.release_date));
    albumGrid.innerHTML = "";
    for (const al of unique) {
      const card = document.createElement("div");
      card.className = "card dc-album-card";
      const img = al.images?.[0]?.url ? `<img src="${al.images[0].url}" alt="">` : `<div class="img-placeholder"></div>`;
      card.innerHTML = `
        ${img}
        <div class="card-body">
          <strong>${al.name}</strong>
          <small>${al.album_type} · ${al.release_date}</small>
        </div>
      `;
      card.addEventListener("click", () => loadAlbumTracks(al));
      albumGrid.appendChild(card);
    }
  }

  async function loadAlbumTracks(album) {
    albumDetail.innerHTML = `<p class="loading">Loading tracks…</p>`;
    const tracks = await getAlbumTracks(album.id, 50);
    albumDetail.innerHTML = `
      <h3>${album.name}</h3>
      <p class="muted">${album.album_type} · ${album.release_date} · <a href="${album.external_urls.spotify}" target="_blank" rel="noopener">Open in Spotify</a></p>
    `;
    const list = document.createElement("ol");
    list.className = "track-list";
    for (const t of tracks.items ?? []) {
      const li = document.createElement("li");
      li.className = "track-row";
      li.innerHTML = `
        <div class="img-placeholder small"></div>
        <div class="track-meta"><strong>${t.name}</strong><small>${t.artists.map((a) => a.name).join(", ")}</small></div>
        <span class="track-duration">${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}</span>
      `;
      list.appendChild(li);
    }
    albumDetail.appendChild(list);
  }

  sel.addEventListener("change", () => loadAlbums(sel.value).catch((e) => {
    albumGrid.innerHTML = `<p class="error">${e.message}</p>`;
  }));

  await loadAlbums(sel.value);
}
