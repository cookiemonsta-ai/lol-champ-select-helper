import fs from "fs";

const url = "https://lolalytics.com/lol/missfortune/build/?tier=all";

const res = await fetch(url, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    accept: "text/html,*/*",
  },
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);

const html = await res.text();
fs.writeFileSync("build_page.html", html, "utf8");
console.log("Wrote build_page.html", html.length);
