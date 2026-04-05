import fs from "fs";
import path from "path";

const ROLES = new Set(["top", "jng", "mid", "bot", "sup"]);
const SIDES = new Set(["ALLY", "ENEMY"]);

function norm(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, "");
}

function makeKey(side, myChamp, otherChamp) {
  const prefix = side === "ALLY" ? "s:" : "c:";
  return `${prefix}${norm(myChamp)}|${norm(otherChamp)}`;
}

function parseCsvLine(line) {
  // simple CSV: ei tuettu lainauksia. Toimii hyvin jos champ-nimissä ei ole pilkkuja.
  return line.split(",").map((x) => x.trim());
}

const projectRoot = process.cwd();
const inPath = path.join(projectRoot, "data_raw", "deltas.csv");
const outPath = path.join(projectRoot, "src", "data", "deltas.json");

const text = fs.readFileSync(inPath, "utf8");
const lines = text
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

if (lines.length < 2) {
  console.error("CSV missing data rows.");
  process.exit(1);
}

const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
const idx = {
  myRole: header.indexOf("myrole"),
  otherRole: header.indexOf("otherrole"),
  side: header.indexOf("side"),
  myChamp: header.indexOf("mychamp"),
  otherChamp: header.indexOf("otherchamp"),
  value: header.indexOf("value"),
};

for (const [k, v] of Object.entries(idx)) {
  if (v === -1) {
    console.error(`Missing column in header: ${k}`);
    process.exit(1);
  }
}

const out = {}; // { myRole: { ALLY: { otherRole: { key: value }}}}

let ok = 0;
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < header.length) {
    skipped++;
    continue;
  }

  const myRole = cols[idx.myRole];
  const otherRole = cols[idx.otherRole];
  const side = cols[idx.side];
  const myChamp = cols[idx.myChamp];
  const otherChamp = cols[idx.otherChamp];
  const valueStr = cols[idx.value];

  if (!ROLES.has(myRole)) {
    console.warn(`Skip row ${i + 1}: invalid myRole "${myRole}"`);
    skipped++;
    continue;
  }
  if (!ROLES.has(otherRole)) {
    console.warn(`Skip row ${i + 1}: invalid otherRole "${otherRole}"`);
    skipped++;
    continue;
  }
  if (!SIDES.has(side)) {
    console.warn(`Skip row ${i + 1}: invalid side "${side}"`);
    skipped++;
    continue;
  }

  const value = Number(valueStr);
  if (!Number.isFinite(value)) {
    console.warn(`Skip row ${i + 1}: invalid value "${valueStr}"`);
    skipped++;
    continue;
  }

  const k = makeKey(side, myChamp, otherChamp);

  out[myRole] ??= {};
  out[myRole][side] ??= {};
  out[myRole][side][otherRole] ??= {};
  out[myRole][side][otherRole][k] = value;

  ok++;
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${outPath}`);
console.log(`Rows ok: ${ok}, skipped: ${skipped}`);
