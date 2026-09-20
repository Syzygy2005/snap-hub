import type { Metadata } from "next";
import Link from "next/link";
import { MyStats } from "@/components/my-stats";
import { PageHeader } from "@/components/ui";
import { currentAccount } from "@/lib/auth/session";
import { claimForAccount } from "@/lib/leaderboard/claims";

export const metadata: Metadata = { title: "My Stats" };

// Reads the session to show whose leaderboard profile this is, so it renders per request.
export const dynamic = "force-dynamic";

export default async function MyStatsPage() {
  const account = await currentAccount();
  const claim = account ? await claimForAccount(account.id) : null;

  return (
    <>
      <PageHeader title="My Stats" subtitle="Your tracked games: win rate, cube rate, decks and recent matches." />
      {account && <ClaimedProfile claim={claim} />}
      <MyStats />
    </>
  );
}

/**
 * The bridge between the two halves of the site: tracked games on this page, and the public
 * board row the same person appears on. Signed-out visitors see nothing, because there is
 * nobody to have claimed anything.
 */
function ClaimedProfile({ claim }: { claim: Awaited<ReturnType<typeof claimForAccount>> }) {
  if (!claim) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        On the leaderboard?{" "}
        <Link href="/players" className="text-accent hover:underline">
          Find your name
        </Link>{" "}
        and press &ldquo;This is me&rdquo; to link it here.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface/80 px-4 py-3 text-sm">
      <span className="text-muted">Your leaderboard profile: </span>
      <Link href={`/players/${claim.playerId}`} className="font-medium text-accent hover:underline">
        {claim.playerName.trim()}
      </Link>
      {!claim.verifiedAt && (
        <span className="ml-2 text-xs text-faint">
          not confirmed yet, so only you can see it
        </span>
      )}
    </div>
  );
}
