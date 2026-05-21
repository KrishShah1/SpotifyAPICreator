import { getMyPlaylists, getAllPlaylistTracks } from "../api.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Compare any two of your playlists side by side. Useful when you have several similar "vibe" playlists.</p>
    <div class="controls">
      <select class="pd-a"><option>Loading…</option></select>
      <span>vs.</span>
      <select class="pd-b"><option>Loading…</option></select>
      <button class="pd-go">Compare</button>
    </div>
    <p class="pd-status muted"></p>
    <div class="pd-grid"></div>
  `;

  const $ = (s) => container.querySelector(s);
  const a = $(".pd-a");
  const b = $(".pd-b");
  const grid = $(".pd-grid");
  const status = $(".pd-status");

  const playlists = await getMyPlaylists(50);
  const items = playlists.items ?? [];
  if (items.length < 2) {
    status.textContent = "You need at least 2 playlists to compare.";
    return;
  }
  const opts = items.map((p) => `<option value="${p.id}">${p.name} (${p.tracks.total})</option>`).join("");
  a.innerHTML = opts;
  b.innerHTML = opts;
  if (items[1]) b.value = items[1].id;

  $(".pd-go").addEventListener("click", async () => {
    if (a.value === b.value) {
      status.textContent = "Pick two different playlists.";
      return;
    }
    grid.innerHTML = "";
    status.textContent = "Fetching tracks…";
    try {
      const [tracksA, tracksB] = await Promise.all([
        getAllPlaylistTracks(a.value),
        getAllPlaylistTracks(b.value),
      ]);
      const idsA = new Set(tracksA.map((t) => t.track?.id).filter(Boolean));
      const idsB = new Set(tracksB.map((t) => t.track?.id).filter(Boolean));
      const onlyA = tracksA.filter((t) => t.track && !idsB.has(t.track.id));
      const onlyB = tracksB.filter((t) => t.track && !idsA.has(t.track.id));
      const both = tracksA.filter((t) => t.track && idsB.has(t.track.id));
      status.textContent = `${onlyA.length} only in A · ${both.length} in both · ${onlyB.length} only in B`;

      const nameA = items.find((p) => p.id === a.value).name;
      const nameB = items.find((p) => p.id === b.value).name;

      grid.innerHTML = `
        <div class="pd-col"><h3>Only in “${nameA}”</h3><div class="pd-list track-list" data-which="a"></div></div>
        <div class="pd-col"><h3>In both</h3><div class="pd-list track-list" data-which="both"></div></div>
        <div class="pd-col"><h3>Only in “${nameB}”</h3><div class="pd-list track-list" data-which="b"></div></div>
      `;
      const fill = (sel, rows) => {
        const list = grid.querySelector(`.pd-list[data-which="${sel}"]`);
        for (const r of rows) {
          const t = r.track;
          if (!t) continue;
          const art = t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
          const div = document.createElement("div");
          div.className = "track-row";
          div.innerHTML = `
            ${art ? `<img src="${art}" alt="">` : `<div class="img-placeholder small"></div>`}
            <div class="track-meta"><strong>${t.name}</strong><small>${t.artists.map((a) => a.name).join(", ")}</small></div>
          `;
          list.appendChild(div);
        }
      };
      fill("a", onlyA);
      fill("both", both);
      fill("b", onlyB);
    } catch (e) {
      status.innerHTML = `<span class="error">${e.message}</span>`;
    }
  });
}
