import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { MAX_WATCHED } from "@/lib/leaderboard/watchlist";
import { GET } from "./route";

const get = (ids: string) => GET(new Request(`http://localhost/api/players?ids=${ids}`));
let a: number, b: number;

beforeAll(async () => {
  const db = await getDb();
  [{ id: a }, { id: b }] = await db.query<{ id: number }>(
    `insert into players (name, first_seen) values ('Watch A', '2026-09-20T10:00:00Z'), ('Watch B', '2026-10-02T08:30:00Z') returning id`,
  );
});

describe("GET /api/players", () => {
  it("gives the name and first sighting of each player that exists, once each", async () => {
    const res = await get(`${b},${a},${a},999999`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).players).toEqual([
      { id: a, name: "Watch A", firstSeen: "2026-09-20T10:00:00.000Z" },
      { id: b, name: "Watch B", firstSeen: "2026-10-02T08:30:00.000Z" },
    ]);
  });

  it("refuses anything that is not a short list of player ids", async () => {
    for (const ids of ["", "abc", "1,x", "0", "-4", "1.5", "1234567890"]) {
      expect((await get(ids)).status, ids).toBe(400);
    }
    const tooMany = Array.from({ length: MAX_WATCHED + 1 }, (_, i) => i + 1).join(",");
    expect((await get(tooMany)).status).toBe(400);
    const most = Array.from({ length: MAX_WATCHED }, (_, i) => i + 1).join(",");
    expect((await get(most)).status).toBe(200);
  });
});
