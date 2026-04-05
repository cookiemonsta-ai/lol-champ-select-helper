import fs from "fs";

const html = fs.readFileSync("build_page.html", "utf8");

// 1) <script type="application/json">...</script>
const scriptJson = [];
const re1 = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
let m1;
while ((m1 = re1.exec(html))) {
  const text = m1[1].trim();
  if (text.length > 200) scriptJson.push(text);
}

// 2) window.__SOMETHING__ = {...};
const assigns = [];
const re2 = /window\.(__\w+__?)\s*=\s*({[\s\S]*?});/g;
let m2;
while ((m2 = re2.exec(html))) {
  const name = m2[1];
  const text = m2[2];
  if (text.length > 200) assigns.push({ name, text });
}

fs.mkdirSync("embedded", { recursive: true });

let idx = 0;
for (const t of scriptJson) {
  try {
    const j = JSON.parse(t);
    fs.writeFileSync(
      `embedded/scriptjson_${idx}.json`,
      JSON.stringify(j, null, 2),
      "utf8",
    );
    console.log("wrote", `embedded/scriptjson_${idx}.json`);
    idx++;
  } catch {
    // not valid json
  }
}

for (const a of assigns) {
  try {
    const j = JSON.parse(a.text);
    fs.writeFileSync(
      `embedded/${a.name}.json`,
      JSON.stringify(j, null, 2),
      "utf8",
    );
    console.log("wrote", `embedded/${a.name}.json`);
  } catch {
    // not valid json
  }
}

console.log("done");
