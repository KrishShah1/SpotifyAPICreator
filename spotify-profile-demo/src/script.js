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
