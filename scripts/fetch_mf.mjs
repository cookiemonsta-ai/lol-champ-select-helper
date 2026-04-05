import fs from "fs";

const url =
  "https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.2&c=missfortune&lane=bot&tier=all&queue=ranked&region=all";

const res = await fetch(url, {
  headers: {
    accept: "application/json",
    origin: "https://lolalytics.com",
    referer: "https://lolalytics.com/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  },
});

if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}

const json = await res.json();

fs.writeFileSync("mf.json", JSON.stringify(json, null, 2), "utf8");
console.log("mf.json written");
