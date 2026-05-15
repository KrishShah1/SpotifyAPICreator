import { getRecentlyPlayed } from "../api.js";
import { formatTimeAgo } from "../util/timeAgo.js";

export async function render(container) {
  const data = await getRecentlyPlayed(50);

  if (!data.items?.length) {
    container.innerHTML = '<p class="empty">No recent plays found.</p>';
    return;
  }

  const list = document.createElement("ol");
  list.className = "track-list";
  for (const entry of data.items) {
    const t = entry.track;
    const li = document.createElement("li");
    li.className = "track-row";
    const art = t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
    const artists = t.artists.map((a) => a.name).join(", ");
    li.innerHTML = `
      ${art ? `<img src="${art}" alt="">` : `<div class="img-placeholder small"></div>`}
      <div class="track-meta">
        <strong>${t.name}</strong>
        <small>${artists}</small>
      </div>
      <span class="track-duration">${formatTimeAgo(entry.played_at)}</span>
    `;
    list.appendChild(li);
  }
  container.appendChild(list);
}
