import { getCurrentUser, getTopTracks, createPlaylist, addTracksToPlaylist } from "../api.js";

function currentMonthLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function render(container) {
  const month = currentMonthLabel();
  const monthName = new Date().toLocaleString(undefined, { month: "long", year: "numeric" });
  container.innerHTML = `
    <p class="muted">Save this month's listening as a permanent record. One click → a playlist named "${month} — Top 50" added to your Spotify library.</p>
    <div class="now-playing">
      <span class="np-label">Capsule for</span>
      <strong>${monthName}</strong>
    </div>
    <div class="controls">
      <button class="tc-go">Snapshot top 50 (last 4 weeks)</button>
    </div>
    <p class="tc-status muted"></p>
    <div class="tc-result"></div>
  `;

  const $ = (s) => container.querySelector(s);

  $(".tc-go").addEventListener("click", async () => {
    $(".tc-go").disabled = true;
    $(".tc-status").textContent = "Fetching top tracks…";
    try {
      const me = await getCurrentUser();
      const top = await getTopTracks("short_term", 50);
      const uris = top.items.map((t) => t.uri);
      if (uris.length === 0) {
        $(".tc-status").textContent = "No top tracks for this period.";
        return;
      }
      $(".tc-status").textContent = "Creating playlist…";
      const playlist = await createPlaylist(
        me.id,
        `${month} — Top 50`,
        `Time capsule: top tracks from the 4 weeks ending ${new Date().toISOString().slice(0, 10)}.`,
        false
      );
      $(".tc-status").textContent = "Adding tracks…";
      await addTracksToPlaylist(playlist.id, uris);
      $(".tc-status").textContent = "Done.";
      $(".tc-result").innerHTML = `
        <div class="now-playing">
          <span class="np-label">Saved</span>
          <strong>${playlist.name}</strong> with ${uris.length} tracks.
          <a href="${playlist.external_urls.spotify}" target="_blank" rel="noopener">Open in Spotify</a>
        </div>
      `;
    } catch (e) {
      $(".tc-status").innerHTML = `<span class="error">Failed: ${e.message}</span>`;
    } finally {
      $(".tc-go").disabled = false;
    }
  });
}
