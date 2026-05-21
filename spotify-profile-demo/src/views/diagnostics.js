import { getAccessToken } from "../auth.js";

const API_BASE = "https://api.spotify.com/v1";

const ENDPOINTS = [
  { path: "/me", scope: "user-read-private", note: "Profile (sanity check)" },
  { path: "/me/top/artists?limit=1", scope: "user-top-read", note: "Top artists" },
  { path: "/me/top/tracks?limit=1", scope: "user-top-read", note: "Top tracks" },
  { path: "/me/player/recently-played?limit=1", scope: "user-read-recently-played", note: "Recently played" },
  { path: "/me/player/currently-playing", scope: "user-read-currently-playing", note: "Now playing" },
  { path: "/me/playlists?limit=1", scope: "playlist-read-private", note: "Your playlists" },
  { path: "/me/following?type=artist&limit=1", scope: "user-follow-read", note: "Followed artists" },
  { path: "/me/tracks?limit=1", scope: "user-library-read", note: "Liked Songs (saved tracks)" },
  { path: "/me/albums?limit=1", scope: "user-library-read", note: "Saved albums" },
  { path: "/search?q=test&type=track&limit=1", scope: "(none)", note: "Search" },
  { path: "/browse/new-releases?limit=1", scope: "(none)", note: "New releases" },
  { path: "/browse/featured-playlists?limit=1", scope: "(none)", note: "Featured playlists" },
  { path: "/recommendations?seed_genres=indie&limit=5", scope: "(none)", note: "Recommendations" },
  { path: "/audio-features?ids=4cOdK2wGLETKBW3PvgPWqT", scope: "(none)", note: "Audio features" },
  { path: "/artists/4tZwfgrHOc3mvqYlEYSvVi/related-artists", scope: "(none)", note: "Related artists" },
];

function statusClass(status) {
  if (status === 0) return "diag-pending";
  if (status >= 200 && status < 300) return "diag-ok";
  if (status >= 400 && status < 500) return "diag-fail";
  return "diag-warn";
}

function verdictFor(status, bodyText) {
  if (status === 200 || status === 204) return "OK";
  if (status === 401) return "Unauthorized — token expired or missing required scope";
  if (status === 403) {
    if (/deprecat|no longer available|extension/i.test(bodyText)) {
      return "Forbidden — likely deprecated for this app";
    }
    return "Forbidden — missing scope or app not allowlisted";
  }
  if (status === 404) return "Not Found — endpoint removed/deprecated for this app";
  if (status === 429) return "Rate limited";
  if (status >= 500) return "Spotify server error";
  if (status === 0) return "Network error";
  return `HTTP ${status}`;
}

async function probe(endpoint, token) {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}${endpoint.path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ms = Math.round(performance.now() - start);
    const text = await res.text();
    return { status: res.status, ms, body: text };
  } catch (e) {
    const ms = Math.round(performance.now() - start);
    return { status: 0, ms, body: String(e) };
  }
}

function buildRow(endpoint) {
  const row = document.createElement("div");
  row.className = "diag-row";
  row.innerHTML = `
    <div class="diag-head">
      <span class="diag-pill diag-pending">…</span>
      <code class="diag-path">GET ${endpoint.path}</code>
      <span class="diag-meta">${endpoint.note} · scope: ${endpoint.scope}</span>
      <span class="diag-time"></span>
      <button class="diag-toggle" hidden>Show body</button>
    </div>
    <pre class="diag-body" hidden></pre>
  `;
  const toggle = row.querySelector(".diag-toggle");
  const body = row.querySelector(".diag-body");
  toggle.addEventListener("click", () => {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? "Show body" : "Hide body";
  });
  return row;
}

function applyResult(row, result) {
  const pill = row.querySelector(".diag-pill");
  const time = row.querySelector(".diag-time");
  const meta = row.querySelector(".diag-meta");
  const toggle = row.querySelector(".diag-toggle");
  const body = row.querySelector(".diag-body");

  pill.className = `diag-pill ${statusClass(result.status)}`;
  pill.textContent = result.status === 0 ? "ERR" : String(result.status);
  time.textContent = `${result.ms} ms`;

  const verdict = verdictFor(result.status, result.body);
  meta.textContent = `${meta.textContent.split(" · ")[0]} · ${verdict}`;

  toggle.hidden = false;
  let pretty = result.body;
  try {
    pretty = JSON.stringify(JSON.parse(result.body), null, 2);
  } catch {
    /* keep as text */
  }
  body.textContent = pretty.length > 4000 ? pretty.slice(0, 4000) + "\n…(truncated)" : pretty;
}

export async function render(container) {
  const intro = document.createElement("p");
  intro.className = "muted";
  intro.textContent =
    "Probes each Spotify endpoint we might use. Useful to see which calls are gated for your app (deprecated endpoints, missing scopes, premium-only features).";
  container.appendChild(intro);

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `<button class="run-all">Run all</button>`;
  container.appendChild(controls);

  const list = document.createElement("div");
  list.className = "diag-list";
  const rows = ENDPOINTS.map((ep) => {
    const row = buildRow(ep);
    list.appendChild(row);
    return { ep, row };
  });
  container.appendChild(list);

  const runBtn = controls.querySelector(".run-all");
  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    runBtn.textContent = "Running…";
    const token = await getAccessToken();
    if (!token) {
      intro.textContent = "Not authenticated — log in first.";
      runBtn.disabled = false;
      runBtn.textContent = "Run all";
      return;
    }
    await Promise.all(
      rows.map(async ({ ep, row }) => {
        const result = await probe(ep, token);
        applyResult(row, result);
      })
    );
    runBtn.disabled = false;
    runBtn.textContent = "Run all again";
  });
}
