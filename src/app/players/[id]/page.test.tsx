import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { claimPlayer, verifyClaim } from "@/lib/leaderboard/claims";
import { PlayerClaim } from "@/components/player-claim";
import type { PlayerSeason } from "@/lib/leaderboard/queries";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
vi.mock("@/lib/leaderboard/queries", () => ({ getPlayer: vi.fn(), getPlayerHistory: vi.fn() }));
vi.mock("@/lib/stats/identity", () => ({ otherNamesUsedWith: vi.fn().mockResolvedValue([]) }));

const { currentAccount } = await import("@/lib/auth/session");
const { getPlayer, getPlayerHistory } = await import("@/lib/leaderboard/queries");
const { default: PlayerPage } = await import("./page");

// Inspect the actual Client Component props produced by the Server Component, rather than
// rendered text: returning null in the client must never be mistaken for keeping data private.
function claimProps(node: ReactNode): ComponentProps<typeof PlayerClaim> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = claimProps(child);
      if (found) return found;
    }
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === PlayerClaim) return node.props as ComponentProps<typeof PlayerClaim>;
    return claimProps(node.props.children);
  }
}

let db: Db;
let owner: number;
let other: number;
beforeEach(async () => {
  db = await getDb();
  await db.query(`delete from player_claims`);
  await db.query(`delete from snap_names`);
  await db.query(`delete from players`);
  await db.query(`delete from accounts`);
  const accounts = await db.query<{ id: number }>(
    `insert into accounts (discord_id, username) values ('111', 'Private claimant'), ('222', 'Other') returning id`,
  );
  [owner, other] = accounts.map((a) => a.id);
  await db.query(`insert into players (id, name) values (11, 'PXL Rick')`);
  await claimPlayer(11, owner);
  vi.stubEnv("ADMIN_DISCORD_IDS", "999");
  vi.mocked(getPlayerHistory).mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const account = (id: number, discordId: string) => ({ id, discordId, username: "Viewer", avatar: null });
const at = "2026-09-21T12:00:00.000Z";

describe.each([false, true])("player page claim props (has leaderboard history: %s)", (hasHistory) => {
  beforeEach(() => {
    const seasons: PlayerSeason[] = hasHistory
      ? [{ season: "2026-09", region: "global", rank: 1, score: 10000, bestRank: 1, peakScore: 10000, onBoard: true, updatedAt: at }]
      : [];
    vi.mocked(getPlayer).mockResolvedValue({
      id: 11, name: "PXL Rick", firstSeen: at, lastSeen: at, sameNameCount: 0, formerNames: [], seasons,
    });
  });

  const render = async () => {
    const result = claimProps(await PlayerPage({
      params: Promise.resolve({ id: "11" }), searchParams: Promise.resolve({}),
    }));
    expect(result).toBeDefined();
    return result!;
  };

  it("sends no pending claim to anonymous visitors or another account", async () => {
    for (const viewer of [null, account(other, "222")]) {
      vi.mocked(currentAccount).mockResolvedValue(viewer);
      const props = await render();
      expect(props.claim).toBeNull();
      expect(props.mine).toBe(false);
      expect(JSON.stringify(props)).not.toContain("Private claimant");
    }
  });

  it("lets the owner and admin review only the necessary display fields", async () => {
    for (const viewer of [account(owner, "111"), account(other, "999")]) {
      vi.mocked(currentAccount).mockResolvedValue(viewer);
      const props = await render();
      expect(props.claim).toEqual({ username: "Private claimant", verifiedAt: null });
      expect(props.mine).toBe(viewer.id === owner);
    }
  });

  it("keeps legacy tracker confirmations out of anonymous props", async () => {
    await db.query(`update player_claims set verified_at = now(), verified_by = 'tracker' where player_id = 11`);
    vi.mocked(currentAccount).mockResolvedValue(null);
    expect((await render()).claim).toBeNull();
  });

  it("publishes only the display fields after admin confirmation", async () => {
    await verifyClaim(11, new Date(at));
    vi.mocked(currentAccount).mockResolvedValue(null);
    expect((await render()).claim).toEqual({ username: "Private claimant", verifiedAt: at });
  });
});
