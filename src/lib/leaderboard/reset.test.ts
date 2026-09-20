import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";

/**
 * scripts/reset-leaderboard.sql is run by hand against production, once, and cannot be undone.
 * This proves what it clears and, more to the point, what it leaves standing.
 */

const SEASON = { year: 2026, month: 9 };
const t0 = new Date("2026-09-10T00:00:00Z");

let db: Db;
let sql: string;
beforeAll(async () => {
  db = await getDb();
  sql = await readFile("scripts/reset-leaderboard.sql", "utf8");
});

async function count(table: string): Promise<number> {
  const [row] = await db.query<{ n: string }>(`select count(*)::int as n from ${table}`);
  return Number(row.n);
}

describe("reset-leaderboard.sql", () => {
  it("clears the leaderboard, leaves everything else, and lets ingest start again", async () => {
    const [account] = await db.query<{ id: number }>(
      `insert into accounts (discord_id, username) values ('1', 'Noah') returning id`,
    );
    await db.query(
      `insert into decks (id, name, cards, card_key, owner_id) values ('keepme', 'Keep me', $1::text[], $2, $3)`,
      [["Cable", "Sentinel"], "Cable,Sentinel", account.id],
    );
    await db.query(
      `insert into trackers (name, token_hash) values ('PC', 'hash') returning id`,
    );
    await db.query(`insert into meta (key, value) values ('cards_synced', '"2026-09-10"'::jsonb)`);
    await db.query(`insert into meta (key, value) values ('season_closed:2026-08:global', '{}'::jsonb)`);
    await db.query(
      `insert into news (kind, title, body, published_at) values ('balance', 'Keep me too', 'x', now())`,
    );

    await ingestBoard(
      db,
      SEASON,
      "global",
      [
        { rank: 1, name: "Alpha", score: 9000 },
        { rank: 2, name: "Bravo", score: 8500 },
        { rank: 3, name: "Tailender", score: 8000 },
      ],
      36000,
      t0,
    );
    // A rename, so player_names has something in it to clear.
    await ingestBoard(
      db,
      SEASON,
      "global",
      [
        { rank: 1, name: "Alpha", score: 9000 },
        { rank: 2, name: "Charlie", score: 8500 },
        { rank: 3, name: "Tailender", score: 8000 },
      ],
      36000,
      new Date(t0.getTime() + 1800_000),
    );

    expect(await count("players")).toBeGreaterThan(0);
    expect(await count("history")).toBeGreaterThan(0);
    expect(await count("player_names")).toBe(1);

    // The SQL editor takes the file whole; here it is fed a statement at a time.
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(4); // begin, truncate, delete, commit
    for (const statement of statements) await db.query(statement);

    for (const table of ["players", "player_names", "standings", "history", "snapshots"]) {
      expect([table, await count(table)]).toEqual([table, 0]);
    }
    // cards_synced survives. last_snapshot and the season_closed marks must not, or the
    // previous month would stay marked as captured when its rows have just been deleted.
    expect(await count("meta")).toBe(1);
    const [meta] = await db.query<{ key: string }>(`select key from meta`);
    expect(meta.key).toBe("cards_synced");

    // Everything that is not the leaderboard is still there.
    expect(await count("accounts")).toBe(1);
    expect(await count("trackers")).toBe(1);
    expect(await count("news")).toBe(1);
    const [kept] = await db.query<{ name: string; owner_id: number }>(
      `select name, owner_id from decks where id = 'keepme'`,
    );
    expect(kept.name).toBe("Keep me");
    expect(kept.owner_id).toBe(account.id);

    // And the next snapshot works against the empty tables, with ids starting over.
    const after = await ingestBoard(
      db,
      SEASON,
      "global",
      [{ rank: 1, name: "Alpha", score: 9100 }],
      36000,
      new Date(t0.getTime() + 3600_000),
    );
    expect(after.status).toBe("updated");
    expect(after.newPlayers).toBe(1);
    const [fresh] = await db.query<{ id: number }>(`select id from players`);
    expect(fresh.id).toBe(1);
  });
});
