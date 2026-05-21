import { getTopArtists, getArtistTopTracks, checkSavedTracks, saveTracks } from "../api.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">For each of your top artists, we pull their top tracks and surface ones you haven't saved yet. A manual stand-in for Spotify's deprecated /recommendations endpoint.</p>
    <div class="controls">
      <label>Pool from your top:
        <select class="ml-pool">
          <option value="10">10 artists</option>
          <option value="20" selected>20 artists</option>
          <option value="50">50 artists</option>
        </select>
      </label>
      <button class="ml-go">Find tracks</button>
    </div>
    <p class="ml-status muted"></p>
    <div class="ml-list track-list"></div>
  `;

  const $ = (sel) => container.querySelector(sel);
  const list = $(".ml-list");
  const status = $(".ml-status");

  $(".ml-go").addEventListener("click", async () => {
    const pool = Number($(".ml-pool").value);
    $(".ml-go").disabled = true;
    list.innerHTML = "";
    status.textContent = "Fetching top artists…";

    try {
      const top = await getTopArtists("medium_term", pool);
      status.textContent = `Pulling top tracks for ${top.items.length} artists…`;
      const all = [];
      const seen = new Set();
      const results = await Promise.all(
        top.items.map((a) => getArtistTopTracks(a.id).catch(() => ({ tracks: [] })))
      );
      for (const r of results) {
        for (const t of r.tracks ?? []) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            all.push(t);
          }
        }
      }
      if (all.length === 0) {
        status.textContent = "No tracks found.";
        return;
      }
      status.textContent = `Checking which of ${all.length} tracks you've already saved…`;
      const ids = all.map((t) => t.id);
      const savedFlags = [];
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        savedFlags.push(...(await checkSavedTracks(chunk)));
      }
      const candidates = all.filter((_, i) => !savedFlags[i]);
      status.textContent = `${candidates.length} tracks you might like (not yet saved).`;

      candidates.sort((a, b) => b.popularity - a.popularity);
      list.innerHTML = "";
      for (const t of candidates.slice(0, 100)) {
        const li = document.createElement("div");
        li.className = "track-row";
        const art = t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
        li.innerHTML = `
          ${art ? `<img src="${art}" alt="">` : `<div class="img-placeholder small"></div>`}
          <div class="track-meta">
            <strong>${t.name}</strong>
            <small>${t.artists.map((a) => a.name).join(", ")}</small>
          </div>
          <span class="track-duration">★ ${t.popularity}</span>
          <button class="preview-btn ml-save" data-id="${t.id}">Save</button>
        `;
        list.appendChild(li);
      }

      list.querySelectorAll(".ml-save").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Saving…";
          try {
            await saveTracks([btn.dataset.id]);
            btn.textContent = "Saved";
          } catch (e) {
            btn.textContent = "Failed";
          }
        });
      });
    } catch (e) {
      status.innerHTML = `<span class="error">Failed: ${e.message}</span>`;
    } finally {
      $(".ml-go").disabled = false;
    }
  });
}
