import { useEffect, useMemo, useState } from "react";
import deltasData from "./data/deltas.json";
import aliasesData from "./data/aliases.json";
import championsData from "./data/champions.json";
import poolsData from "./data/pools.json";
import { recommendWithRoles } from "./lib/scoring";
import type { Role } from "./lib/scoring";

type AliasesJson = { aliases: Record<string, string> };
type PoolsJson = Record<Role, string[]>;
type ChampionsJson = { champions: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeltasByRole = any;

const POOLS = poolsData as PoolsJson;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DELTAS_BY_ROLE: DeltasByRole = deltasData as any;
const RAW_ALIASES = (aliasesData as AliasesJson).aliases;
const ALL_CHAMPS = (championsData as ChampionsJson).champions;

const ROLES: Role[] = ["top", "jng", "mid", "bot", "sup"];

// ---------- alias helperit ----------
function champKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // spaces pois
    .replace(/['.]/g, "") // ' ja . pois
    .replace(/-/g, ""); // - pois
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function buildAliasMap(
  champs: readonly string[],
  nicknames: Record<string, string>,
): Map<string, string> {
  const m = new Map<string, string>();

  for (const c of champs) {
    const n = norm(c);
    m.set(n, c);
    m.set(n.replace(/['.]/g, ""), c);
    m.set(n.replace(/-/g, ""), c);

    // prefixit nopeaan syöttöön
    for (const len of [3, 4, 5, 6]) {
      if (n.length >= len) {
        const p = n.slice(0, len);
        if (!m.has(p)) m.set(p, c);
      }
    }
  }

  // manuaaliset nickit (ylikirjoittaa tarvittaessa)
  for (const [alias, champ] of Object.entries(nicknames)) {
    m.set(norm(alias), champ);
  }

  return m;
}

const KNOWN_CHAMPS = Array.from(
  new Set([...ALL_CHAMPS, ...Object.values(RAW_ALIASES)]),
);

const ALIAS = buildAliasMap(KNOWN_CHAMPS, RAW_ALIASES);

function resolveChamp(input: string) {
  const k = norm(input);
  return ALIAS.get(k) ?? ALIAS.get(k.slice(0, 6)) ?? "";
}

// ---------- UI komponentti ----------
function RoleRow(props: {
  label: Role;
  rawValue: string;
  onRawChange: (v: string) => void;
  onCommit: () => void;
  placeholder: string;
  resolved: string;
}) {
  const { label, rawValue, onRawChange, onCommit, placeholder, resolved } =
    props;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ fontWeight: 800 }}>{label}</div>

      <input
        value={rawValue}
        onChange={(e) => onRawChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onRawChange("");
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #ccc",
        }}
      />

      {rawValue.trim().length > 0 && !resolved && (
        <div style={{ gridColumn: "2 / 3", color: "#b00020", fontSize: 12 }}>
          unknown champ
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [myRole, setMyRole] = useState<Role>("bot");
  const activePool = useMemo(() => POOLS[myRole] ?? [], [myRole]);
  const [topN, setTopN] = useState(4);

  // raw teksti (kirjoittamista varten)
  const [myTeamRaw, setMyTeamRaw] = useState<Partial<Record<Role, string>>>({
    top: "",
    jng: "",
    mid: "",
    bot: "",
    sup: "",
  });

  const [enemyTeamRaw, setEnemyTeamRaw] = useState<
    Partial<Record<Role, string>>
  >({
    top: "",
    jng: "",
    mid: "",
    bot: "",
    sup: "",
  });

  // resolved (laskentaa varten)
  const myTeam = useMemo(() => {
    const out: Partial<Record<Role, string>> = {};
    for (const r of ROLES) {
      const raw = (myTeamRaw[r] ?? "").trim();
      out[r] = raw ? resolveChamp(raw) : "";
    }
    return out;
  }, [myTeamRaw]);

  const enemyTeam = useMemo(() => {
    const out: Partial<Record<Role, string>> = {};
    for (const r of ROLES) {
      const raw = (enemyTeamRaw[r] ?? "").trim();
      out[r] = raw ? resolveChamp(raw) : "";
    }
    return out;
  }, [enemyTeamRaw]);

  // ---- patch modifiers (roolikohtaisesti) ----
  type PrefsByRole = Partial<Record<Role, Record<string, number>>>;
  const PREFS_KEY = "lol_pick_helper_prefs_by_role_v1";

  const [prefsByRole, setPrefsByRole] = useState<PrefsByRole>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? (obj as PrefsByRole) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefsByRole));
  }, [prefsByRole]);

  const prefs = useMemo(() => prefsByRole[myRole] ?? {}, [prefsByRole, myRole]);

  function clampPref(v: number) {
    return Math.max(-3, Math.min(3, v));
  }

  function setPref(champNameShown: string, delta: number) {
    const key = champKey(champNameShown);

    setPrefsByRole((prev) => {
      const roleMap = { ...(prev[myRole] ?? {}) };

      const current = roleMap[key] ?? 0;
      const next = clampPref(current + delta);

      if (next === 0) delete roleMap[key];
      else roleMap[key] = next;

      return { ...prev, [myRole]: roleMap };
    });
  }

  // suositukset
  const recs = useMemo(() => {
    return recommendWithRoles({
      myRole,
      pool: activePool,
      myTeam,
      enemyTeam,
      deltasByRole: DELTAS_BY_ROLE,
      prefs,
      topN,
    });
  }, [myRole, activePool, myTeam, enemyTeam, prefs, topN]);

  function commitMy(role: Role) {
    setMyTeamRaw((prev) => {
      const raw = (prev[role] ?? "").trim();
      if (!raw) return { ...prev, [role]: "" };
      const resolved = resolveChamp(raw);
      return { ...prev, [role]: resolved || raw };
    });
  }

  function commitEnemy(role: Role) {
    setEnemyTeamRaw((prev) => {
      const raw = (prev[role] ?? "").trim();
      if (!raw) return { ...prev, [role]: "" };
      const resolved = resolveChamp(raw);
      return { ...prev, [role]: resolved || raw };
    });
  }

  function resetTeams() {
    const empty: Partial<Record<Role, string>> = {
      top: "",
      jng: "",
      mid: "",
      bot: "",
      sup: "",
    };
    setMyTeamRaw(empty);
    setEnemyTeamRaw(empty);
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <h1>LoL Pick Helper</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>my role</div>
          <select
            value={myRole}
            onChange={(e) => setMyRole(e.target.value as Role)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>top N</div>
          <input
            type="number"
            min={1}
            max={10}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{
              width: 120,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
        </label>

        <button
          onClick={resetTeams}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: 800,
          }}
          title="Clear champs for next game"
        >
          reset champs
        </button>

        <div style={{ opacity: 0.7 }}>
          kirjoita lyhenne → Enter. ESC tyhjentää. puuttuva delta = 0.
        </div>
      </div>

      {/* patch modifiers */}
      <div
        style={{
          marginTop: 18,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>patch modifiers (pool only)</h2>

        <div style={{ display: "grid", gap: 8 }}>
          {activePool.map((c) => {
            const v = prefs[champKey(c)] ?? 0;

            return (
              <div
                key={c}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: "1px dashed #eee",
                }}
              >
                <div style={{ fontWeight: 700 }}>{c}</div>

                <button
                  onClick={() => setPref(c, -1)}
                  disabled={v <= -3}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                  }}
                >
                  -1
                </button>

                <div
                  style={{ width: 40, textAlign: "center", fontWeight: 800 }}
                >
                  {v}
                </div>

                <button
                  onClick={() => setPref(c, +1)}
                  disabled={v >= 3}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                  }}
                >
                  +1
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          modifiers apply only to your pool champs. range -3..+3. (0 = no
          change)
        </div>
      </div>

      {/* teams */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginTop: 18,
        }}
      >
        <div
          style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}
        >
          <h2 style={{ marginTop: 0 }}>my team</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {ROLES.map((r) => (
              <RoleRow
                key={r}
                label={r}
                rawValue={myTeamRaw[r] ?? ""}
                resolved={resolveChamp(myTeamRaw[r] ?? "")}
                onRawChange={(v) =>
                  setMyTeamRaw((prev) => ({ ...prev, [r]: v }))
                }
                onCommit={() => commitMy(r)}
                placeholder="type: leo / mf / j4 ..."
              />
            ))}
          </div>
        </div>

        <div
          style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}
        >
          <h2 style={{ marginTop: 0 }}>enemy team</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {ROLES.map((r) => (
              <RoleRow
                key={r}
                label={r}
                rawValue={enemyTeamRaw[r] ?? ""}
                resolved={resolveChamp(enemyTeamRaw[r] ?? "")}
                onRawChange={(v) =>
                  setEnemyTeamRaw((prev) => ({ ...prev, [r]: v }))
                }
                onCommit={() => commitEnemy(r)}
                placeholder="type: blitz / zed ..."
              />
            ))}
          </div>
        </div>
      </div>

      {/* recs */}
      <div
        style={{
          marginTop: 18,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>recommendations</h2>
        <ol>
          {recs.map((r) => (
            <li key={r.champ}>
              <b>{r.champ}</b> — score {r.score.toFixed(2)}
            </li>
          ))}
        </ol>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
        resolved my team:{" "}
        {ROLES.map((r) => `${r}=${myTeam[r] || "-"}`).join(" | ")}
        <br />
        resolved enemy team:{" "}
        {ROLES.map((r) => `${r}=${enemyTeam[r] || "-"}`).join(" | ")}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
        active pool ({myRole}): {activePool.join(", ") || "—"}
      </div>
    </div>
  );
}
