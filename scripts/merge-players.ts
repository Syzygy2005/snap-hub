// Joins two player rows that are one person under two names.
//
//   npm run merge-players -- --keep 12 --absorb 34          (shows the plan, changes nothing)
//   npm run merge-players -- --keep 12 --absorb 34 --apply  (does it)
//
// Against production: DATABASE_URL=... npm run merge-players -- ...
// Locally the dev server must be stopped first; PGlite allows one process at a time.
import { planMerge, applyMerge } from "@/lib/leaderboard/merge";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const keep = Number(arg("keep"));
const absorb = Number(arg("absorb"));
const apply = process.argv.includes("--apply");

if (!Number.isInteger(keep) || !Number.isInteger(absorb)) {
  console.error("Usage: npm run merge-players -- --keep <id> --absorb <id> [--apply]");
  process.exit(1);
}

const result = await planMerge(keep, absorb);
if (!result.ok) {
  console.error(`Refused: ${result.error}`);
  process.exit(1);
}

const { plan } = result;
console.log(`Keep    #${plan.keep.id} ${plan.keep.name}`);
console.log(`Absorb  #${plan.absorb.id} ${plan.absorb.name}  (last on a board ${plan.absorb.lastSeen})`);
console.log(`\n  ${plan.historyRows} history rows move across`);
console.log(`  ${plan.seasonsMoved.length} season(s) move as is: ${plan.seasonsMoved.map((s) => `${s.season}/${s.region}`).join(", ") || "none"}`);
console.log(`  ${plan.seasonsCombined.length} season(s) combine: ${plan.seasonsCombined.map((s) => `${s.season}/${s.region}`).join(", ") || "none"}`);
console.log(`\n  "${plan.absorb.name}" is kept as a former name on #${plan.keep.id}.`);

if (!apply) {
  console.log("\nNothing changed. Re-run with --apply to do it.");
  process.exit(0);
}

await applyMerge(plan);
console.log(`\nMerged. #${plan.absorb.id} is gone; its history now belongs to #${plan.keep.id}.`);
process.exit(0);
