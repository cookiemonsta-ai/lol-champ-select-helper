import fs from "fs";
import path from "path";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return await res.json();
}

function slugify(ddragonId) {
  return ddragonId
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

async function main() {
  const versions = await fetchJson(
    "https://ddragon.leagueoflegends.com/api/versions.json",
  );
  const latest = versions[0];

  const champJson = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`,
  );

  const aliases = {};

  for (const champ of Object.values(champJson.data)) {
    const slug = slugify(champ.id);
    aliases[slug] = slug;
  }

  // aakkosjärjestys
  const sorted = Object.fromEntries(
    Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)),
  );

  const out = {
    aliases: sorted,
  };

  const outPath = path.resolve("src/data/aliases.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote ${Object.keys(sorted).length} aliases -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
