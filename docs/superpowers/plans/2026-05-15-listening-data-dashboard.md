# Listening Data Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Spotify-authenticated Vite app with a tabbed dashboard showing top artists, top tracks, recently played, currently playing, and a derived genre + library breakdown.

**Architecture:** Vanilla JS, no framework added. New `views/` directory with one render module per tab; tiny `router.js` for tab switching with lazy first-render and in-memory cache. `api.js` extended with new endpoint functions and a small shared cache so views that need the same data don't refetch. `auth.js` scopes string extended; PKCE flow already handles re-auth.

**Tech Stack:** Vanilla JavaScript (ES modules), Vite, Spotify Web API, browser `fetch` + `crypto.subtle`, plain CSS.

**Spec:** `docs/superpowers/specs/2026-05-14-listening-data-dashboard-design.md`

**No test framework** is in this repo. The tasks below use targeted manual verification (browser interaction, network tab) rather than unit tests, matching the existing project's posture. Where a pure function exists (e.g., genre aggregation, time-ago formatting), the plan adds a tiny inline self-check via `console.assert` in dev so we can still verify behavior cheaply.

---

## File Structure

**Create:**
- `spotify-profile-demo/src/router.js` — tab switcher, lazy render, panel cache
- `spotify-profile-demo/src/views/overview.js` — profile + currently-playing + quick stats
- `spotify-profile-demo/src/views/topArtists.js` — artist grid w/ time-range dropdown
- `spotify-profile-demo/src/views/topTracks.js` — track list w/ preview playback
- `spotify-profile-demo/src/views/recentlyPlayed.js` — last-50 list w/ time-ago
- `spotify-profile-demo/src/views/genres.js` — genre bars + library counts
- `spotify-profile-demo/src/util/timeAgo.js` — `formatTimeAgo(isoString)` helper
- `spotify-profile-demo/src/util/genres.js` — `aggregateGenres(artists)` helper

**Modify:**
- `spotify-profile-demo/src/auth.js` — extend `SCOPES` constant
- `spotify-profile-demo/src/api.js` — enrich `fetchWithAuth` errors, add new endpoint functions, add shared in-flight/result cache
- `spotify-profile-demo/src/script.js` — after auth success, mount router instead of calling `showProfile`
- `spotify-profile-demo/index.html` — replace `#profile-section` with tab nav + 5 panel divs
- `spotify-profile-demo/style.css` — tab nav, panels, card grid, list rows, bars, dark palette

---

## Task 1: Add scopes and re-auth verification

**Files:**
- Modify: `spotify-profile-demo/src/auth.js:3`

- [ ] **Step 1: Update the SCOPES constant**

Replace line 3 of `spotify-profile-demo/src/auth.js`:

```js
const SCOPES = "user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read user-read-recently-played";
```

- [ ] **Step 2: Manual verify**

Run dev server: `npm run dev` from `spotify-profile-demo/`. Open `http://127.0.0.1:5173`. Click "Log in with Spotify". On Spotify's consent screen, confirm the new permissions (top items, recently played) appear. Approve. After redirect, profile loads as before.

- [ ] **Step 3: Commit**

```bash
git add spotify-profile-demo/src/auth.js
git commit -m "Add user-top-read and user-read-recently-played scopes"
```

---

## Task 2: Enrich `fetchWithAuth` errors

**Files:**
- Modify: `spotify-profile-demo/src/api.js:5-18`

- [ ] **Step 1: Replace `fetchWithAuth` to attach status and Retry-After**

Replace the entire body of `fetchWithAuth` in `src/api.js` with:

```js
async function fetchWithAuth(endpoint) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const err = new Error(`API error: ${response.status}`);
    err.status = response.status;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) err.retryAfter = Number(retryAfter);
    throw err;
  }

  return response.json();
}
```

Note the new 204 handling — required for `getCurrentlyPlaying()` later.

- [ ] **Step 2: Manual verify existing call still works**

Reload the dev server tab. Profile section still loads (calls `getCurrentUser`). No console errors.

- [ ] **Step 3: Commit**

```bash
git add spotify-profile-demo/src/api.js
git commit -m "Attach status and retryAfter to fetchWithAuth errors, handle 204"
```

---

## Task 3: Add new API functions with shared cache

**Files:**
- Modify: `spotify-profile-demo/src/api.js`

- [ ] **Step 1: Append shared cache + new endpoint functions**

Append to `src/api.js`:

```js
const cache = new Map();

function cached(key, fetcher) {
  if (cache.has(key)) return cache.get(key);
  const promise = fetcher().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, promise);
  return promise;
}

export function clearApiCache() {
  cache.clear();
}

export function getTopArtists(timeRange = "medium_term", limit = 50) {
  const key = `topArtists:${timeRange}:${limit}`;
  return cached(key, () =>
    fetchWithAuth(`/me/top/artists?time_range=${timeRange}&limit=${limit}`)
  );
}

export function getTopTracks(timeRange = "medium_term", limit = 50) {
  const key = `topTracks:${timeRange}:${limit}`;
  return cached(key, () =>
    fetchWithAuth(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`)
  );
}

export function getRecentlyPlayed(limit = 50) {
  return cached(`recentlyPlayed:${limit}`, () =>
    fetchWithAuth(`/me/player/recently-played?limit=${limit}`)
  );
}

export function getCurrentlyPlaying() {
  return fetchWithAuth(`/me/player/currently-playing`);
}

export function getMyPlaylists(limit = 50) {
  return cached(`playlists:${limit}`, () =>
    fetchWithAuth(`/me/playlists?limit=${limit}`)
  );
}

export function getFollowedArtists(limit = 50) {
  return cached(`following:${limit}`, () =>
    fetchWithAuth(`/me/following?type=artist&limit=${limit}`)
  );
}
```

`getCurrentlyPlaying` is intentionally uncached — it's live state.

- [ ] **Step 2: Manual smoke test in browser console**

Reload. In DevTools console:

```js
const api = await import("/src/api.js");
console.log((await api.getTopArtists()).items.length); // expect 1..50
console.log((await api.getTopArtists()).items.length); // 2nd call: instant (cache hit, no network in Network tab)
console.log(await api.getCurrentlyPlaying()); // null if nothing playing, else object
```

- [ ] **Step 3: Commit**

```bash
git add spotify-profile-demo/src/api.js
git commit -m "Add listening-data API functions with shared in-memory cache"
```

---

## Task 4: Add `timeAgo` and `aggregateGenres` helpers

**Files:**
- Create: `spotify-profile-demo/src/util/timeAgo.js`
- Create: `spotify-profile-demo/src/util/genres.js`

- [ ] **Step 1: Create `src/util/timeAgo.js`**

```js
export function formatTimeAgo(isoString, now = Date.now()) {
  const ms = now - new Date(isoString).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

if (import.meta.env?.DEV) {
  const fixed = new Date("2026-05-15T12:00:00Z").getTime();
  console.assert(formatTimeAgo("2026-05-15T11:59:30Z", fixed) === "30s ago");
  console.assert(formatTimeAgo("2026-05-15T11:30:00Z", fixed) === "30 mins ago");
  console.assert(formatTimeAgo("2026-05-15T09:00:00Z", fixed) === "3 hrs ago");
  console.assert(formatTimeAgo("2026-05-13T12:00:00Z", fixed) === "2 days ago");
}
```

- [ ] **Step 2: Create `src/util/genres.js`**

```js
export function aggregateGenres(artists) {
  const counts = new Map();
  for (const a of artists) {
    for (const g of a.genres ?? []) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }));
}

if (import.meta.env?.DEV) {
  const sample = [
    { genres: ["indie rock", "indie"] },
    { genres: ["indie rock"] },
    { genres: [] },
    { genres: ["dream pop", "indie"] },
  ];
  const out = aggregateGenres(sample);
  console.assert(out[0].genre === "indie rock" && out[0].count === 2);
  console.assert(out.find((x) => x.genre === "indie").count === 2);
  console.assert(out.find((x) => x.genre === "dream pop").count === 1);
}
```

- [ ] **Step 3: Manual verify**

Reload dev server tab. Check DevTools console — no `console.assert` failures (failed asserts log a stack trace; absence means pass).

- [ ] **Step 4: Commit**

```bash
git add spotify-profile-demo/src/util/
git commit -m "Add timeAgo and aggregateGenres helpers with inline dev asserts"
```

---

## Task 5: Replace HTML structure with tab nav + panels

**Files:**
- Modify: `spotify-profile-demo/index.html`

- [ ] **Step 1: Replace `#app` body**

Replace the contents of `<div id="app">` with:

```html
<div id="app">
  <header id="app-header" style="display: none">
    <h1>Spotify Listening Dashboard</h1>
    <span id="header-user"></span>
    <button id="logout-btn">Log out</button>
  </header>

  <p id="status"></p>

  <div id="login-section" style="display: none">
    <p>Connect your Spotify account to get started.</p>
    <button id="login-btn">Log in with Spotify</button>
  </div>

  <nav id="tab-nav" style="display: none">
    <button class="tab-btn" data-tab="overview">Overview</button>
    <button class="tab-btn" data-tab="topArtists">Top Artists</button>
    <button class="tab-btn" data-tab="topTracks">Top Tracks</button>
    <button class="tab-btn" data-tab="recentlyPlayed">Recently Played</button>
    <button class="tab-btn" data-tab="genres">Genres &amp; Library</button>
  </nav>

  <main id="panels" style="display: none">
    <section class="panel" data-panel="overview"></section>
    <section class="panel" data-panel="topArtists" hidden></section>
    <section class="panel" data-panel="topTracks" hidden></section>
    <section class="panel" data-panel="recentlyPlayed" hidden></section>
    <section class="panel" data-panel="genres" hidden></section>
  </main>
</div>
```

The old `#profile-section` is removed; profile content moves into the Overview panel.

- [ ] **Step 2: Manual verify**

If you're currently logged in, click "Log out" first — the old `script.js` references DOM IDs we just removed (`displayName`, `email`, etc.), so a logged-in reload will throw until Task 12 lands. Logged-out reload shows the login button only. That's expected.

- [ ] **Step 3: Commit**

```bash
git add spotify-profile-demo/index.html
git commit -m "Replace profile section with tab nav and panel containers"
```

---

## Task 6: Build the router

**Files:**
- Create: `spotify-profile-demo/src/router.js`

- [ ] **Step 1: Create `src/router.js`**

```js
const views = new Map();
const rendered = new Set();
let activeTab = null;

export function registerView(name, renderFn) {
  views.set(name, renderFn);
}

export function activateTab(name) {
  if (!views.has(name)) throw new Error(`Unknown tab: ${name}`);

  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.hidden = p.dataset.panel !== name;
  });

  activeTab = name;

  if (!rendered.has(name)) {
    const panel = document.querySelector(`.panel[data-panel="${name}"]`);
    rendered.add(name);
    renderInto(name, panel);
  }
}

export function invalidateTab(name) {
  rendered.delete(name);
  if (activeTab === name) {
    const panel = document.querySelector(`.panel[data-panel="${name}"]`);
    panel.innerHTML = "";
    rendered.add(name);
    renderInto(name, panel);
  }
}

async function renderInto(name, panel) {
  panel.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const fn = views.get(name);
    panel.innerHTML = "";
    await fn(panel);
  } catch (e) {
    if (e.status === 401) {
      const { logout } = await import("./auth.js");
      logout();
      return;
    }
    const msg = e.status === 429
      ? `Rate limited. Try again in ${e.retryAfter ?? "a few"} seconds.`
      : `Couldn't load: ${e.message}`;
    panel.innerHTML = `<p class="error">${msg}</p>`;
    rendered.delete(name);
  }
}

export function mountRouter(initialTab = "overview") {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
  activateTab(initialTab);
}
```

- [ ] **Step 2: Commit (no behavior change yet)**

```bash
git add spotify-profile-demo/src/router.js
git commit -m "Add tab router with lazy first-render and per-tab error handling"
```

---

## Task 7: Build the Overview view

**Files:**
- Create: `spotify-profile-demo/src/views/overview.js`

- [ ] **Step 1: Create `src/views/overview.js`**

```js
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

  const headerUser = document.getElementById("header-user");
  if (headerUser) headerUser.textContent = profile.display_name ?? profile.id;

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
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/views/overview.js
git commit -m "Add Overview view: profile, now-playing, quick stats"
```

---

## Task 8: Build the Top Artists view

**Files:**
- Create: `spotify-profile-demo/src/views/topArtists.js`

- [ ] **Step 1: Create `src/views/topArtists.js`**

```js
import { getTopArtists } from "../api.js";

const TIME_RANGES = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

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

  const grid = document.createElement("div");
  grid.className = "card-grid";
  container.appendChild(grid);

  await populate(grid, "medium_term");

  controls.querySelector(".time-range").addEventListener("change", async (e) => {
    grid.innerHTML = '<p class="loading">Loading…</p>';
    try {
      await populate(grid, e.target.value);
    } catch (err) {
      grid.innerHTML = `<p class="error">Couldn't load: ${err.message}</p>`;
    }
  });
}

async function populate(grid, timeRange) {
  const data = await getTopArtists(timeRange, 50);
  grid.innerHTML = "";
  for (const artist of data.items) {
    const card = document.createElement("a");
    card.className = "card artist-card";
    card.href = artist.external_urls.spotify;
    card.target = "_blank";
    card.rel = "noopener";
    const img = artist.images?.[0]?.url
      ? `<img src="${artist.images[0].url}" alt="">`
      : `<div class="img-placeholder"></div>`;
    const genres = (artist.genres ?? []).slice(0, 3).join(", ");
    card.innerHTML = `
      ${img}
      <div class="card-body">
        <strong>${artist.name}</strong>
        <small>${genres}</small>
        <div class="bar"><div class="bar-fill" style="width:${artist.popularity}%"></div></div>
      </div>
    `;
    grid.appendChild(card);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/views/topArtists.js
git commit -m "Add Top Artists view with time-range selector and popularity bars"
```

---

## Task 9: Build the Top Tracks view

**Files:**
- Create: `spotify-profile-demo/src/views/topTracks.js`

- [ ] **Step 1: Create `src/views/topTracks.js`**

```js
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
    const art = t.album.images?.[2]?.url ?? t.album.images?.[0]?.url;
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
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/views/topTracks.js
git commit -m "Add Top Tracks view with 30s preview playback"
```

---

## Task 10: Build the Recently Played view

**Files:**
- Create: `spotify-profile-demo/src/views/recentlyPlayed.js`

- [ ] **Step 1: Create `src/views/recentlyPlayed.js`**

```js
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
    const art = t.album.images?.[2]?.url ?? t.album.images?.[0]?.url;
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
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/views/recentlyPlayed.js
git commit -m "Add Recently Played view with relative timestamps"
```

---

## Task 11: Build the Genres & Library view

**Files:**
- Create: `spotify-profile-demo/src/views/genres.js`

- [ ] **Step 1: Create `src/views/genres.js`**

```js
import { getTopArtists, getMyPlaylists, getFollowedArtists } from "../api.js";
import { aggregateGenres } from "../util/genres.js";

export async function render(container) {
  const [artists, playlists, following] = await Promise.all([
    getTopArtists("medium_term", 50),
    getMyPlaylists(50),
    getFollowedArtists(50),
  ]);

  const genres = aggregateGenres(artists.items);
  const max = genres[0]?.count ?? 1;

  const intro = document.createElement("p");
  intro.className = "muted";
  intro.textContent = "Genres derived from your top 50 artists in the last 6 months.";
  container.appendChild(intro);

  const counts = document.createElement("div");
  counts.className = "stats-row";
  counts.innerHTML = `
    <div class="stat"><span class="stat-num">${playlists.items?.length ?? 0}</span><span class="stat-label">playlists</span></div>
    <div class="stat"><span class="stat-num">${following.artists?.items?.length ?? 0}</span><span class="stat-label">followed artists</span></div>
    <div class="stat"><span class="stat-num">${genres.length}</span><span class="stat-label">distinct genres</span></div>
  `;
  container.appendChild(counts);

  const top = genres.slice(0, 15);
  const list = document.createElement("ul");
  list.className = "genre-list";
  for (const { genre, count } of top) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="genre-name">${genre}</span>
      <div class="bar"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      <span class="genre-count">${count}</span>
    `;
    list.appendChild(li);
  }
  container.appendChild(list);
}
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/views/genres.js
git commit -m "Add Genres & Library view with derived genre breakdown"
```

---

## Task 12: Wire up `script.js` to mount router

**Files:**
- Modify: `spotify-profile-demo/src/script.js`

- [ ] **Step 1: Replace contents of `script.js`**

```js
import { redirectToSpotifyAuth, exchangeCodeForToken, getAccessToken, logout } from "./auth.js";
import { clearApiCache } from "./api.js";
import { registerView, mountRouter } from "./router.js";
import { render as renderOverview } from "./views/overview.js";
import { render as renderTopArtists } from "./views/topArtists.js";
import { render as renderTopTracks } from "./views/topTracks.js";
import { render as renderRecentlyPlayed } from "./views/recentlyPlayed.js";
import { render as renderGenres } from "./views/genres.js";

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    document.getElementById("status").textContent = `Auth error: ${error}`;
    return false;
  }

  if (code) {
    try {
      await exchangeCodeForToken(code);
      window.history.replaceState({}, "", "/");
      return true;
    } catch (e) {
      document.getElementById("status").textContent = `Token exchange failed: ${e.message}`;
      return false;
    }
  }
  return false;
}

function showLoggedIn() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("app-header").style.display = "flex";
  document.getElementById("tab-nav").style.display = "flex";
  document.getElementById("panels").style.display = "block";

  registerView("overview", renderOverview);
  registerView("topArtists", renderTopArtists);
  registerView("topTracks", renderTopTracks);
  registerView("recentlyPlayed", renderRecentlyPlayed);
  registerView("genres", renderGenres);

  mountRouter("overview");
}

function showLoggedOut() {
  document.getElementById("login-section").style.display = "block";
  document.getElementById("app-header").style.display = "none";
  document.getElementById("tab-nav").style.display = "none";
  document.getElementById("panels").style.display = "none";
}

async function init() {
  if (window.location.pathname === "/callback") {
    const ok = await handleCallback();
    if (!ok) {
      showLoggedOut();
      return;
    }
  }

  const token = await getAccessToken();
  if (token) {
    showLoggedIn();
  } else {
    showLoggedOut();
  }

  document.getElementById("login-btn").addEventListener("click", redirectToSpotifyAuth);
  document.getElementById("logout-btn").addEventListener("click", () => {
    clearApiCache();
    logout();
  });
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/src/script.js
git commit -m "Mount tab router after auth, clear API cache on logout"
```

---

## Task 13: Add styles

**Files:**
- Modify: `spotify-profile-demo/style.css`

- [ ] **Step 1: Replace `style.css` contents**

```css
:root {
  --bg: #121212;
  --bg-elev: #1c1c1c;
  --bg-hover: #242424;
  --fg: #ffffff;
  --fg-muted: #b3b3b3;
  --accent: #1db954;
  --border: #2a2a2a;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

#app { max-width: 1100px; margin: 0 auto; padding: 24px; }

#app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
#app-header h1 { margin: 0; flex: 1; font-size: 22px; }
#header-user { color: var(--fg-muted); }

#login-section { padding: 60px 0; text-align: center; }
button {
  background: var(--accent);
  color: #000;
  border: 0;
  padding: 10px 20px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
}
button:hover { filter: brightness(1.1); }
#logout-btn { background: transparent; color: var(--fg-muted); border: 1px solid var(--border); }

#tab-nav {
  display: flex;
  gap: 4px;
  margin: 16px 0;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  background: transparent;
  color: var(--fg-muted);
  padding: 12px 16px;
  border-radius: 0;
  font-weight: 500;
}
.tab-btn.active { color: var(--fg); border-bottom: 2px solid var(--accent); }

.panel { padding: 16px 0; }
.loading, .error, .empty, .muted { color: var(--fg-muted); }
.error { color: #ff6b6b; }

.profile-card { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
.profile-card .avatar { width: 80px; height: 80px; border-radius: 50%; }
.profile-card a { color: var(--accent); }

.now-playing {
  background: var(--bg-elev);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.np-label { color: var(--accent); font-size: 12px; display: block; margin-bottom: 4px; }

.stats-row { display: flex; gap: 16px; flex-wrap: wrap; }
.stat {
  background: var(--bg-elev);
  padding: 16px 20px;
  border-radius: 8px;
  flex: 1;
  min-width: 140px;
}
.stat-num { display: block; font-size: 28px; font-weight: 700; }
.stat-label { color: var(--fg-muted); font-size: 13px; }

.controls { margin: 16px 0; }
.controls select {
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 6px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.card {
  background: var(--bg-elev);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: background 0.15s;
}
.card:hover { background: var(--bg-hover); }
.card img, .img-placeholder { width: 100%; aspect-ratio: 1; object-fit: cover; background: #333; display: block; }
.card-body { padding: 12px; }
.card-body strong { display: block; margin-bottom: 4px; }
.card-body small { color: var(--fg-muted); display: block; margin-bottom: 8px; min-height: 1em; }

.bar { height: 4px; background: #333; border-radius: 2px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); }

.track-list { list-style: none; padding: 0; margin: 0; counter-reset: row; }
.track-row {
  display: grid;
  grid-template-columns: 40px 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
}
.track-row:hover { background: var(--bg-hover); }
.track-row img, .img-placeholder.small { width: 40px; height: 40px; aspect-ratio: 1; }
.track-meta strong { display: block; }
.track-meta small { color: var(--fg-muted); }
.track-duration { color: var(--fg-muted); font-size: 13px; }
.preview-btn { background: transparent; color: var(--accent); padding: 4px 8px; }
.preview-empty { width: 32px; }

.genre-list { list-style: none; padding: 0; }
.genre-list li {
  display: grid;
  grid-template-columns: 160px 1fr 40px;
  gap: 12px;
  align-items: center;
  padding: 6px 0;
}
.genre-name { color: var(--fg); }
.genre-count { color: var(--fg-muted); text-align: right; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Commit**

```bash
git add spotify-profile-demo/style.css
git commit -m "Add dark dashboard styling: tabs, cards, lists, bars"
```

---

## Task 14: End-to-end manual verification

- [ ] **Step 1: Run dev server and test the golden path**

From `spotify-profile-demo/`: `npm run dev`. Open `http://127.0.0.1:5173`.

If already logged in from a previous task, click Log out → Log in again so the new scopes take effect.

- [ ] **Step 2: Verify each tab**

For each tab, confirm:

- **Overview**: profile card with avatar, optional now-playing strip, three stat cards (top artists / playlists / followed artists). Numbers are non-zero for an active account.
- **Top Artists**: grid of cards with artist image, name, genres, popularity bar. Switch dropdown to "Last 4 weeks" → grid replaces with the new range. Click a card → opens artist's Spotify page in new tab.
- **Top Tracks**: list with album art, title, artist, duration, ▶︎ button on tracks that have a preview. Click ▶︎ on one, then ▶︎ on another → first stops, second starts.
- **Recently Played**: list of up to 50 entries with relative timestamps ("3 hrs ago", "2 days ago").
- **Genres & Library**: intro line, three stat cards, top-15 horizontal genre bars sized relative to the most-frequent genre.

- [ ] **Step 3: Verify caching**

Open DevTools → Network → filter to XHR. Click Top Artists (network requests fire). Click Overview, then Top Artists again → no new request for `/me/top/artists?time_range=medium_term`. Switching the dropdown DOES fire a new request.

- [ ] **Step 4: Verify per-tab error isolation**

In DevTools → Network, enable "Offline". On the Top Artists tab, change the time-range dropdown to a value you haven't selected yet → that panel shows an inline "Couldn't load" error (the new range bypasses the cache and triggers a fresh fetch). Re-enable network. Other tabs are unaffected.

- [ ] **Step 5: Verify logout → re-login**

Click Log out. Verify nav and panels are hidden, login button shown. Click Log in again. After redirect, Overview re-loads.

- [ ] **Step 6: Final commit if any tweaks**

If any issues required edits, commit them with descriptive messages. If verification was clean, no commit needed for this task.

---

## Done

When all tasks above are checked off, the dashboard is functional. The original "Playlist Creator" feature implied by the project name is intentionally left for a future plan.
