import fs from "fs";

// ---------- config ----------
const MY_ROLE = "bot";
const MY_CHAMP_NAME = "Miss Fortune"; // vaihdetaan myöhemmin loopissa poolille
const SIDE = "ENEMY";

// role key normalisointi
const ROLE_MAP = new Map([
  ["top", "top"],
  ["jungle", "jng"],
  ["jng", "jng"],
  ["middle", "mid"],
  ["mid", "mid"],
  ["bottom", "bot"],
  ["bot", "bot"],
  ["support", "sup"],
  ["sup", "sup"],
]);

function normRole(k) {
  const s = String(k).toLowerCase();
  return ROLE_MAP.get(s) || s;
}

// champion id -> name (Data Dragon championFull.json)
function loadIdToName() {
  const raw = JSON.parse(fs.readFileSync("championFull.json", "utf8"));
  const m = new Map();
  for (const champ of Object.values(raw.data)) {
    // champ.key = numeric string id
    m.set(Number(champ.key), champ.name);
  }
  return m;
}

const idToName = loadIdToName();

// ---------- helper: find candidate JSON blobs inside HTML ----------
const html = fs.readFileSync("build_page.html", "utf8");

// Qwik SSR state is usually embedded in script tags; easiest robust trick:
// extract all "{...}"-looking chunks near keywords and attempt JSON.parse on them.
const KEYWORDS = [
  "counter",
  "counters",
  "matchup",
  "matchups",
  '"d2"',
  "delta2",
  "vs",
  "team_h",
];

function findNear(keyword) {
  const lower = html.toLowerCase();
  const idx = lower.indexOf(keyword);
  if (idx === -1) return [];

  // take a window around the hit to reduce noise
  const start = Math.max(0, idx - 200000);
  const end = Math.min(html.length, idx + 200000);
  const chunk = html.slice(start, end);

  // extract large-ish JSON-ish segments (very rough)
  const candidates = [];
  const re = /{[\s\S]{500,2000000}?}/g; // big objects only
  let m;
  while ((m = re.exec(chunk))) {
    candidates.push(m[0]);
    if (candidates.length >= 40) break; // avoid insane runtime
  }
  return candidates;
}

function tryParseCandidates(cands) {
  for (const s of cands) {
    try {
      const j = JSON.parse(s);
      return j;
    } catch {
      // ignore
    }
  }
  return null;
}

// ---------- helper: walk object and collect any tables that have "id" and "d2" headers ----------
function collectTables(root) {
  const tables = [];

  function walk(node, path = []) {
    if (!node) return;

    if (Array.isArray(node)) {
      // try table pattern: header array + role object nearby is unknown, so just recurse
      for (let i = 0; i < Math.min(node.length, 200); i++)
        walk(node[i], path.concat([`[${i}]`]));
      return;
    }

    if (typeof node === "object") {
      // table header pattern: something like { team_h: ["id","wr","d1","d2",...], team: {top:[[...]]...} }
      for (const [k, v] of Object.entries(node)) {
        // header key
        if (Array.isArray(v) && v.length >= 4) {
          const hasId = v.includes("id");
          const hasD2 = v.includes("d2");
          if (hasId && hasD2) {
            tables.push({
              headerKey: k,
              header: v,
              container: node,
              path: path.concat([k]).join("."),
            });
          }
        }
        walk(v, path.concat([k]));
      }
    }
  }

  walk(root);
  return tables;
}

// ---------- main: find a parseable JSON blob ----------
let parsed = null;

// try keyword windows until we can JSON.parse something
for (const kw of KEYWORDS) {
  const cands = findNear(kw);
  parsed = tryParseCandidates(cands);
  if (parsed) break;
}

if (!parsed) {
  throw new Error(
    "Could not JSON.parse any embedded object from build_page.html. (We may need a different extraction strategy.)",
  );
}

console.log(
  "Parsed one JSON blob. Top keys:",
  Object.keys(parsed).slice(0, 20),
);

// collect tables
const tables = collectTables(parsed);
console.log("Found tables with id+d2 headers:", tables.length);

if (tables.length === 0) {
  throw new Error("No id+d2 tables found in parsed blob.");
}

// pick the “best” table: one whose container also has an object with role keys and arrays
function scoreTable(t) {
  const obj = t.container;
  let score = 0;

  // if headerKey ends with _h it's common
  if (String(t.headerKey).endsWith("_h")) score += 2;

  // find sibling keys that look like role containers
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object" && v && !Array.isArray(v)) {
      const keys = Object.keys(v).map((x) => x.toLowerCase());
      if (
        keys.some((x) =>
          [
            "top",
            "jungle",
            "middle",
            "bottom",
            "support",
            "bot",
            "sup",
          ].includes(x),
        )
      )
        score += 5;
    }
  }
  return score;
}

tables.sort((a, b) => scoreTable(b) - scoreTable(a));

const chosen = tables[0];
console.log("Chosen header:", chosen.headerKey, "path:", chosen.path);

const header = chosen.header;
const idxId = header.indexOf("id");
const idxD2 = header.indexOf("d2");

// find sibling object that looks like role->rows
let roleBlock = null;
for (const [k, v] of Object.entries(chosen.container)) {
  if (typeof v === "object" && v && !Array.isArray(v)) {
    const keys = Object.keys(v).map((x) => x.toLowerCase());
    if (
      keys.some((x) =>
        ["top", "jungle", "middle", "support", "bottom", "bot", "sup"].includes(
          x,
        ),
      )
    ) {
      roleBlock = v;
      break;
    }
  }
}

if (!roleBlock) {
  throw new Error("Could not find role block next to header in chosen table.");
}

// build rows
const out = [];
for (const [roleKey, rows] of Object.entries(roleBlock)) {
  if (!Array.isArray(rows)) continue;

  const otherRole = normRole(roleKey);

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const id = Number(row[idxId]);
    const d2 = Number(row[idxD2]);

    if (!Number.isFinite(id) || !Number.isFinite(d2)) continue;

    const otherChamp = idToName.get(id) || `#${id}`;
    out.push([MY_ROLE, otherRole, SIDE, MY_CHAMP_NAME, otherChamp, d2]);
  }
}

// write csv
const lines = [
  "myRole,otherRole,side,myChamp,otherChamp,value",
  ...out.map((r) =>
    r
      .map((x) =>
        String(x).includes(",")
          ? `"${String(x).replaceAll('"', '""')}"`
          : String(x),
      )
      .join(","),
  ),
];

fs.writeFileSync("deltas_from_counters_html.csv", lines.join("\n"), "utf8");
console.log(`Wrote ${out.length} rows -> deltas_from_counters_html.csv`);
