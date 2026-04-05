export type Role = "top" | "jng" | "mid" | "bot" | "sup";
export type Side = "ALLY" | "ENEMY";

type RoleDeltas = Record<string, number>;
type DeltasByRole = Partial<
  Record<Role, Partial<Record<Side, Partial<Record<Role, RoleDeltas>>>>>
>;

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/['.]/g, "")
    .replace(/-/g, "");
}

function key(kind: Side, you: string, other: string) {
  const prefix = kind === "ALLY" ? "s:" : "c:";
  return `${prefix}${norm(you)}|${norm(other)}`;
}

export function recommendWithRoles(args: {
  myRole: Role;
  pool: string[];
  myTeam: Partial<Record<Role, string>>;
  enemyTeam: Partial<Record<Role, string>>;
  deltasByRole: DeltasByRole;
  prefs: Record<string, number>;
  topN: number;
}) {
  const { myRole, pool, myTeam, enemyTeam, deltasByRole, prefs, topN } = args;

  const results = pool.map((champ) => {
    let score = 0;

    // ally roles
    for (const [role, otherChamp] of Object.entries(myTeam) as [
      Role,
      string,
    ][]) {
      if (!otherChamp || otherChamp === champ) continue;

      const roleMap = deltasByRole[myRole]?.ALLY?.[role] ?? ({} as RoleDeltas);

      score += roleMap[key("ALLY", champ, otherChamp)] ?? 0;
    }

    // enemy roles
    for (const [role, otherChamp] of Object.entries(enemyTeam) as [
      Role,
      string,
    ][]) {
      if (!otherChamp || otherChamp === champ) continue;

      const roleMap = deltasByRole[myRole]?.ENEMY?.[role] ?? ({} as RoleDeltas);

      score += roleMap[key("ENEMY", champ, otherChamp)] ?? 0;
    }

    score += prefs[norm(champ)] ?? 0;

    return { champ, score };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
