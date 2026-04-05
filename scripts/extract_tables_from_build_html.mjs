import fs from "fs";

const html = fs.readFileSync("build_page.html", "utf8");

// 1) Etsi header joka sisältää id ja d2 (usein ..._h)
const headerRe = /\["id","wr","d1","d2","pr","n"\]/g;
const headerMatch = headerRe.exec(html);

if (!headerMatch) {
  throw new Error('Header ["id","wr","d1","d2","pr","n"] not found in HTML');
}

console.log("✅ Found header at index", headerMatch.index);

// 2) Ota iso ikkuna headerin ympäriltä ja etsi role-blockit (top/jungle/middle/bottom/support)
const start = Math.max(0, headerMatch.index - 300000);
const end = Math.min(html.length, headerMatch.index + 300000);
const chunk = html.slice(start, end);

// 3) Poimi role arrays:  "top":[[...],[...],...]
const roleRe = /"(top|jungle|middle|bottom|support)"\s*:\s*(\[\[[\s\S]*?\]\])/g;

const roles = {};
let m;
let found = 0;

while ((m = roleRe.exec(chunk))) {
  const role = m[1];
  const arrText = m[2];

  // pidetään vain järkevän kokoiset blokit (ettei napata väärää)
  if (arrText.length < 200) continue;

  roles[role] = arrText;
  found++;
  if (found >= 10) break; // safety
}

console.log("Found role blocks:", Object.keys(roles));

if (Object.keys(roles).length === 0) {
  // dumpataan pieni preview helpompaa debugia varten
  console.log("Chunk preview:", chunk.slice(0, 500));
  throw new Error(
    "No role blocks found near header. We need to widen/shift search window.",
  );
}

// 4) Parseaa rows: [[id,wr,d1,d2,pr,n], ...]
function parseRows(arrText) {
  // arrText on muotoa [[...],[...],...]
  // Muutetaan JS-literal -> JSON: pitäisi jo olla JSON-yhteensopiva (numerot)
  // Varmistus: poistetaan trailing comma -tyyppiset
  const cleaned = arrText.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
  return JSON.parse(cleaned);
}

const out = {};
for (const [role, arrText] of Object.entries(roles)) {
  try {
    out[role] = parseRows(arrText);
    console.log(role, "rows:", out[role].length);
  } catch (e) {
    console.log("Failed parsing role", role, "len", arrText.length);
    throw e;
  }
}

fs.writeFileSync(
  "extracted_role_tables.json",
  JSON.stringify(out, null, 2),
  "utf8",
);
console.log("Wrote extracted_role_tables.json");
