import { getCurrentUser, getTopTracks, createPlaylist, addTracksToPlaylist } from "../api.js";

const TIME_RANGES = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Generate a real Spotify playlist from your top tracks. The new playlist will appear in your Spotify library.</p>
    <div class="controls">
      <label>Time range:
        <select class="pg-range">
          ${TIME_RANGES.map((r) => `<option value="${r.value}" ${r.value === "medium_term" ? "selected" : ""}>${r.label}</option>`).join("")}
        </select>
      </label>
      <label>Track count:
        <input type="number" class="pg-count" min="5" max="50" value="25" style="width: 80px;" />
      </label>
      <label>
        <input type="checkbox" class="pg-public" /> Public
      </label>
      <button class="pg-go">Create playlist</button>
    </div>
    <div class="pg-status muted"></div>
    <div class="pg-result"></div>
  `;

  const $ = (sel) => container.querySelector(sel);

  $(".pg-go").addEventListener("click", async () => {
    const range = $(".pg-range").value;
    const count = Math.max(5, Math.min(50, Number($(".pg-count").value)));
    const isPublic = $(".pg-public").checked;
    const status = $(".pg-status");
    const result = $(".pg-result");

    $(".pg-go").disabled = true;
    status.textContent = "Fetching your top tracks…";
    result.innerHTML = "";

    try {
      const me = await getCurrentUser();
      const top = await getTopTracks(range, count);
      const uris = top.items.map((t) => t.uri);
      if (uris.length === 0) {
        status.textContent = "No top tracks found for this range.";
        return;
      }
      const rangeLabel = TIME_RANGES.find((r) => r.value === range).label;
      const today = new Date().toISOString().slice(0, 10);
      status.textContent = "Creating playlist…";
      const playlist = await createPlaylist(
        me.id,
        `My Top ${count} — ${rangeLabel}`,
        `Generated ${today} from your Spotify top tracks (${rangeLabel}).`,
        isPublic
      );
      status.textContent = "Adding tracks…";
      await addTracksToPlaylist(playlist.id, uris);
      status.textContent = "Done.";
      result.innerHTML = `
        <div class="now-playing">
          <span class="np-label">Created</span>
          <strong>${playlist.name}</strong> with ${uris.length} tracks.
          <a href="${playlist.external_urls.spotify}" target="_blank" rel="noopener">Open in Spotify</a>
        </div>
      `;
    } catch (e) {
      status.innerHTML = `<span class="error">Failed: ${e.message}</span>`;
    } finally {
      $(".pg-go").disabled = false;
    }
  });
}
