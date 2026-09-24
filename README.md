# Snap Hub

**Build / Track / Compete.** A fan-made Marvel Snap site: an Infinite leaderboard that keeps history, a deck
builder, and win rate / cube rate stats from a PC tracker.

- **Leaderboard**: the official top 1000, saved every 10 minutes. 24h rank and point changes, past seasons, and
  players who share a name kept apart.
- **Movers**: climbers, fallers, new entries and drop-outs over 6h / 24h / 7d. A link to it unfurls
  with the day's biggest climbers drawn from the board, rather than a logo.
- **Player pages**: rank and points chart, point changes, past seasons.
- **Deck builder**: filter by cost, ability and series; energy curve; copy a code the game accepts; import codes
  (long or short format, or the text the game copies). Decks save to a named list in the browser, or share as a
  public link listed on /decks or an unlisted link that is not.
- **Decks**: browse shared decks, search deck names and the cards inside them, filter by cards a deck contains.
  A deck shared while signed in carries the poster's name.
- **What's new**: `/changelog`, written by hand in `src/lib/changelog.ts`. Add an entry when a change is worth
  a player noticing; the newest one also shows on the home page.
- **Where your cubes go**: win rate and cube rate split by who raised the stakes, and what a retreat costs
  against what sitting through a loss costs. Win rate is the wrong headline for this game; you can win most
  of your matches and still finish down.
- **Stats**: meta share, win rate and cube rate by deck archetype and by card (in deck / drawn / played), plus a
  private "My stats" page with match history, including how the three locations stood when each game ended.
  The game file is parsed against a real, anonymised `GameState.json` kept as a fixture.
  Data comes from players running the PC tracker.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3100. No database setup: without `DATABASE_URL` the app uses PGlite, a Postgres that runs
inside Node and stores files in `.data/pglite`. While `npm run dev` runs it takes a leaderboard snapshot on start and
every 30 minutes. `npm run snapshot` takes one by hand; `npm test` runs the tests.

## Put it online

You need GitHub, Supabase and Vercel accounts (all free tiers).

1. **GitHub**: create an empty private repository (no README), then push this folder to it.
2. **Supabase**: New project. Pick a region near you and a database password with only letters and numbers
   (symbols need URL-encoding). When it's ready: **Connect** → **Connection string** → **Transaction pooler** → copy
   the URI (port 6543) and put your password in place of `[YOUR-PASSWORD]`.
3. **Vercel**: Add New → Project → import the GitHub repo. Before deploying, add Environment Variables:
   - `DATABASE_URL`: the Supabase pooler URI
   - `CRON_SECRET`: a long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `TRACKER_INVITE_CODE` (optional): a code people must enter to make a tracker key, on top of
     the Discord sign-in every key already needs
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` (optional): a Discord application, which turns on
     sign-in. Register `<site>/api/auth/discord/callback` as its one redirect URL. Leave both unset and
     the sign-in button never appears.
   - `SITE_URL` (optional): the one address sign-in runs on, matching the redirect registered above.
     Without it Vercel's production domain is used, and locally the address the request arrived on.
   - `ADMIN_DISCORD_IDS` (optional): comma separated Discord user ids who can moderate. Unset means
     nobody can, including you.

   Scope `DATABASE_URL` to Production only if you do not want preview deployments writing to the
   live database. Previews then have no database at all: PGlite falls back to an in-memory one,
   so they load and show an empty board rather than failing, and say so in the function log.

   Deploy. Tables are created on the first request. Then in **Settings → Functions**, set the function region to the
   one closest to your Supabase region so database calls stay fast.
4. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `SITE_URL`: your Vercel address, e.g. `https://snap-hub.vercel.app`
   - `CRON_SECRET`: the same value as in Vercel
5. **GitHub repo → Actions → Leaderboard snapshot → Run workflow** for the first snapshot. It then runs every 10
   minutes. GitHub pauses scheduled workflows after 60 days without commits; re-enable it from the Actions tab.

Every push to GitHub redeploys the site on Vercel.

## Tagging shared links

Vercel Analytics reads UTM parameters straight off the landing URL, which is what fills the
**UTM Parameters** tab next to Referrers. There is no code to write; the whole job is putting the
same tag on the link every time you post it.

Only `utm_source` is used. One parameter answers the only question worth asking here, which is
where somebody came from. `utm_medium` and `utm_campaign` split the same visits across more rows
without saying anything new at this size, and every extra field is another chance to spell it
differently.

The values, lowercase, no spaces, and no others without adding them here first:

| `utm_source` | Where the link went |
| --- | --- |
| `reddit` | Any subreddit post or comment |
| `discord` | Any Discord server |
| `youtube` | Video description or pinned comment |
| `twitter` | Twitter/X |
| `bluesky` | Bluesky |

`Reddit`, `reddit` and `r/marvelsnap` are three different rows in that tab, so a link tagged by
hand at posting time is usually a link tagged wrong. Copy them from here:

```
<site>/?utm_source=reddit
<site>/leaderboard?utm_source=reddit
<site>/leaderboard/movers?utm_source=reddit
<site>/decks/builder?utm_source=reddit
<site>/stats/tracker?utm_source=reddit
```

Two things the tab will not tell you. The tag lands on the page somebody opened, so tag the page
you are actually linking to and not the home page, or every source looks like it arrived at `/`.
And the tag rides along when a visitor copies the address bar and shares it somewhere else, so a
source can collect visits it did not send. Treat the numbers as rough shares, not counts.

## Game news

`/news` carries balance updates and patches, as opposed to `/changelog`, which is changes to this
site. An admin writes them from a form on the page; they are rows in `news`, not a file in the
repo, because balance updates land every couple of weeks and a change that needs a commit and a
deploy each time is a change that stops being made.

An item is a short summary in the poster's own words plus a link to the official post.
Reproducing Second Dinner's notes in full would be someone else's writing republished wholesale,
and the link is what a reader wants from it anyway.

Nothing is fetched. Whether either official site exposes a usable feed has never been checked
against the real thing, and writing a parser for a response nobody has seen is how `parse-game.ts`
ended up untested. If a feed turns out to exist, the list can be filled from it later; the table
does not change.

Bodies are stored and rendered as text, never markup, and a source link has to parse as `http` or
`https` before it reaches an `href`, so a mistaken paste is a rejected form rather than a live link.

## Claiming a profile

A signed-in person can say a leaderboard row is them. Nothing on the board can check that, so an
unproved claim is shown only to the claimant and admins. Other visitors receive no pending
claim data, including in the page's Client Component props.

It goes public only after an admin confirms it. Tracker-reported names are client-controlled and
not unique, so a matching name is supporting evidence, never automatic ownership verification.
Earlier tracker-confirmed claims are treated as pending on every read until an admin confirms
them; their stored records are preserved. Admin-confirmed claims remain public. The browser
receives only the display name and confirmation date, not internal account IDs or claim dates.

One account holds one profile. Two rows for one player means a rename was missed, and the fix is
a merge rather than a second claim.

## Moderation

Sign in, then read your own Discord id off My stats; `ADMIN_DISCORD_IDS` wants exactly that value,
and the site already knows it, so there is no reason to go hunting in Discord's developer mode.

Admins are named in `ADMIN_DISCORD_IDS` rather than flagged in the database: there is no bootstrap
problem, nobody can grant it to themselves by reaching the database, and removing it is a redeploy.
An admin sees rename and delete on a deck page, and on a player profile can merge another player in
or drop a former-name record that a rename got wrong. Rename is there because when a deck's name is the
problem the twelve cards usually are not, and taking somebody's deck away over a word is heavier
than fixing the word. `isAdmin` is checked in the route handler on every call; hiding the buttons
is convenience, not the boundary.

Merging two player rows is on the profile page for an admin, and also available as
`npm run merge-players` for anyone with a checkout. Both preview first and apply second: the
browser version shows the same plan the dry run prints and asks to confirm. The plan is never
taken from the caller; it is worked out again on the server immediately before applying, so the
safety check runs against the database as it is rather than as it was when previewed.

## Renames

The board has no player IDs, so someone changing their name reads as one player vanishing and a
brand new one appearing with no history. `detectRenames` in `src/lib/leaderboard/match.ts` pairs a
departure with an arrival holding the **exact same score** in the same snapshot, and only when
exactly one of each carries that score. The player keeps their row and their history, and the old
name goes in `player_names`, which the leaderboard reads for a "new name" tag and the profile lists
in full.

Both sides are also checked against the whole board: the departing name has to have left it, and the
arriving name has to be new to the season.

That was not enough on its own. A name is only evidence of who somebody is while one person holds
it, so a name **more than one player has used this season**, counting names they have since renamed
away from, is refused on both sides whether or not it is on the board at the time. Only a few
players carry the default name at once and they churn, so it drops off the board completely on a
regular basis, and in that tick one of them leaving looked exactly like the sole owner of a unique
name walking away. It is a count of one against more than one, with nothing to tune.

The cost is that somebody renaming away from a shared default name is never recognised. There is no
way to tell which of them left, so the alternative is guessing between strangers.

The API gives three fields per entry and nothing else: `rank`, `playerName`, `score`. The
envelope reports `offset`, `limit` and a `total` in the tens of thousands, but `offset` is
ignored, so the top 1000 is a ceiling rather than a page size.

**Churn at the cut line**, which used to be an open gap, is handled by the same logic. A player
pushed off the bottom and a different player entering it are the same two events as a rename, so
a departure now has to clear the cut by more than the worst score loss the season has shown. A
stored score is only the last sighting: somebody who lost cubes and fell under the cut in the
same gap still looks like they are above it, while a player the board would have kept did not
leave at all. That figure is read from the site's own history rather than fixed.

Both halves of the evidence are real. `src/lib/leaderboard/fixtures/board-scores.json` holds the
score curve of an actual board and the score changes seen on it over half an hour, and
`ingest.stress.test.ts` replays a season from them. On that replay the rule takes invented
renames from 18 to 2 across eight runs, and real renames caught from 85% to 66%. The trade is
deliberate: a wrong pairing joins two strangers' histories permanently, a missed one costs a tag.

Deliberately conservative: a wrong pairing welds two real players' histories together, and that is
worse than missing one. It will not catch a rename by someone who played between snapshots, because
their score moved.

For the ones it misses, and for rows that split before this existed, `npm run merge-players --
--keep <id> --absorb <id>` prints what it would do and changes nothing until `--apply`. It refuses
outright when the two players ever held a rank in the same snapshot, since one person cannot be in
two places on one board. Locally the dev server has to be stopped first, because PGlite allows one
process at a time.

## Snapshots and the turn of the month

The workflow runs every 10 minutes rather than every 30, because a rename is only visible while
the player's score sits still: a shorter gap catches more of them and leaves coincidence less room
to look like one. A replay across eight seeds put detection at 48% hourly, 66% half-hourly and 81%
at ten minutes.

Only the current month is fetched on every run. The previous month cannot change, so it is fetched
once after it has ended and then marked `season_closed:<season>:<region>` in `meta` and never asked
for again. Until that one fetch succeeds it keeps being retried, so a site that was asleep over the
turn of the month still captures the finished board.

The old month is closed only once the new one has a board of its own. Nothing here knows whether
the official leaderboard freezes a month exactly at UTC midnight, and waiting out a guessed settling
period would be inventing a number, so it waits for proof instead: the moment anybody has reached
Infinite in the new month, the old one is over. That costs a few extra fetches on the first of the
month and nothing after it.

A rename that happens while a player is off the board, or across the turn of the month, cannot be
detected at all: in a new season everyone is an arrival and there are no departures to pair them
with. Those surface as a duplicate player and are fixed with the admin merge.

## Starting the leaderboard over

`scripts/reset-leaderboard.sql` clears every player, standing, point change and snapshot, and is run
by hand in the Supabase SQL editor. Accounts, decks, tracker keys and tracked games are untouched;
nothing outside the leaderboard has a foreign key to `players`, and
`src/lib/leaderboard/reset.test.ts` asserts that rather than trusting it.

Deploy before running it, or an ingest that still writes bad rows simply starts again on clean
tables. Afterwards, kick the workflow from Actions rather than waiting for the next run. The
standings come back from the official API; the point history does not, because the API serves the
board as it stands and not how it moved, so Movers stays empty until new snapshots pile up.

## What a tracker knows about names

A tracker key is identified by its token, not by a name, so two players called the same thing
never collide; the key's `account_id` is the Discord account it belongs to, which is what makes
stats follow a person between browsers. Display names only matter on the leaderboard, which has
no player IDs at all.

That makes the tracker the one place a rename can be seen directly rather than inferred. Every
upload records the uploader's own display name against their Snap account in `snap_names`, so an
account playing under one name and later another is a rename with dates on it.

It is evidence, not proof, and it is never applied on its own. A game file comes from the
player's own machine and the Snap account id travels in a header the uploader sets, so anyone
with a key could describe an account that is not theirs, including one they know only from
having played against them. An admin sees it on the player profile beside the merge and rename
controls, and decides.

## Accounts

Sign-in is Discord OAuth, hand-rolled in `src/lib/auth/` rather than pulled in, for the same reason the
zip writer is: it is a small amount of well-specified code and this project carries no auth dependency.
The authorization code flow uses PKCE and a `state` value, both kept in a ten-minute `HttpOnly` cookie
rather than a table, so an abandoned sign-in leaves nothing to clean up. Only `identify` scope is asked
for: an id, a username and an avatar. No email.

Sessions are opaque tokens in an `HttpOnly` cookie, stored as a sha256 hash exactly the way tracker keys
are, so the table is useless to anyone who reads it and a session is revoked by deleting a row.

Decks belong to whoever posted them while signed in, and to nobody otherwise. Only a signed-in deck can be
listed on the Decks page; a signed-out one is saved unlisted and shared by link. Dedupe is per poster, so two
people sharing the same twelve cards under the same name each get their own deck rather than the second
silently landing on the first one's; `nulls not distinct` keeps signed-out posts collapsing as they always
did. Deleting an account leaves its decks standing and only removes the byline.

A tracker key stays the upload credential; an account only groups keys for viewing. A key made while
signed in lands on the account; one made earlier is added from My stats, proved by holding the key. Stats
then add up across every key on the account, which is what makes them follow you between devices. A key
already on another account is refused rather than moved, and deleting an account releases its keys instead
of destroying the games.

Linking checks ownership atomically, so simultaneous requests cannot move a key between accounts.
Community stats count contributing tracker keys, not unique players; one person can use several keys.

Sign-in runs on one address, `canonicalOrigin` in `src/lib/site-origin.ts`, rather than whichever hostname
the visitor arrived at. Discord matches a redirect literally, so a site answering on both an apex and a
`www` name, or on Vercel's per-deployment hostnames, would only ever have one of them registered. Cookies
are scoped to a hostname too, so two working names would mean two parallel sign-ins on one site. A
sign-in that starts elsewhere is moved to that address first, once, before its state cookie is set.

Set `DISCORD_AUTHORIZE_URL`, `DISCORD_TOKEN_URL` and `DISCORD_USER_URL` to walk the whole flow against a
stub locally without a Discord app. They are unset in production.

## Stats tracker

`public/tracker/snaphub-tracker.ps1` is a PowerShell script (Windows PowerShell 5.1 or later) that watches
`%USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod\GameState.json`. When a game finishes
it gzips the file and posts it to `/api/tracker/games` with the player's tracker key. The server parses it
(`src/lib/stats/parse-game.ts`), keeps a summary, and discards the raw file. Setup instructions for players are
on `/stats/tracker`.

Upload deduplication hashes the local Snap account ID resolved by the parser, including the ID in the
game file when the account header is absent or does not match a player. Only files with no usable
account ID fall back to deduplication per tracker key. Existing stored hashes are not rewritten.

Players don't run the script by hand. `/api/tracker/download` returns a zip holding the script, a
`Start Snap Hub Tracker.cmd` that already carries the site address and their key, and a readme, so setup is
download, unzip, double-click. The zip is built by `src/lib/tracker/zip.ts` (stored entries, no dependency) and
the route reads the script off disk, which is why `next.config.ts` lists it under `outputFileTracingIncludes`.
The launcher holds a live key, so the readme says not to pass the folder on.

Limits worth knowing:

- **PC only**, and only games that finish while the tracker is running (the game keeps just the last game on disk).
- **The parser has not yet seen a real game file.** Field paths follow the map published by the open-source Marvel
  Snap Tracker, and the tests use a synthetic file shaped from it. If a game won't record, run the tracker with
  `-SaveRaw`; it keeps a copy in `%APPDATA%\SnapHub\raw` to add as a test fixture.
- Win rate = wins ÷ (wins + losses). Cube rate = average net cubes per game. Decks sharing 9+ of 12 cards form one
  archetype, named after its two most distinctive cards.

## How the leaderboard data works

Source: `https://marvelsnap.com/wp-json/api/v1/leaderboard?month=9&year=2026&region=global`. As of September 2026:

- Only the **current and previous month** are served, so saving snapshots is the only way to keep history.
- Only the **top 1000**; paging parameters are ignored.
- Only `region=global` works. The others return a server error. Regions listed in `LEADERBOARD_REGIONS` are tried,
  and region tabs appear once one has data.
- **No player IDs**, and names repeat. Players are matched by name, and same-named players are paired by closest
  score. Two with nearly identical scores can occasionally swap; they're marked "dup".

History rows are written only when points change, a player enters or leaves the board, or their rank drifts and
the last row is over 6 hours old.

Cards come from Marvel Snap Zone's card list, checked hourly by the independent reference workflow; alternate-mode cards are hidden from the
builder (`isDeckable` in `src/lib/cards/sync.ts`). Deck codes export as base64 of
`{"Name":"…","Cards":[{"CardDefId":"AntMan"},…]}`.

## Private account decks and browser checks

The builder offers browser-only saves and signed-in private account drafts (1–12 cards). Private
drafts live in `account_decks`, separate from public/unlisted shares. Every private API operation
requires a session and scopes its query to that account. Deleting an account removes its private
drafts. Sharing creates a separate public or unlisted copy; updating a draft does not change that copy.

Tracker setup checks only the key held by the browser and reports its last successful upload. It
does not claim to detect a running tracker. Leaderboard freshness uses a per-season, per-region
successful source check, including unchanged responses; failures never advance it. After 30 minutes
(three scheduled checks), the UI labels updates delayed. Archived seasons are labeled separately.

Run `npm run build`, `npx playwright install chromium`, then `npm run test:e2e` for desktop/mobile
browser tests. The runner creates a fresh `.data/e2e-*` database and a local Discord stub, using ports
3101 and 3102. It never uses production credentials or writes to production. CI runs these tests and
retains failure screenshots/traces for seven days. Unit tests remain `npm test`.

## Brand

The current identity follows the supplied Jade League rebrand guide: cream as the primary surface, jade actions and forest text,
with Manrope headings, Inter body text and a custom vector wordmark. Its angular SNAP lettering and centered HUB line
share fixed geometry, so font loading and letter spacing cannot shift the header logo. `src/lib/brand.ts` owns the vector geometry;
`node scripts/build-brand.mjs` regenerates the SVG exports. Next renders social and Apple icons
from that same geometry. The previous raster brand sheet is historical, not the current source.

Cream is the default theme. The sun/moon button beside the header search switches to a forest dark theme;
`snaphub:theme` in local storage remembers the choice and keeps other tabs in sync. A small inline script applies
the saved palette before the body paints. Theme tokens also adapt native controls, focus borders and the wordmark;
the standalone SVG export and share images retain their cream-palette branding.

## Credits

[MARVEL SNAP’s official Help Center](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/) and
[official announcements](https://marvelsnap.com/category/events/) inform the wiki’s authored rules and
game-mode summaries. Sections link to their sources and show a manual review date.

[SnapVault location statistics](https://www.snapvault.app/locations) supply observed appearance rates: the share of tracked Ranked and Conquest games containing a location over the source’s last 30 days. The wiki shows numerator, sample size and source, refreshes hourly on view, and hides the field if a location has no valid statistics or the source fails. These rates can include location-changing effects and featured events; they are not base spawn probabilities. The read-only adapter uses public page data, exact game IDs and validated counts, independently of canonical reference imports.


Snap Hub is built on other people's work. The full list, with links, is on the site at `/credits`
(`src/lib/credits.ts`). None of the community projects' code is copied; they showed what data exists and how it's
shaped.

- **Inspiration**: [Better Snap Leaderboard](https://github.com/JaydenScottL/bettersnaplb) by JaydenScottL,
  [Untapped.gg](https://snap.untapped.gg) stats, [Marvel Snap Zone deck builder](https://marvelsnapzone.com/deck-builder/)
- **Data**: the official [MARVEL SNAP Infinite leaderboard](https://marvelsnap.com/infiniteleaderboard/) (Second
  Dinner / Nuverse); card, location and variant data and art from [Marvel Snap Zone](https://marvelsnapzone.com/cards/);
  the [MARVEL SNAP Help Center](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/) and
  [official patch notes](https://marvelsnap.com/news/) (Second Dinner); location rates from
  [SnapVault](https://www.snapvault.app/locations); card history from [SNAP.FAN](https://snap.fan/cards/history/2026/)
- **Research**: [Marvel Snap Tracker](https://github.com/Razviar/marvelsnaptracker) (game-file field map),
  [Helper for Marvel Snap](https://github.com/johnvictorfs/helper-for-marvel-snap),
  [snapscripts](https://github.com/snaptools2023/snapscripts), [Snap Extract](https://github.com/switchfire6/snap-extract),
  [marvelsnapdeck](https://github.com/barkingloudly/marvelsnapdeck),
  [marvel-snap-deckstrings](https://github.com/9j/marvel-snap-deckstrings), [DeckCodes.chat](https://deckcodes.chat/about)
- **Built with**: Next.js, React, Tailwind CSS, PGlite, postgres.js, parse5, Vitest, Playwright, jsdom, Manrope and
  Inter (Google Fonts); hosted on Vercel, Supabase and GitHub Actions, with Vercel Web Analytics; sign-in through Discord
- **Made with AI**: code written with [Claude Code](https://claude.com/claude-code) (Anthropic); logo, brand sheet, the
  Jade League visual overhaul and parts of the wiki made with ChatGPT (OpenAI)

## Project layout

The wiki home links to `/wiki/variants`, `/wiki/basics`, `/wiki/game-modes`,
`/wiki/terminology` and `/wiki/collection`. Guide content lives in `src/lib/wiki/guides.ts`;
review dates describe manual editorial checks, not the hourly reference import.
The variant browser reads the existing card JSONB catalog, paginates on the server and filters
artist credits across sketch, ink and color. Released variants are the default; previews require
the explicit unreleased filter. Source categories are preserved without inventing variant names.
`/search` searches released cards/locations/variants, guide sections, player names and listed public
decks. Private drafts and unlisted decks are excluded. No database migration or new feed is needed.

```
src/lib/db/            connection (PGlite or Postgres) and schema
src/lib/leaderboard/   fetch, name matching, snapshot ingest, queries
src/lib/cards/         card sync and queries
src/lib/decks/         deck code encode/decode, saved decks
src/lib/stats/         game-file parser, tracker keys and uploads, stat math, queries
src/app/api/           cron snapshot, decks, tracker endpoints
public/tracker/        the PC tracker script
.github/workflows/     10-minute snapshot job, hourly reference sync, CI
```

Fan-made and non-commercial; not affiliated with or endorsed by Marvel, Second Dinner or Nuverse. MARVEL SNAP, Marvel
characters and card art belong to their owners.

### Automatically updated card and location wiki

`/wiki` uses the same canonical card rows as the builder and stats. Marvel Snap Zone's public
card and location feeds are checked independently of leaderboard snapshots by
`.github/workflows/reference.yml` at 17 minutes past each hour. It uses the existing `SITE_URL`
and `CRON_SECRET` repository secrets; both must match the deployed production environment.
After deployment, run **Reference database sync** once from Actions to seed the library.
`GET /api/cron/reference` requires the cron bearer token in production. Partial failures return
503 so Actions fails visibly; the successful collection can still update. Workflow failures use
GitHub's normal notification settings. Monitor that workflow; schedules may be delayed or
paused by GitHub after 60 days without repository activity.

Imports validate the whole collection, reject duplicate IDs, missing previously released IDs and malformed records,
then transact data and history together. Removed released IDs require source investigation before the
baseline is deliberately changed. No scheduled job deletes historical reference entries.
Conditional Last-Modified requests reduce transfer; transient transport/server failures receive
one bounded retry. Last attempt, successful check, content change and failure are stored separately.
The wiki warns after three hours without success (or immediately after a failed import).
Upstream publication time plus scheduler delay determines patch freshness; this is not an official
real-time game API. Datamined/unreleased entries are hidden from the public reference and builder.
History starts at the initial baseline, records observed name/stat/effect changes, and makes no
claim to be a complete historical patch archive. Authored strategy guides are reviewed separately.

Data credit: [Marvel Snap Zone locations](https://marvelsnapzone.com/locations/), including
source-reported rarity categories (not inferred spawn percentages). The Jade League rebrand applies the jade/forest/cream identity, Manrope headings and Inter body text.

### Jade League visual identity

The September 2026 rebrand follows the supplied Snap Hub guide: jade `#36D6A0`, forest
`#102D29`, cream `#F3F2E9`, surface `#19413A`, muted `#A8D0B5`. Manrope headings and
Inter body text are self-hosted through Next's font loader. Shared tokens live in `globals.css`;
semantic rank, win/loss and chart colors remain distinct. The hand-and-card SVG is a scalable
adaptation of the supplied reference sheet, not an extracted original vector master.
`src/lib/brand.ts` supplies `components/brand.tsx`; run `node scripts/build-brand.mjs`
to update `public/brand/emblem.svg`, `public/brand/wordmark.svg` and `app/icon.svg` from that same geometry. The header pairs
the emblem with outlined SNAP/HUB lettering and jade dividers. App icons and social previews replace the previous gauntlet identity.

Pointer tilt is restricted to featured artwork with a fine mouse pointer. It updates at most
once per animation frame, resets on exit or cancellation, and responds immediately when reduced
motion is enabled. Dense galleries use a small hover lift; figures and effect text stay still.
Touch uses the same controls with visible focus/selection states. No animation runs continuously.


### Card variants

The existing Marvel Snap Zone card envelope includes variants under each exact card ID.
Hourly imports persist a validated JSONB catalog on the card row, including artwork URLs,
release status, rarity, named artist roles, collector quality and known source dates.
The wiki reads that local catalog; no extra source request is required to open a gallery.
Unreleased previews are collapsed separately. No category names are inferred from artwork,
and placeholder dates remain unknown. Credits link to the [variant database](https://marvelsnapzone.com/variants/).
Existing rows start with a NULL catalog, which forces one unconditional import to backfill
variants even when the upstream Last-Modified value has not changed. Subsequent imports
resume conditional requests. Cosmetic updates do not create card balance-history records.

### Official patch index and reference imports

The wiki links cards and locations to historical mentions in official MARVEL SNAP articles.
This index is not a complete balance timeline: articles can mention a card in commentary or bug fixes,
and matching uses current names, so older names and missing sitemap articles can be missed.
Dates are only assigned when an explicit date/year is present in the title or URL.
Current imported stats remain separate from this historical index.

Data credits: [official MARVEL SNAP news](https://marvelsnap.com/news/),
[SNAP.FAN card history](https://snap.fan/cards/history/2026/) and
[Marvel Snap Zone history](https://marvelsnapzone.com/card-history/?past=all).
SNAP.FAN card-history tables are fetched on demand and cached for 24 hours. Only validated dates, numeric stats, and plain-text descriptions are rendered with [parse5](https://github.com/inikulin/parse5) (MIT); no source HTML is rendered. Failed or changed source pages show an unavailable state without failing the current reference. Marvel Snap Zone history is an external research link.
Rebuild the checked-in official index with
`node scripts/index-official-patches.mjs <cards-feed.json> <locations-feed.json>`
using complete downloaded canonical source envelopes. A failed download leaves the previous index intact.
No article bodies are redistributed. The page displays its indexing date.

Reference bulk writes cast serialized JSON through text before jsonb to avoid double encoding in
postgres.js. CI runs the reference sync suite against PostgreSQL 17 as well as PGlite.
The hourly reference workflow reports per-source failure categories and retains the last good data.

### Artist discovery, personal collections and learning guides

The wiki homepage rotates deterministic daily card, location and artist spotlights (UTC).
Artist pages aggregate exact credited names across sketch, ink and color; one artwork counts
once per artist even when several roles are credited. Names are source credits, not verified
identities or biographies. Galleries retain explicit released/preview filters and pagination.
Two selected variants can be compared side by side; the selection persists in sessionStorage
across filtering and reloads. Comparison URLs contain only public catalog identifiers.

Discord accounts can manually mark variants Owned or Wanted. This is a checklist, not an
in-game inventory sync. The owner always comes from the server session. Previews may be Wanted,
but cannot be newly marked Owned. Removed source items remain removable from saved lists.
The idempotent runtime schema adds account_variants and wishlist_shares; no manual migration
or new service is required. Restart the server after local schema edits.

Collections are private. Sharing is explicitly enabled, exposing only the account display name
and current Wanted list through an unguessable URL. No Owned list or account identifier is
returned. Pages and APIs are dynamic; private API responses use no-store, and wishlist pages
are noindex and excluded from the sitemap. Disabling sharing deletes the token; enabling again
creates a new one. Collection and sharing mutations check Origin when supplied.

Six editorial archetype guides explain core roles, phased plans, substitutions and common
mistakes. They show live imported card text and do not claim current competitive rankings.
Guides are manually reviewed and dated.
Related references use shared mechanic wording, not inferred synergies. Public artists and
learning pages appear in search and the sitemap; private lists never do.

Sources remain the existing [Marvel Snap Zone catalog](https://marvelsnapzone.com/cards/),
[official Help Center](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/) and
[Second Dinner's Activate guide](https://marvelsnap.com/our-first-brand-new-ability-activate/).
Collection isolation, catalog changes and share-token revocation are tested against PGlite
and PostgreSQL in CI. Browser tests cover the public discovery and signed-in sharing flows
at desktop/mobile sizes.
