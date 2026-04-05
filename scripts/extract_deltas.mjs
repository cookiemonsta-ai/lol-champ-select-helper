import fs from "fs";

const MAIN_CHAMP = "Miss Fortune";
const MY_ROLE = "bot";
const SIDE = "ALLY";

const ROLE_MAP = {
  top: "top",
  jungle: "jng",
  mid: "mid",
  bot: "bot",
  support: "sup",
};

const raw = JSON.parse(fs.readFileSync("mf.json", "utf8"));

// 1) lataa Riot id->name map
const champFull = JSON.parse(fs.readFileSync("championFull.json", "utf8"));
const idToName = new Map();
for (const champ of Object.values(champFull.data)) {
  idToName.set(Number(champ.key), champ.name);
}

// 2) etsi header (esim team_h tai joku *_h)
const headerKey =
  Object.keys(raw).find((k) => k === "team_h") ||
  Object.keys(raw).find((k) => k.toLowerCase().includes("team_h")) ||
  Object.keys(raw).find((k) => k.endsWith("_h"));

const header = headerKey ? raw[headerKey] : null;
if (!Array.isArray(header)) {
  throw new Error(`Header array not found. Keys: ${Object.keys(raw).join(", ")}`);
}

const idxId = header.indexOf("id");
const idxD2 = header.indexOf("d2");
if (idxId === -1 || idxD2 === -1) {
  throw new Error(`Header missing id/d2. header=${JSON.stringify(header)}`);
}

// 3) etsi team-data object (esim raw.team tai joku joka sisältää top/jungle/mid/bot/support)
const isTeamObj = (obj) =>
  obj &&
  typeof obj === "object" &&
  !Array.isArray(obj) &&
  ("top" in obj || "jungle" in obj || "mid" in obj || "bot" in obj || "support" in obj);

let team = raw.team;
if (!isTeamObj(team)) {
  const altKey = Object.keys(raw).find((k) => k.toLowerCase().includes("team") && isTeamObj(raw[k]));
  team = altKey ? raw[altKey] : null;
}
if (!isTeamObj(team)) {
  throw new Error(`Team object not found. Keys: ${Object.keys(raw).join(", ")}`);
}

const rows = [];

for (const [roleKey, arr] of Object.entries(team)) {
  const role = ROLE_MAP[roleKey];
  if (!role) continue;
  if (!Array.isArray(arr)) continue;

  for (const row of arr) {
    const champId = row[idxId];
    const d2 = row[idxD2];
    if (typeof champId !== "number" || typeof d2 !== "number") continue;

    const otherChamp = idToName.get(champId) ?? `ID_${champId}`;
    rows.push(`${MY_ROLE},${role},${SIDE},${MAIN_CHAMP},${otherChamp},${d2}`);
  }
}

fs.writeFileSync("deltas_from_lolalytics.csv", rows.join("\n"), "utf8");
console.log(`Header key: ${headerKey}`);
console.log(`Wrote ${rows.length} rows -> deltas_from_lolalytics.csv`);
