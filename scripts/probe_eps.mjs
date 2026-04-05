const base =
  "https://a1.lolalytics.com/mega/?v=1&patch=16.2&c=missfortune&lane=all&tier=all&queue=ranked&region=all";

const eps = [
  "build-team",
  "build-vs",
  "build-vs-team",
  "build-counter",
  "build-counters",
  "build-matchup",
  "build-matchups",
  "build-enemy",
  "build-opponent",
  "counters",
  "vs",
  "matchups",
  "build",
];

for (const ep of eps) {
  const url = base.replace("mega/?v=1", `mega/?ep=${ep}&v=1`);

  const res = await fetch(url, {
    headers: {
      accept: "*/*",
      origin: "https://lolalytics.com",
      referer: "https://lolalytics.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    },
  });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  let keys = [];
  let hint = "";
  let parsed = null;

  try {
    parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      keys = Object.keys(parsed);
      const hit = keys.find((k) =>
        [
          "vs",
          "vs_h",
          "counters",
          "counter",
          "enemy",
          "matchup",
          "matchups",
          "team",
        ].some((x) => k.toLowerCase().includes(x)),
      );
      hint = hit ? `has ${hit}` : "";
    }
  } catch {
    // not JSON
  }

  const preview = text.slice(0, 120).replace(/\s+/g, " ");

  console.log(
    ep.padEnd(16),
    String(res.status).padEnd(4),
    (ct || "no-ct").slice(0, 35).padEnd(36),
    keys.length
      ? `keys: ${keys.slice(0, 8).join(", ")}`
      : `preview: ${preview}`,
    hint ? ` <-- ${hint}` : "",
  );
}
