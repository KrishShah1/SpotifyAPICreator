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
