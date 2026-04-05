import fs from "fs";

const MAIN_CHAMP = "Miss Fortune";
const MY_ROLE = "bot"; // sun oma rooli MF:llä
const SIDE = "ALLY";

const ROLE_MAP = {
  top: "top",
  jungle: "jng",
  middle: "mid",
  support: "sup",
};

const raw = JSON.parse(fs.readFileSync("team.json", "utf8"));
const header = raw.team_h; // ["id","wr","d1","d2","pr","n"]

const idxId = header.indexOf("id");
const idxD2 = header.indexOf("d2");
if (idxId === -1 || idxD2 === -1) {
  throw new Error(`Bad header: ${JSON.stringify(header)}`);
}

// id -> champ name
const champFull = JSON.parse(fs.readFileSync("championFull.json", "utf8"));
const idToName = new Map();
for (const champ of Object.values(champFull.data)) {
  idToName.set(Number(champ.key), champ.name);
}

const seen = new Set(); // dedupe key
const rows = [];

for (const [roleKey, arr] of Object.entries(raw.team)) {
  const otherRole = ROLE_MAP[roleKey];
  if (!otherRole) continue;
  if (!Array.isArray(arr)) continue;

  for (const row of arr) {
    const champId = row[idxId];
    const d2 = row[idxD2];
    if (typeof champId !== "number" || typeof d2 !== "number") continue;

    const otherChamp = idToName.get(champId) ?? `ID_${champId}`;
    const key = `${MY_ROLE}|${otherRole}|${SIDE}|${MAIN_CHAMP}|${otherChamp}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push(
      `${MY_ROLE},${otherRole},${SIDE},${MAIN_CHAMP},${otherChamp},${d2}`,
    );
  }
}

fs.writeFileSync("deltas_from_team.csv", rows.join("\n") + "\n", "utf8");
console.log(`Wrote ${rows.length} rows -> deltas_from_team.csv`);
