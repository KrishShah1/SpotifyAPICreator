import { redirectToSpotifyAuth, exchangeCodeForToken, getAccessToken, logout } from "./auth.js";
import { clearApiCache } from "./api.js";
import { registerView, mountRouter } from "./router.js";
import { render as renderOverview } from "./views/overview.js";
import { render as renderTopArtists } from "./views/topArtists.js";
import { render as renderTopTracks } from "./views/topTracks.js";
import { render as renderRecentlyPlayed } from "./views/recentlyPlayed.js";
import { render as renderGenres } from "./views/genres.js";
import { render as renderDiagnostics } from "./views/diagnostics.js";
import { render as renderNowPlaying, teardown as teardownNowPlaying } from "./views/nowPlaying.js";
import { render as renderHeatmap } from "./views/heatmap.js";
import { render as renderTimeOfDay } from "./views/timeOfDay.js";
import { render as renderStreaks } from "./views/streaks.js";
import { render as renderMostPlayed } from "./views/mostPlayed.js";
import { render as renderTimeTravel } from "./views/timeTravel.js";
import { render as renderMightLike } from "./views/mightLike.js";
import { render as renderReleaseRadar } from "./views/releaseRadar.js";
import { render as renderDiscography } from "./views/discography.js";
import { render as renderLikedSongs } from "./views/likedSongs.js";
import { render as renderPlaylistGenerator } from "./views/playlistGenerator.js";
import { render as renderTimeCapsule } from "./views/timeCapsule.js";
import { render as renderPlaylistDiff } from "./views/playlistDiff.js";

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
  document.getElementById("app-shell").style.display = "block";

  registerView("overview", renderOverview);
  registerView("topArtists", renderTopArtists);
  registerView("topTracks", renderTopTracks);
  registerView("recentlyPlayed", renderRecentlyPlayed);
  registerView("genres", renderGenres);
  registerView("nowPlaying", renderNowPlaying);
  registerView("heatmap", renderHeatmap);
  registerView("timeOfDay", renderTimeOfDay);
  registerView("streaks", renderStreaks);
  registerView("mostPlayed", renderMostPlayed);
  registerView("timeTravel", renderTimeTravel);
  registerView("mightLike", renderMightLike);
  registerView("releaseRadar", renderReleaseRadar);
  registerView("discography", renderDiscography);
  registerView("likedSongs", renderLikedSongs);
  registerView("playlistGenerator", renderPlaylistGenerator);
  registerView("timeCapsule", renderTimeCapsule);
  registerView("playlistDiff", renderPlaylistDiff);
  registerView("diagnostics", renderDiagnostics);

  mountRouter("overview");
}

function showLoggedOut() {
  document.getElementById("login-section").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
}

window.addEventListener("beforeunload", () => {
  teardownNowPlaying();
});

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
