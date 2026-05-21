import { getAccessToken } from "./auth.js";

const API_BASE = "https://api.spotify.com/v1";

async function fetchWithAuth(endpoint, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const init = {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${token}` },
  };
  if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, init);

  if (response.status === 204) return null;

  if (!response.ok) {
    const err = new Error(`API error ${response.status} on ${endpoint}`);
    err.status = response.status;
    err.endpoint = endpoint;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) err.retryAfter = Number(retryAfter);
    throw err;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function getCurrentUser() {
  return fetchWithAuth("/me");
}

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

export function getMyTracks(limit = 50, offset = 0) {
  return fetchWithAuth(`/me/tracks?limit=${limit}&offset=${offset}`);
}

export function getArtistTopTracks(artistId, market = "US") {
  return cached(`artistTopTracks:${artistId}:${market}`, () =>
    fetchWithAuth(`/artists/${artistId}/top-tracks?market=${market}`)
  );
}

export function getArtistAlbums(artistId, limit = 50, offset = 0, includeGroups = "album,single") {
  return cached(`artistAlbums:${artistId}:${limit}:${offset}:${includeGroups}`, () =>
    fetchWithAuth(
      `/artists/${artistId}/albums?include_groups=${includeGroups}&limit=${limit}&offset=${offset}`
    )
  );
}

export function getAlbumTracks(albumId, limit = 50) {
  return cached(`albumTracks:${albumId}:${limit}`, () =>
    fetchWithAuth(`/albums/${albumId}/tracks?limit=${limit}`)
  );
}

export function getPlaylistTracks(playlistId, limit = 100, offset = 0) {
  return fetchWithAuth(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`);
}

export async function getAllPlaylistTracks(playlistId) {
  const all = [];
  let offset = 0;
  while (true) {
    const page = await getPlaylistTracks(playlistId, 100, offset);
    all.push(...page.items);
    if (!page.next) break;
    offset += page.items.length;
    if (page.items.length === 0) break;
  }
  return all;
}

export async function createPlaylist(userId, name, description = "", isPublic = false) {
  return fetchWithAuth(`/users/${userId}/playlists`, {
    method: "POST",
    body: { name, description, public: isPublic },
  });
}

export async function addTracksToPlaylist(playlistId, uris) {
  const chunks = [];
  for (let i = 0; i < uris.length; i += 100) chunks.push(uris.slice(i, i + 100));
  for (const chunk of chunks) {
    await fetchWithAuth(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: { uris: chunk },
    });
  }
}

export async function saveTracks(ids) {
  return fetchWithAuth(`/me/tracks?ids=${ids.join(",")}`, { method: "PUT" });
}

export async function checkSavedTracks(ids) {
  return fetchWithAuth(`/me/tracks/contains?ids=${ids.join(",")}`);
}
