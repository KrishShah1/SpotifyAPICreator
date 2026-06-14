const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;
const HISTORY_KEY = "spotify_history";

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["GET", key]]),
  });
  const [{ result }] = await r.json();
  return result ? JSON.parse(result) : [];
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]]),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: "Redis not configured" });
  }

  try {
    if (req.method === "GET") {
      const history = await redisGet(HISTORY_KEY);
      return res.json({ history, count: history.length });
    }

    if (req.method === "POST") {
      const { entries } = req.body;
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: "entries must be an array" });
      }

      const existing = await redisGet(HISTORY_KEY);
      const seen = new Set(existing.map((e) => `${e.played_at}|${e.track_id}`));
      const newEntries = entries.filter((e) => !seen.has(`${e.played_at}|${e.track_id}`));

      if (newEntries.length === 0) {
        return res.json({ count: existing.length, added: 0 });
      }

      const merged = [...existing, ...newEntries]
        .sort((a, b) => a.played_at.localeCompare(b.played_at));

      await redisSet(HISTORY_KEY, merged);
      return res.json({ count: merged.length, added: newEntries.length });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
