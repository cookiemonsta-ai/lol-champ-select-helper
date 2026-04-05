import fs from "fs";

const champFull = JSON.parse(fs.readFileSync("championFull.json", "utf8"));
const champs = Object.values(champFull.data)
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b));

const out = { champions: champs };

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync(
  "src/data/champions.json",
  JSON.stringify(out, null, 2),
  "utf8",
);

console.log(`Wrote ${champs.length} champions -> src/data/champions.json`);
