import type { Metadata } from "next";
import { TrackerSetup } from "@/components/tracker-setup";
import { PageHeader, Panel } from "@/components/ui";
import { trackerInviteRequired, trackerReportUrl } from "@/lib/stats/tracker";
import { currentAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats Tracker" };

export default async function TrackerPage() {
  const account = await currentAccount();
  const reportUrl = trackerReportUrl();
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
                Marvel Snap for PC saves the game you just finished on your computer. The tracker reads two of the
                game&apos;s files and never changes either:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>GameState.json</code>, the finished game. The whole file is sent, compressed, and the site keeps
                  only what is listed below. The file itself isn&apos;t stored.
                </li>
                <li>
                  <code>AccountState.json</code>, only to read your Snap account ID.
                </li>
              </ul>
              <p>From each game we keep:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Win, loss or tie, cubes, mode and turns</li>
                <li>Your deck, and the cards you drew and played</li>
                <li>The name you play under, and your opponent&apos;s name and the cards they revealed</li>
                <li>The three locations and what each side played there</li>
              </ul>
              <p>
                Your Snap account ID is stored only as a one-way hash, to avoid counting a game twice. Opponent names only show
                in your own match history, never on public pages.
              </p>
              <p>
                The tracker connects to this site and nowhere else. It is a plain-text script, so you can check that in
                Notepad before you run it.
              </p>
              <p>
                Deleting your key from My stats removes every game it uploaded and the names it recorded for your account.
                If another of your keys still has games for the same Snap account, that key&apos;s record stays until you
                delete it too.
              </p>
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
                the tracker with <code>-SaveRaw</code>. It keeps a copy of each game file in{" "}
                <code>%APPDATA%\SnapHub\raw</code>.{" "}
                {reportUrl ? (
                  <>
                    Send one to us on{" "}
                    <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Discord
                    </a>{" "}
                    so the reader can be fixed.
                  </>
                ) : (
                  <>Send one to whoever invited you so the reader can be fixed.</>
                )}{" "}
                The file contains your Snap account ID and your opponent&apos;s, so send it privately rather than in a public
                channel.
              </li>
              <li>
                <strong className="text-ink">Not approved by Second Dinner.</strong> The tracker only reads files the game
                writes and never touches the game itself, but Marvel Snap&apos;s terms limit software that collects
                information from the game, and Second Dinner has not said whether a tracker like this is allowed. Read the
                terms in the game&apos;s settings and decide for yourself.
              </li>
              <li>
                <strong className="text-ink">To remove it,</strong> close the tracker window, then delete the folder you
                unpacked and <code>%APPDATA%\SnapHub</code>, which holds your key and any games waiting to upload. Delete
                your key from My stats as well if you want your games gone from the site.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
