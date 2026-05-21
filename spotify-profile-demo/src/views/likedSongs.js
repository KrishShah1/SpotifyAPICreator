import { getMyTracks } from "../api.js";

export async function render(container) {
  container.innerHTML = `
    <p class="muted">Your full Liked Songs library. Loaded in pages of 50.</p>
    <div class="controls">
      <input type="text" class="lk-search" placeholder="Search by track or artist…" />
      <select class="lk-sort">
        <option value="added_desc">Newest first</option>
        <option value="added_asc">Oldest first</option>
        <option value="name">By track name</option>
        <option value="artist">By artist</option>
      </select>
      <span class="lk-status muted"></span>
    </div>
    <ol class="lk-list track-list"></ol>
    <div class="controls">
      <button class="lk-load-more">Load more</button>
    </div>
  `;

  const $ = (s) => container.querySelector(s);
  const list = $(".lk-list");
  let offset = 0;
  const PAGE = 50;
  let all = [];
  let total = 0;

  async function loadPage() {
    $(".lk-status").textContent = "Loading…";
    const page = await getMyTracks(PAGE, offset);
    total = page.total;
    for (const item of page.items) {
      all.push({
        added_at: item.added_at,
        track: item.track,
      });
    }
    offset += page.items.length;
    $(".lk-status").textContent = `${all.length} of ${total} loaded`;
    if (offset >= total) $(".lk-load-more").disabled = true;
    paint();
  }

  function paint() {
    const q = $(".lk-search").value.toLowerCase().trim();
    const sort = $(".lk-sort").value;
    let rows = q
      ? all.filter(
          (e) =>
            e.track.name.toLowerCase().includes(q) ||
            e.track.artists.some((a) => a.name.toLowerCase().includes(q))
        )
      : all.slice();

    if (sort === "added_desc") rows.sort((a, b) => b.added_at.localeCompare(a.added_at));
    else if (sort === "added_asc") rows.sort((a, b) => a.added_at.localeCompare(b.added_at));
    else if (sort === "name") rows.sort((a, b) => a.track.name.localeCompare(b.track.name));
    else if (sort === "artist") rows.sort((a, b) => a.track.artists[0].name.localeCompare(b.track.artists[0].name));

    list.innerHTML = "";
    for (const e of rows.slice(0, 500)) {
      const t = e.track;
      const art = t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
      const li = document.createElement("li");
      li.className = "track-row";
      li.innerHTML = `
        ${art ? `<img src="${art}" alt="">` : `<div class="img-placeholder small"></div>`}
        <div class="track-meta">
          <strong>${t.name}</strong>
          <small>${t.artists.map((a) => a.name).join(", ")}</small>
        </div>
        <span class="track-duration">${e.added_at.slice(0, 10)}</span>
      `;
      list.appendChild(li);
    }
  }

  $(".lk-search").addEventListener("input", paint);
  $(".lk-sort").addEventListener("change", paint);
  $(".lk-load-more").addEventListener("click", () => loadPage().catch((e) => {
    $(".lk-status").innerHTML = `<span class="error">${e.message}</span>`;
  }));

  await loadPage();
}
