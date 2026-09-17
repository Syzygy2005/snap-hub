import { currentAccount } from "@/lib/auth/session";
import { getPersonalStats, STAT_WINDOWS, type StatWindow } from "@/lib/stats/queries";
import { authenticate, deleteTracker, trackersForAccount } from "@/lib/stats/tracker";

export const dynamic = "force-dynamic";

/**
 * Whose games to show. A signed-in account wins, because that spans every key they have
 * added and is the reason to sign in at all; a bare tracker key still works on its own.
 */
async function subject(request: Request) {
  const account = await currentAccount();
  if (account) {
    const trackers = await trackersForAccount(account.id);
    return {
      id: account.id,
      name: account.username,
      trackerIds: trackers.map((t) => t.id),
      signedIn: true as const,
      trackers,
      // Their own Discord id, shown back to them because ADMIN_DISCORD_IDS needs it and the
      // only other way to find it was Discord's developer mode.
      discordId: account.discordId,
    };
  }
  const tracker = await authenticate(request);
  if (!tracker) return null;
  return {
    id: tracker.id,
    name: tracker.name,
    trackerIds: [tracker.id],
    signedIn: false as const,
    trackers: [],
    discordId: null,
  };
}

export async function GET(request: Request) {
  const who = await subject(request);
  if (!who) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });
  const w = new URL(request.url).searchParams.get("window");
  const window: StatWindow = w && w in STAT_WINDOWS ? (w as StatWindow) : "30d";

  // Whether a key this browser still holds is already on the account, so the page only
  // offers to add it when there is something to add.
  let heldKeyLinked: boolean | null = null;
  if (who.signedIn) {
    const held = await authenticate(request);
    heldKeyLinked = held ? who.trackerIds.includes(held.id) : null;
  }

  return Response.json({
    ok: true,
    signedIn: who.signedIn,
    trackers: who.trackers,
    discordId: who.discordId,
    heldKeyLinked,
    stats: await getPersonalStats(who, window),
  });
}

// Removes the key and every game uploaded with it. Still key-only: signing in groups keys,
// it doesn't hand the account a way to delete keys it has never held.
export async function DELETE(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });
  await deleteTracker(tracker.id);
  return Response.json({ ok: true });
}
