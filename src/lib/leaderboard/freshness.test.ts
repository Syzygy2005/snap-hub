import { expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { lastBoardCheck } from "./queries";
it("uses the recorded check timestamp even when metadata contains a JSON string", async () => {
  const db = await getDb();
  const at = new Date("2026-09-21T20:55:02.536Z");
  expect(await lastBoardCheck("2026-09","global")).toBeNull();
  // Mirrors a JSONB string value, as opposed to a JSONB object. String.at is a function.
  await db.query(`insert into meta(key,value,updated_at) values ($1,to_jsonb($2::text),$3)`,
    ["board_checked:2026-09:global",JSON.stringify({at:at.toISOString()}),at]);
  expect(await lastBoardCheck("2026-09","global")).toBe(at.toISOString());
  await db.query(`update meta set value = jsonb_build_object('at','old payload date') where key=$1`,["board_checked:2026-09:global"]);
  expect(await lastBoardCheck("2026-09","global")).toBe(at.toISOString());
});
