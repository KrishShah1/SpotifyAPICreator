import { getAccessToken } from "./auth.js";

const API_BASE = "https://api.spotify.com/v1";

async function fetchWithAuth(endpoint) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const err = new Error(`API error ${response.status} on ${endpoint}`);
    err.status = response.status;
    err.endpoint = endpoint;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) err.retryAfter = Number(retryAfter);
    throw err;
  }

  return response.json();
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
