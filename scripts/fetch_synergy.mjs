import fs from "fs";
import path from "path";

// ========= CONFIG =========
const PATCH = "16.2"; // vaihda kun haluut
const TIER = "all";
const QUEUE = "ranked";
const REGION = "all";

// Mistä luetaan sun champ poolit per rooli
const POOLS_PATH = path.resolve("src/data/pools.json");

// Mihin kirjoitetaan synergy-rivit
const OUT_CSV = path.resolve("data_raw/synergy.csv");

// ========= HELPERS =========
const ROLE_MAP_MEGA_TO_APP = {
  top: "top",
  jungle: "jng",
  middle: "mid",
  bottom: "bot",
  support: "sup",
};

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function slugifyChampionName(ddragonId) {
  // Data Dragon id esim: "MissFortune", "ChoGath", "KhaZix", "Nunu", "AurelionSol"
  // Lolalytics slug yleensä: lowercase, ilman välimerkkejä
  return ddragonId.toLowerCase();
}

// Poikkeukset (tämä lista on lyhyt, mutta tärkeä)
const SLUG_EXCEPTIONS = {
  // DataDragon id : lolalytics slug
  monkeyking: "wukong", // DataDragon käyttää monkeyking, lolalytics usein wukong
};

const MYCHAMP_EXCEPTIONS = {
  renataglasc: "renata",
};

function ddragonToLolalyticsSlug(ddragonId) {
  const base = slugifyChampionName(ddragonId);
  return SLUG_EXCEPTIONS[base] ?? base;
}

function normSlug(s) {
  const base = String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // poista välit
    .replace(/['.]/g, "") // poista heittomerkit/pisteet
    .replace(/-/g, ""); // poista viivat

  return MYCHAMP_EXCEPTIONS[base] ?? base;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://lolalytics.com",
      referer: "https://lolalytics.com/",
    },
  });

  const ct = res.headers.get("content-type") || "";
  const txt = await res.text();

  if (!res.ok) {
    throw new Error(
      `Fetch failed ${res.status} for ${url}\ncontent-type: ${ct}\nfirst chars: ${txt.slice(0, 120)}`,
    );
  }

  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(
      `Non-JSON response from ${url}\ncontent-type: ${ct}\nfirst chars: ${txt.slice(0, 120)}`,
    );
  }
}

async function fetchDdragonChampionKeyMap() {
  const versions = await fetchJson(
    "https://ddragon.leagueoflegends.com/api/versions.json",
  );
  const latest = versions[0];

  const champJson = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`,
  );

  const keyToId = {};
  for (const champ of Object.values(champJson.data)) {
    keyToId[String(champ.key)] = champ.id;
  }

  console.log("DD keyToId size:", Object.keys(keyToId).length);
  console.log("Has 82?", !!keyToId["82"], "->", keyToId["82"]);
  console.log("Has 17?", !!keyToId["17"], "->", keyToId["17"]);

  return keyToId;
}

function readPools() {
  const pools = JSON.parse(fs.readFileSync(POOLS_PATH, "utf8"));
  return pools; // { top:[slug..], jng:[..], mid:[..], bot:[..], sup:[..] }
}

function writeCsv(rows) {
  ensureDir(OUT_CSV);
  const header = "myRole,otherRole,side,myChamp,otherChamp,value";
  const lines = [
    header,
    ...rows.map((r) =>
      [r.myRole, r.otherRole, r.side, r.myChamp, r.otherChamp, r.value].join(
        ",",
      ),
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
}

// ========= MAIN =========
async function main() {
  const pools = readPools();

  // Kerätään kaikki sun pelaamat chämppislugit kaikista rooleista
  const myChamps = Array.from(new Set(Object.values(pools).flat()));

  if (myChamps.length === 0) {
    console.log("No champs found in pools.json");
    return;
  }

  console.log(`My champs in pools: ${myChamps.length}`);

  // dd key -> ddragonId -> lolalytics slug
  const keyToId = await fetchDdragonChampionKeyMap();

  const rows = [];
  const seen = new Set();

  let skippedNoIdOrD2 = 0;
  let skippedNoMap = 0;
  let skippedBadValue = 0;
  let added = 0;
  let debugPrinted = 0;

  for (const myChamp of myChamps) {
    // Päätellään myRole poolista: jos champ esiintyy useassa roolissa, tehdään kaikille
    const myRoles = Object.entries(pools)
      .filter(([, arr]) => Array.isArray(arr) && arr.includes(myChamp))
      .map(([role]) => role);

    for (const myRole of myRoles) {
      const myChampSlug = normSlug(myChamp);

      const url =
        `https://a1.lolalytics.com/mega/?ep=build-team&v=1` +
        `&patch=${encodeURIComponent(PATCH)}` +
        `&c=${encodeURIComponent(myChampSlug)}` +
        `&lane=all&tier=${encodeURIComponent(TIER)}` +
        `&queue=${encodeURIComponent(QUEUE)}` +
        `&region=${encodeURIComponent(REGION)}`;

      console.log(`Fetching synergy: ${myChamp} (${myRole})`);

      const data = await fetchJson(url);

      if (data?.status) {
        console.log(
          "  mega returned status:",
          data.status,
          "for champ:",
          myChampSlug,
        );
      }

      const team = data.team;

      // DEBUG: printtaa 1 kerran per champ+role
      console.log("  data keys:", Object.keys(data || {}));
      console.log("  team type:", typeof team, "isArray:", Array.isArray(team));
      console.log("  team keys:", team ? Object.keys(team) : null);

      // Näytä roolien listojen tyyppi + pituus
      if (team && typeof team === "object") {
        for (const k of Object.keys(team)) {
          const v = team[k];
          console.log(
            `  role ${k}:`,
            Array.isArray(v) ? `array len=${v.length}` : `type=${typeof v}`,
          );
        }
      }

      if (!team || typeof team !== "object") {
        console.log(`  No team data for ${myChamp}`);
        continue;
      }

      for (const [megaRole, list] of Object.entries(team)) {
        const otherRole = ROLE_MAP_MEGA_TO_APP[megaRole] ?? megaRole;
        if (!Array.isArray(list)) continue;

        for (const row of list) {
          const id = row?.[0];
          const d2 = row?.[3];
          if (id == null || d2 == null) {
            skippedNoIdOrD2++;
            continue;
          }

          const ddragonId = keyToId[String(id)];
          if (!ddragonId) {
            skippedNoMap++;
            // tulosta eka 5 unmapped id:tä että nähdään mitä ne on
            if (debugPrinted < 5) {
              console.log("UNMAPPED id:", id, "sample row:", row);
              debugPrinted++;
            }
            continue;
          }

          const otherChamp = ddragonToLolalyticsSlug(ddragonId);

          const value = Number(d2);
          if (!Number.isFinite(value)) {
            skippedBadValue++;
            continue;
          }
          const key = `${myRole}|${otherRole}|ALLY|${myChamp}|${otherChamp}`;
          if (seen.has(key)) continue;
          seen.add(key);

          rows.push({
            myRole,
            otherRole,
            side: "ALLY",
            myChamp: myChampSlug,
            otherChamp,
            value,
          });

          added++;
        }
      }
    }
  }
  console.log("added:", added);
  console.log("skippedNoIdOrD2:", skippedNoIdOrD2);
  console.log("skippedNoMap:", skippedNoMap);
  console.log("skippedBadValue:", skippedBadValue);

  writeCsv(rows);
  console.log(`Wrote ${rows.length} rows -> ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
