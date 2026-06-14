import {
  getCurrentUser,
  getCurrentlyPlaying,
  getTopArtists,
  getMyPlaylists,
  getFollowedArtists,
} from "../api.js";

export async function render(container) {
  const [profile, playing, topArtists, playlists, following] = await Promise.all([
    getCurrentUser(),
    getCurrentlyPlaying().catch(() => null),
    getTopArtists("medium_term", 50).catch(() => ({ items: [] })),
    getMyPlaylists(50).catch(() => ({ items: [] })),
    getFollowedArtists(50).catch(() => ({ artists: { items: [] } })),
  ]);

  const profileCard = document.createElement("div");
  profileCard.className = "profile-card";
  const img = profile.images?.[0]?.url
    ? `<img src="${profile.images[0].url}" class="avatar" alt="">`
    : "";
  profileCard.innerHTML = `
    ${img}
    <div>
      <h2>${profile.display_name ?? profile.id}</h2>
      <p>${profile.email ?? ""}</p>
      <a href="${profile.external_urls.spotify}" target="_blank" rel="noopener">Open in Spotify</a>
    </div>
  `;
  container.appendChild(profileCard);

  const name = profile.display_name ?? profile.id;
  const headerUser = document.getElementById("header-user");
  if (headerUser) headerUser.textContent = name;
  const mobileUser = document.getElementById("mobile-user");
  if (mobileUser) mobileUser.textContent = name;

  if (playing && playing.item) {
    const np = document.createElement("div");
    np.className = "now-playing";
    const artists = playing.item.artists.map((a) => a.name).join(", ");
    np.innerHTML = `
      <span class="np-label">Now playing</span>
      <strong>${playing.item.name}</strong> — ${artists}
    `;
    container.appendChild(np);
  }

  const stats = document.createElement("div");
  stats.className = "stats-row";
  stats.innerHTML = `
    <div class="stat"><span class="stat-num">${topArtists.items.length}</span><span class="stat-label">top artists tracked</span></div>
    <div class="stat"><span class="stat-num">${playlists.items?.length ?? 0}</span><span class="stat-label">playlists</span></div>
    <div class="stat"><span class="stat-num">${following.artists?.items?.length ?? 0}</span><span class="stat-label">followed artists</span></div>
  `;
  container.appendChild(stats);
}
