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
   - `TRACKER_INVITE_CODE` (optional): a code people must enter to make a tracker key
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
unproved claim is shown to the claimant and to nobody else: saying you are the rank one player
gets you a line on your own screen and nothing more.

It goes public once something vouches for it. A tracker key on the same account that has reported
playing under that name clears it on the spot, and an admin can clear any of them by hand. That
bar is not cryptographic, since a game file comes from the player's own machine; it raises the
cost, and an admin can remove any claim.

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

Decks belong to whoever posted them while signed in, and to nobody otherwise. Dedupe is per poster, so two
people sharing the same twelve cards under the same name each get their own deck rather than the second
silently landing on the first one's; `nulls not distinct` keeps signed-out posts collapsing as they always
did. Deleting an account leaves its decks standing and only removes the byline.

A tracker key stays the upload credential; an account only groups keys for viewing. A key made while
signed in lands on the account; one made earlier is added from My stats, proved by holding the key. Stats
then add up across every key on the account, which is what makes them follow you between devices. A key
already on another account is refused rather than moved, and deleting an account releases its keys instead
of destroying the games.

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

Cards come from Marvel Snap Zone's card list, synced every 12 hours; alternate-mode cards are hidden from the
builder (`isDeckable` in `src/lib/cards/sync.ts`). Deck codes export as base64 of
`{"Name":"…","Cards":[{"CardDefId":"AntMan"},…]}`.

## Brand

Colors, fonts (Montserrat, Orbitron) and logos come from `brand/brand-sheet.png`. `node scripts/build-brand.mjs`
cuts the icon, wordmark, banner, favicon and link-preview image out of it. If you get full-size logo files, drop
them into `public/brand/` instead.

## Credits

Snap Hub is built on other people's work. The full list, with links, is on the site at `/credits`
(`src/lib/credits.ts`). None of the community projects' code is copied; they showed what data exists and how it's
shaped.

- **Inspiration**: [Better Snap Leaderboard](https://github.com/JaydenScottL/bettersnaplb) by JaydenScottL,
  [Untapped.gg](https://snap.untapped.gg) stats, [Marvel Snap Zone deck builder](https://marvelsnapzone.com/deck-builder/)
- **Data**: the official [MARVEL SNAP Infinite leaderboard](https://marvelsnap.com/infiniteleaderboard/) (Second
  Dinner / Nuverse); card data and art from [Marvel Snap Zone](https://marvelsnapzone.com/cards/)
- **Research**: [Marvel Snap Tracker](https://github.com/Razviar/marvelsnaptracker) (game-file field map),
  [Helper for Marvel Snap](https://github.com/johnvictorfs/helper-for-marvel-snap),
  [snapscripts](https://github.com/snaptools2023/snapscripts), [Snap Extract](https://github.com/switchfire6/snap-extract),
  [marvelsnapdeck](https://github.com/barkingloudly/marvelsnapdeck),
  [marvel-snap-deckstrings](https://github.com/9j/marvel-snap-deckstrings), [DeckCodes.chat](https://deckcodes.chat/about)
- **Built with**: Next.js, React, Tailwind CSS, PGlite, postgres.js, sharp, Vitest, Montserrat and Orbitron (Google
  Fonts); hosted on Vercel, Supabase and GitHub Actions
- **Made with AI**: code written with [Claude Code](https://claude.com/claude-code) (Anthropic); logo and brand sheet
  generated with ChatGPT (OpenAI)

## Project layout

```
src/lib/db/            connection (PGlite or Postgres) and schema
src/lib/leaderboard/   fetch, name matching, snapshot ingest, queries
src/lib/cards/         card sync and queries
src/lib/decks/         deck code encode/decode, saved decks
src/lib/stats/         game-file parser, tracker keys and uploads, stat math, queries
src/app/api/           cron snapshot, decks, tracker endpoints
public/tracker/        the PC tracker script
.github/workflows/     30-minute snapshot job
```

Fan-made and non-commercial; not affiliated with or endorsed by Marvel, Second Dinner or Nuverse. MARVEL SNAP, Marvel
characters and card art belong to their owners.
