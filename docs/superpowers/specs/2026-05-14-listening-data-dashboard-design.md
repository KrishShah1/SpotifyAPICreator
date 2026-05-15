# Listening Data Dashboard — Design

**Date:** 2026-05-14
**Project:** SpotifyAPICreator (`spotify-profile-demo/`)
**Status:** Approved by user, pending spec review

## Goal

Extend the existing Spotify-authenticated web app so the user can see a multi-faceted view of their current listening: top artists, top tracks, recently played, and a genre / library breakdown. Output is consumed in the browser.

## Scope

In-scope:

- New tabs in the existing Vite/JS app for Overview, Top Artists, Top Tracks, Recently Played, Genres & Library.
- New Spotify Web API calls under existing PKCE auth.
- Time-range selector (4 weeks / 6 months / all time) for Top Artists and Top Tracks.
- Client-side genre aggregation derived from top artists.
- Inline per-tab error handling.

Out of scope:

- Persisted history beyond what Spotify returns (no backend / DB).
- Audio-features deep dives (tempo, energy, valence) — can be a follow-up.
- Currently-playing live polling (we'll show it on Overview if present at load, no websocket).
- Mobile-specific layouts beyond standard responsive cards.
- Playlist creation features (the original project goal — separate feature).

## Architecture

Single-page Vite app, vanilla JS. No framework added.

### File layout

```
spotify-profile-demo/
├── index.html           # add tab nav + 5 panels
├── style.css            # extend with grid/card/tab styles
└── src/
    ├── auth.js          # unchanged except SCOPES constant
    ├── api.js           # extend with new endpoint functions
    ├── router.js        # NEW — tab switcher
    ├── script.js        # mount router after auth
    └── views/           # NEW
        ├── overview.js
        ├── topArtists.js
        ├── topTracks.js
        ├── recentlyPlayed.js
        └── genres.js
```

### Module contracts

**`api.js`** — one function per endpoint, all using the existing `fetchWithAuth` helper. The helper currently throws a generic `Error("API error: <status>")`; we'll enrich it to attach `status` and `retryAfter` (parsed from the `Retry-After` header on 429s) to the thrown error so views can render meaningful messages.

- `getCurrentUser()` (existing)
- `getTopArtists(timeRange, limit = 50)` → `GET /me/top/artists?time_range=<short|medium|long>_term&limit=<n>`
- `getTopTracks(timeRange, limit = 50)` → `GET /me/top/tracks?...`
- `getRecentlyPlayed(limit = 50)` → `GET /me/player/recently-played?limit=<n>`
- `getCurrentlyPlaying()` → `GET /me/player/currently-playing` (returns `null` on 204)
- `getMyPlaylists(limit = 50)` → `GET /me/playlists?limit=<n>`
- `getFollowedArtists(limit = 50)` → `GET /me/following?type=artist&limit=<n>`

**`views/<name>.js`** — each exports:

```js
export async function render(container) { /* fetch + populate container */ }
```

Each view owns its own DOM construction and any in-tab controls (e.g., time-range dropdown). No view imports another view.

**`router.js`** — exports `mountRouter(rootElement)`. Wires nav buttons to tab switching, calls each view's `render()` lazily on first activation, caches the rendered DOM so subsequent clicks are instant. Genre dropdown changes trigger a re-render of just that view (clearing its cache entry first).

### Data flow

```
tab click
   └─> router.activate(tabName)
         ├─> if rendered: show panel
         └─> if not: view.render(panel) → api.getX() → DOM update → mark rendered
```

A small shared cache lives in `api.js` (a plain `Map<cacheKey, Promise>`) for the calls that more than one view needs — specifically `getTopArtists("medium_term", 50)`, which both Top Artists and Genres consume. Each `api.getX()` checks the cache before fetching. Time-range changes invalidate by computing a new cache key.

Time-range change inside Top Artists / Top Tracks:

```
dropdown change → view re-fetches with new range → replaces cards in panel
```

### Auth changes

`auth.js` `SCOPES` constant gains two scopes:

```js
const SCOPES = "user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read user-read-recently-played";
```

Existing tokens won't have these scopes, so on first load post-deploy, the user re-clicks "Log in with Spotify" to re-authorize. No code change needed beyond the constant — the PKCE flow already handles re-auth.

## Tab specifications

### Overview
- Profile card (existing display: avatar, name, email, user ID, Spotify link).
- Currently-playing strip if `getCurrentlyPlaying()` returns a track; hidden otherwise.
- "Quick stats" row: count of distinct top-50 artists (medium_term), count of playlists, count of followed artists. These three calls fire in parallel via `Promise.all`.

### Top Artists
- Time-range `<select>`: `short_term` (Last 4 weeks), `medium_term` (Last 6 months, default), `long_term` (All time).
- Grid of up to 50 artist cards: image, name, genres (first 3), popularity rendered as a horizontal bar (0–100).
- Click an artist card → opens their Spotify URL in a new tab.

### Top Tracks
- Same time-range selector as Top Artists.
- List of up to 50 tracks: album art (small), title, artist names (joined), duration. If `preview_url` exists, a tiny ▶︎ button plays the 30-second clip via an `<audio>` element (only one plays at a time — clicking another stops the current).

### Recently Played
- Up to 50 entries from `getRecentlyPlayed`. Each row: album art, title, artist, "played X minutes/hours/days ago" computed from `played_at`.
- No time-range selector (Spotify only returns the last 50, period).

### Genres & Library
- **Genres**: aggregate counts from `getTopArtists("medium_term", 50)`. Each artist contributes its `genres` array; sum frequencies; render top 15 as horizontal bars normalized to the max count.
- **Library counts**: # playlists (from `getMyPlaylists`), # followed artists (from `getFollowedArtists`), # genres represented.
- A note clarifies "genres are derived from your top 50 artists in the last 6 months."

## Error handling

- `fetchWithAuth` already throws on non-2xx. Each view wraps its `render()` body in `try/catch`; on failure, the panel shows an inline message: "Couldn't load <data type>: <error>". Other tabs remain functional.
- 401 specifically: clear tokens via `auth.logout()` semantics (without redirect), show login section. This applies whether triggered from any tab.
- 429 (rate limit): surface the `Retry-After` value in the inline error so the user knows to wait.
- Currently-playing 204 (nothing playing) is not an error — it returns `null` and the strip is hidden.

## Styling

Extend `style.css` only. Add:
- Tab nav bar (horizontal buttons, active state).
- Panel container (one visible at a time).
- Card grid (CSS grid, `repeat(auto-fill, minmax(180px, 1fr))`).
- Track list rows (flex, hover highlight).
- Bar component (genres + popularity) — a `<div>` with width % and a background color.

Color palette: dark background (#121212), accent green (#1DB954), text white. Roughly Spotify-flavored without ripping anything off.

## Testing

Manual verification (no test framework currently in repo, not adding one for this scope):

- Auth flow still works end-to-end (re-auth prompts new scopes).
- Each tab loads on first click; second click is instant (cache hit).
- Time-range change on Top Artists / Top Tracks updates the grid.
- Disconnect network mid-flight on a tab → inline error shows in that tab only.
- Manually expire/clear token → next API call triggers re-login.
- Account with 0 recent plays / 0 playlists → empty-state messaging instead of broken list.

## Open questions

None as of design approval. Time-range default of 6 months is a judgment call but matches Spotify Wrapped-style framing; user can switch.

## Future extensions (not in scope)

- Audio-features overlay on Top Tracks (energy/valence/tempo histograms).
- Live currently-playing with polling.
- Compare-time-ranges view (your top 10 now vs. a year ago).
- Export snapshot to JSON file.
- Wire up to the original "Playlist Creator" goal (use top-tracks as seeds).
