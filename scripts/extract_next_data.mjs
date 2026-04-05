import fs from "fs";

const html = fs.readFileSync("build_page.html", "utf8");

// Next.js: <script id="__NEXT_DATA__" type="application/json"> ... </script>
const m = html.match(
  /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
);

if (!m) {
  throw new Error("Could not find __NEXT_DATA__ script in build_page.html");
}

const jsonText = m[1];
const data = JSON.parse(jsonText);

fs.writeFileSync("next_data.json", JSON.stringify(data, null, 2), "utf8");
console.log("Wrote next_data.json");
console.log("Top keys:", Object.keys(data));
