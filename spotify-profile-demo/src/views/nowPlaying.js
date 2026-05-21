import { getCurrentlyPlaying } from "../api.js";

const POLL_MS = 10000;
let pollHandle = null;
let tickHandle = null;

export async function render(container) {
  container.innerHTML = `
    <div class="np-card">
      <div class="np-art-wrap"><div class="np-art-placeholder"></div></div>
      <div class="np-info">
        <div class="np-state muted">Checking…</div>
        <h2 class="np-title">—</h2>
        <p class="np-artist muted"></p>
        <div class="np-progress">
          <div class="np-progress-fill"></div>
        </div>
        <div class="np-times muted"><span class="np-pos">0:00</span><span class="np-dur">0:00</span></div>
      </div>
    </div>
    <p class="muted">Auto-refreshes every 10 seconds.</p>
  `;

  let durationMs = 0;
  let progressMs = 0;
  let isPlaying = false;
  let lastSync = Date.now();

  const $ = (sel) => container.querySelector(sel);

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function paint() {
    if (durationMs > 0) {
      const pct = Math.min(100, (progressMs / durationMs) * 100);
      $(".np-progress-fill").style.width = `${pct}%`;
      $(".np-pos").textContent = fmt(progressMs);
      $(".np-dur").textContent = fmt(durationMs);
    }
  }

  async function refresh() {
    try {
      const data = await getCurrentlyPlaying();
      if (!data || !data.item) {
        $(".np-state").textContent = "Nothing playing right now.";
        $(".np-title").textContent = "—";
        $(".np-artist").textContent = "";
        $(".np-art-wrap").innerHTML = `<div class="np-art-placeholder"></div>`;
        durationMs = 0;
        progressMs = 0;
        isPlaying = false;
        paint();
        return;
      }
      const t = data.item;
      durationMs = t.duration_ms;
      progressMs = data.progress_ms ?? 0;
      isPlaying = !!data.is_playing;
      lastSync = Date.now();

      const art = t.album?.images?.[0]?.url;
      $(".np-art-wrap").innerHTML = art
        ? `<img class="np-art" src="${art}" alt="">`
        : `<div class="np-art-placeholder"></div>`;
      $(".np-state").textContent = isPlaying ? "Now playing" : "Paused";
      $(".np-title").textContent = t.name;
      $(".np-artist").textContent = t.artists.map((a) => a.name).join(", ");
      paint();
    } catch (e) {
      $(".np-state").textContent = `Error: ${e.message}`;
    }
  }

  await refresh();
  pollHandle = setInterval(refresh, POLL_MS);
  tickHandle = setInterval(() => {
    if (isPlaying && durationMs > 0) {
      progressMs += Date.now() - lastSync;
      lastSync = Date.now();
      if (progressMs > durationMs) progressMs = durationMs;
      paint();
    }
  }, 1000);
}

export function teardown() {
  if (pollHandle) clearInterval(pollHandle);
  if (tickHandle) clearInterval(tickHandle);
  pollHandle = null;
  tickHandle = null;
}
