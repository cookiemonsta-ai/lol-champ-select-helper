import fs from "fs";

const SRC = "deltas_from_lolalytics.csv";
const DEST = "data_raw/deltas.csv";
const HEADER = "myRole,otherRole,side,myChamp,otherChamp,value";
const ROLES = new Set(["top", "jng", "mid", "bot", "sup"]);
const SIDES = new Set(["ALLY", "ENEMY"]);

function makeKey(row) {
  return [
    row.myRole,
    row.otherRole,
    row.side,
    row.myChamp.toLowerCase(),
    row.otherChamp.toLowerCase(),
  ].join("|");
}

function rowToLine(row) {
  return [
    row.myRole,
    row.otherRole,
    row.side,
    row.myChamp,
    row.otherChamp,
    row.value,
  ].join(",");
}

function parseLine(line) {
  const cols = line.split(",").map((x) => x.trim());
  if (cols.length !== 6) return null;

  const [myRole, otherRole, side, myChamp, otherChamp, valueStr] = cols;
  if (!ROLES.has(myRole) || !ROLES.has(otherRole) || !SIDES.has(side)) {
    return null;
  }

  const value = Number(valueStr);
  if (!Number.isFinite(value)) return null;

  return {
    myRole,
    otherRole,
    side,
    myChamp,
    otherChamp,
    value: String(value),
  };
}

function recoverRowsFromBrokenLine(line) {
  // Recover concatenated rows like "...1.21top,jng,ALLY,..."
  const out = [];
  const re =
    /(top|jng|mid|bot|sup),(top|jng|mid|bot|sup),(ALLY|ENEMY),([^,\r\n]+),([^,\r\n]+),(-?\d+(?:\.\d+)?)/g;

  for (const m of line.matchAll(re)) {
    out.push({
      myRole: m[1],
      otherRole: m[2],
      side: m[3],
      myChamp: m[4].trim(),
      otherChamp: m[5].trim(),
      value: String(Number(m[6])),
    });
  }
  return out;
}

function parseRows(text) {
  const rows = [];
  let recovered = 0;
  let skipped = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === HEADER || line.startsWith("myRole,")) continue;

    const parsed = parseLine(line);
    if (parsed) {
      rows.push(parsed);
      continue;
    }

    const recoveredRows = recoverRowsFromBrokenLine(line);
    if (recoveredRows.length > 0) {
      rows.push(...recoveredRows);
      recovered += recoveredRows.length;
      continue;
    }

    skipped++;
  }

  return { rows, recovered, skipped };
}

const srcText = fs.readFileSync(SRC, "utf8");
if (!srcText.trim()) throw new Error("Source CSV is empty");

const destText = fs.existsSync(DEST) ? fs.readFileSync(DEST, "utf8") : "";

const fromDest = parseRows(destText);
const fromSrc = parseRows(srcText);

const mergedByKey = new Map();
for (const row of fromDest.rows) mergedByKey.set(makeKey(row), row);
for (const row of fromSrc.rows) mergedByKey.set(makeKey(row), row);

const outLines = [HEADER, ...Array.from(mergedByKey.values()).map(rowToLine)];

fs.mkdirSync("data_raw", { recursive: true });
fs.writeFileSync(DEST, outLines.join("\n") + "\n", "utf8");

console.log(`Merged ${fromSrc.rows.length} rows from ${SRC} into ${DEST}`);
console.log(`Recovered rows: ${fromDest.recovered + fromSrc.recovered}`);
console.log(`Skipped malformed lines: ${fromDest.skipped + fromSrc.skipped}`);
console.log(`Total unique rows now: ${outLines.length - 1}`);
