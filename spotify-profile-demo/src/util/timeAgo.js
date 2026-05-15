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
