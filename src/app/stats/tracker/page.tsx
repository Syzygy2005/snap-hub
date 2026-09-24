import type { Metadata } from "next";
import { TrackerSetup } from "@/components/tracker-setup";
import { PageHeader, Panel } from "@/components/ui";
import { trackerInviteRequired } from "@/lib/stats/tracker";
import { currentAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats Tracker" };

export default async function TrackerPage() {
  const account = await currentAccount();
  return (
    <>
      <PageHeader
        title="Stats Tracker"
        subtitle="Track your progress. Record your Marvel Snap games on PC for win rate, cube rate and match history."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <TrackerSetup inviteRequired={trackerInviteRequired()} signedIn={!!account} />

        <div className="space-y-6">
          <Panel title="What gets recorded">
            <div className="space-y-3 p-4 text-sm text-muted">
              <p>
                Marvel Snap for PC saves the game you just finished in a file on your computer. The tracker reads it (it never
                changes it) and sends it here, where we keep:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Win, loss or tie, cubes, mode and turns</li>
                <li>Your deck, and the cards you drew and played</li>
                <li>Your opponent&apos;s name and the cards they revealed</li>
                <li>The three locations</li>
              </ul>
              <p>
                Your Snap account ID is stored only as a one-way hash, to avoid counting a game twice. Opponent names only show
                in your own match history, never on public pages.
              </p>
              <p>You can delete your key and every game it uploaded from My stats at any time.</p>
            </div>
          </Panel>

          <Panel title="Good to know">
            <ul className="list-disc space-y-2 p-4 pl-9 text-sm text-muted">
              <li>
                <strong className="text-ink">PC only.</strong> Phones don&apos;t give access to the game&apos;s files.
              </li>
              <li>
                <strong className="text-ink">Keep it running.</strong> The game only keeps the latest game on disk, so games
                played while the tracker is closed can&apos;t be added later.
              </li>
              <li>
                <strong className="text-ink">Game updates</strong> can change the file format. If a game won&apos;t record, run
                the tracker with <code>-SaveRaw</code> to keep a copy of the file so the parser can be fixed.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
