import { getTopTracks } from "../api.js";

const TIME_RANGES = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

let currentAudio = null;

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export async function render(container) {
  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `
    <label>Time range:
      <select class="time-range">
        ${TIME_RANGES.map(
          (r) => `<option value="${r.value}" ${r.value === "medium_term" ? "selected" : ""}>${r.label}</option>`
        ).join("")}
      </select>
    </label>
  `;
  container.appendChild(controls);

  const list = document.createElement("ol");
  list.className = "track-list";
  container.appendChild(list);

  await populate(list, "medium_term");

  controls.querySelector(".time-range").addEventListener("change", async (e) => {
    list.innerHTML = '<li class="loading">Loading…</li>';
    try {
      await populate(list, e.target.value);
    } catch (err) {
      list.innerHTML = `<li class="error">Couldn't load: ${err.message}</li>`;
    }
  });
}

async function populate(list, timeRange) {
  const data = await getTopTracks(timeRange, 50);
  list.innerHTML = "";
  for (const t of data.items) {
    const li = document.createElement("li");
    li.className = "track-row";
    const art = t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
    const artists = t.artists.map((a) => a.name).join(", ");
    const preview = t.preview_url
      ? `<button class="preview-btn" data-src="${t.preview_url}">▶︎</button>`
      : `<span class="preview-empty"></span>`;
    li.innerHTML = `
      ${art ? `<img src="${art}" alt="">` : `<div class="img-placeholder small"></div>`}
      <div class="track-meta">
        <strong>${t.name}</strong>
        <small>${artists}</small>
      </div>
      <span class="track-duration">${fmtDuration(t.duration_ms)}</span>
      ${preview}
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".preview-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      const audio = new Audio(btn.dataset.src);
      audio.play();
      currentAudio = audio;
      audio.addEventListener("ended", () => {
        if (currentAudio === audio) currentAudio = null;
      });
    });
  });
}
