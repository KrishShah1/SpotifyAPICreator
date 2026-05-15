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
    const err = new Error(`API error: ${response.status}`);
    err.status = response.status;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) err.retryAfter = Number(retryAfter);
    throw err;
  }

  return response.json();
}

export async function getCurrentUser() {
  return fetchWithAuth("/me");
}
