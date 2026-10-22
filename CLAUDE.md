@AGENTS.md

# Snap Hub notes

- Private account drafts use `account_decks`, never `decks`. Keep every read/update/delete scoped to
  the session account; unlisted public decks remain accessible by link. Public sharing is an explicit copy.
- `board_checked:<season>:<region>` records only successful source checks, including unchanged boards.
  Read its explicit `updated_at` timestamp, never `value.at`: JSONB may contain a string whose `.at` is a function.
  Do not use the last changed snapshot or the overall cron timestamp to claim a board is fresh.
- Browser CI runs Playwright against a fresh local PGlite database and a test-only Discord stub.
  Ports 3101/3102 are reserved for that runner. No test authentication bypass belongs in production routes.

- Dev server runs on port 3100 (`npm run dev`); port 3000 is used by another app on this machine.
- No `DATABASE_URL` locally → PGlite in `.data/pglite`. PGlite is single-process: don't run scripts that open
  the database while the dev server is running; hit `/api/cron/snapshot` instead (`npm run snapshot`).
- Production uses postgres.js. Array parameters must go through `toPgParam` (already done in `src/lib/db`),
  and every array parameter in SQL needs an explicit cast like `$1::int[]`.
- To test the postgres.js path: start a PGlite socket server and run
  `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:<port>/postgres npm test`.
- Leaderboard API quirks (top 1000 only, current/previous month only, only `global` works, no player IDs) are
  documented in README.md. Read it before changing ingest or matching.
- Card ability text contains `<span>Keyword</span>` markers. Render with `AbilityText`, never as HTML.
- The schema is applied when the DB connection opens, so restart the dev server after changing `schema.ts`.
- Stats tracker: `public/tracker/snaphub-tracker.ps1` must stay plain ASCII (Windows PowerShell 5.1 reads BOM-less
  scripts as ANSI). Test it end to end with a fake nvprod folder and `-Once -StateDir ... -ConfigDir ...`.
- `parse-game.ts` is checked against a real GameState.json, anonymised, at
  `src/lib/stats/fixtures/real-game.json` (every GUID swapped for a stable fake, three display
  names replaced, byte-order mark kept because real files carry one). It disagreed with the
  synthetic fixtures on two counts, so trust the fixture over any field map: the end-of-game
  board is `GameState._locations[i]._cards` with each card's `Owner` pointing back at a player,
  not a `_to` array with `_player1Cards`/`_player2Cards`, and a location carries its own
  `LocationDefId` (`LocationDefIdsAtEndOfGame` is only the fallback). Who is local comes from
  `RemoteGame.ClientPlayerInfo.AccountId` inside the file; the `X-Snap-Account-Id` header is an
  override, not a requirement, because without one the old fallback silently reported the
  uploader as their own opponent.
- There is a second real file now, `fixtures/real-retreat.json`, anonymised the same way (35
  GUIDs, three names, BOM kept, confirmed to parse identically to the original). It is the
  opposite corner from `real-game.json`: a turn-one retreat, so it is the only coverage of
  `conceded`, of a board that is empty at every location, of locations that were never
  revealed, and of the uploader sitting in the second slot behind a `$ref`. It is also the
  real version of the empty-board identity case: with nothing naming the client, the
  deck-overlap guess has no signal, ties to slot 0 and really does report the uploader as
  their own opponent, which is why no account id may be derived from it. Locations arrive as
  `$ref` entries in both of these files even though `real-game.json` has them inline, so never
  assume a shape without dereferencing.
- `/api/tracker/download` reads `public/tracker/snaphub-tracker.ps1` off disk at request time. Next.js can't infer
  that, so it's listed in `outputFileTracingIncludes`; moving or renaming the script means updating both.
- Sign-in needs `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; without them `discordConfig()` returns null
  and the header hides the button. Discord matches the redirect URL literally, so OAuth uses
  `canonicalOrigin` (`SITE_URL`, else Vercel's production domain, else the request) rather than the host the
  visitor arrived on, and a sign-in starting elsewhere is moved there first. Register exactly one redirect.
- `SiteHeader` reads the session on every request on purpose. Skipping that read when Discord looks
  unconfigured let statically rendered pages bake a signed-out header in at build time; any page showing
  per-visitor state has to render per request.
- The deck dedupe index has changed three times: `(card_key, name)`, then `+ listed`, now `+ owner_id` with
  `nulls not distinct`. Adding another concept to a deck almost certainly means touching it again, and the
  matching `on conflict` target in `saveDeck` with it.
- With no `DATABASE_URL`, PGlite wants a writable directory and a serverless box has none, so
  `pgliteDir()` falls back to `memory://` and warns rather than dying on the mkdir. That is what
  keeps a preview deployment standing once `DATABASE_URL` is scoped to Production only. Do not
  make it silent: an empty database is a misconfiguration, not a mode.
- `accounts` must stay above `decks` and `trackers` in `schema.ts`; both carry a foreign key to it and the
  whole file runs top to bottom on connect.
- `detectRenames` only pairs a departure and an arrival on an **exact** score match, unique on both
  sides, only when the departing name has left the board and the arriving name is new to the season,
  and **never when more than one player has held that name this season** (`sharedNames` in
  `ingest.ts`, counting former names too, plus any name twice on the current board). None of it is
  optional. Checking only the current board was tried and was not enough: a handful of players carry
  the default name at a time and they churn, so it leaves the board outright every so often, and in
  that tick one of them going looked exactly like the single owner of a unique name walking away.
  The count is one or more than one, so there is no threshold to tune. The cost is that a rename
  away from a shared default name is never recognised, which is unavoidable: nothing says which of
  them left. Loosening any of this trades missed renames for merged strangers, which is
  unrecoverable once the histories are joined; widen it only against real board data.
- The cut-line hole in rename detection is closed, and `ingest.stress.test.ts` is no longer
  pinned. A departure now has to clear the cut by more than the worst score loss the season has
  actually shown (`largestDrop` in `ingest.ts`, read from `history`, not a constant). A stored
  score is the last sighting, so somebody who lost cubes and fell off the bottom in the same gap
  still reads as being above the line; discounting by a real loss separates them from a player
  the board would have kept, who therefore did not leave but renamed.
  Measured on `fixtures/board-scores.json`, which carries the score curve of a real board and the
  score changes really seen on it over half an hour: phantoms fell from 18 to 2 across eight
  runs, and real renames caught fell from 85% to 66%. That direction is deliberate, because a
  wrong pairing welds two strangers together for good and a missed one costs a tag.
  Two rules were tried and rejected on measurement, not taste, so do not re-propose them:
  requiring the score to be one no other player holds (all 10 phantoms gone but 27 of 30 real
  renames with them), and requiring only that the departure be above the cut with no discount
  (one phantom prevented in 248 renames, which is noise).
- The board API returns exactly `rank`, `playerName` and `score` per entry, confirmed against a
  real response; there is no identity field to lean on. The envelope carries `offset`, `limit`
  and `total` (about 48k players at Infinite), but `offset` is ignored: asking for 1000 returns
  the top of the board again, so the top 1000 really is a hard ceiling.
- `fetchBoard` checks every row (an integer rank of 0 or more, a string name, an integer score)
  and fails the whole board on a single bad one. It used to drop bad rows, which is not harmless:
  a dropped player reads as a departure, departures are what rename detection pairs, and a board
  whose every row was bad came back as an empty success that marked everybody gone while
  `board_checked` kept the monitor green. Rank was never checked, and a string rank `"10"` was
  stored as 101. A failed board keeps the last good one and the snapshot route answers 503. If
  the source ever sends a bad row routinely, the board stalls and the monitor says so: read the
  `detail` before loosening this, and never go back to dropping rows quietly. `ingestBoard`
  refuses an empty list for the same reason.
- The official board sometimes sends its lower part from an old copy: seven times from 10 to 14
  October 2026, the bottom 100 to 900 rows in whole blocks of 100, each put right by the next run
  12 to 34 minutes later (measured in Supabase from `history`; no rename was recorded at any of
  them). `ingestBoard` holds a board that would remove `SUSPECT_DEPARTURES` (50) or more players
  at once: nothing is written, renames included, `board_checked` does not move, and the run
  reports `held` with 200. A normal board clears the hold; suspect boards that keep arriving for
  `HOLD_MINUTES` (60) from the first one are stored as real. Both numbers come from that data:
  ordinary runs never had more than 17 leave at once and bad ones never fewer than 100, and the
  longest bad spell was 34 minutes, so a real mass change also trips the 30-minute freshness
  alert while it waits. Waiting for two matching boards is not enough, because a bad copy can be
  served twice in a row. The hold's start is the `board_held:<season>:<region>` row's `updated_at`.
  `scripts/cleanup-bad-boards-2026-10.sql` removes what the seven stored before the hold wrote,
  run by hand in Supabase after its read-only `-preview.sql`. A bad run's rows from
  `first_stale_rank` down are stale; a departure there is junk when the player is back at the
  next run; a departure at the next run is junk for a stale player who was off the board before.
  It deletes those, the standings and players only they ever recorded, and rebuilds rank, score
  and times from the remaining history where a bad board wrote them last. It was run in
  production on 16 October 2026: 9,539 history rows and 900 October standings removed, no
  players, and the printed table matched the preview exactly. A second run finds nothing to do.
  `cleanup-bad-boards.test.ts` replays a bad board through `ingestBoard` and checks the preview
  and the cleanup against each other. Its temp tables are dropped as `pg_temp.*`, because a bare
  `drop table if exists` falls through to a permanent table of the same name.
- `runSnapshot` fetches the current month every run and keeps fetching the previous month until
  it marks it `season_closed:<season>:<region>` in `meta`, then never again. The mark is only
  written once the current season has a standings row, which is the proof that the old month is
  really over; do not swap that for a settling delay. `rollover.test.ts` covers the turn of the
  month, the year boundary and a failed fetch being retried.
  The old month is **live**, not Final, until that mark exists (`isSeasonLive` in `queries.ts`).
  On 1 October 2026 the September board was still changing on every run 16 hours past midnight
  UTC while October came back empty, and both pages had labelled it Final by calendar month.
  Checked in Supabase on 21 October 2026, the rule held for September: the board changed 473 to
  728 rows a run all day on 6 October, last at 19:07 UTC plus 16 changes at 20:11, then nothing,
  and the 23:30 run that found October's first standings fetched September unchanged and closed
  it, so the stored final is the official one by 3 hours 20 minutes. That is one month. Check
  October the same way once it closes (its `snapshots` rows, newest first, against the
  `season_closed` row's `updated_at`). A month closed while still moving is recovered by deleting
  its `season_closed` row: the next run fetches it again while the API still serves it.
- Snapshots run every 10 minutes, on Vercel Cron. That cadence was measured, not guessed: detection
  of real renames went 48% hourly to 81% at ten minutes across eight seeds, and phantoms fell.
- Storage, measured 21 October 2026: `history` held 231,333 rows for September (from the 18
  September restart) and 140,714 for October so far; the table was 53 MB and the database 71 MB.
  A season archive that keeps every row forever has to be planned against the Supabase plan's limit.
- `scripts/reset-leaderboard.sql` is the one-way leaderboard wipe, run by hand in Supabase.
  `reset.test.ts` asserts what it clears and what it must leave standing; if a new table gains a
  foreign key to `players`, both the script and that test need it.
- Game news (`/news`, table `news`, `src/lib/news/`) is admin-written rows, not a fetched feed and
  not a file: `src/lib/changelog.ts` is this site's changes, `news` is the game's. The pure parts
  live in `news/types.ts` so the admin form can import them without pulling the database client
  into the browser bundle, the same split as `cards/types.ts`. Bodies render as text, never markup,
  and `cleanSourceUrl` keeps anything that is not http(s) out of an `href`.
- A tracker key's identity is its token, not a name: `trackers.token_hash` is unique and
  `trackers.name` is only a label, so two players sharing a display name never collide.
  `trackers.account_id` is the Discord account the key belongs to, which is what makes stats
  follow a person across devices. `tracked_games.account_hash` is a separate thing again, a
  hash of the Snap account id used for dedupe. Display names matter only on the leaderboard,
  which has no IDs at all.
- Making a tracker key and listing a deck on the Decks page both need a Discord account, checked
  in the routes (`/api/tracker/keys`, `/api/decks`). With neither, a script could flood the public
  deck list (the only guard was an exact duplicate of name and cards) and fake uploads into the
  community stats. Signed out, a deck still saves unlisted and shares by link, and a key a browser
  already holds keeps working. `createTracker` and `saveDeck` stay open on purpose, because tests,
  scripts and the e2e seed call them directly: the rule belongs to the HTTP boundary.
- Deck views are counted from the browser (`CountView` posting to `/api/decks/[id]/view`), once
  per deck per browser through localStorage, and never for the deck's owner. The page render
  used to count, so every refresh and every chat app's link preview added a view. The owner
  test is `$2 is null or owner_id is distinct from $2`, spelled out: the short form reads
  null-is-distinct-from-null on a signed-out view of a signed-out deck, which is false, and the
  route test fails on it. Views rank nothing; if they ever do, this needs server-side dedupe,
  because a script can still call the endpoint.
- `claimTracker` checks ownership inside its UPDATE so simultaneous claims cannot steal a key.
  Upload deduplication hashes the parser's resolved local account ID, including the file fallback;
  a missing or invalid header must not create another identity for the same game.
  Community counts label contributing tracker keys, since keys are not unique players.
- `snap_names` records display names a tracker has seen one Snap account using, which is the
  only direct evidence of a rename the site can get. It is **never applied automatically**: the
  game file is uploaded by its own client and the Snap account id arrives in a header the
  uploader sets, so anyone holding a key could describe an account that is not theirs, including
  one they know only from having played against them. `otherNamesUsedWith` feeds a read-only
  panel an admin sees on a player profile, next to merge, and a person decides. Keep it that way
  unless there is a way to prove account ownership.
- `player_claims` links a Discord account to a player row, one each way. Only an admin may
  confirm it for public display; tracker-reported names are neither unique nor proof of ownership.
  Legacy tracker confirmations are treated as pending by `toClaim`, and admins can confirm them
  through the normal route. `claimForViewer` filters pending claims on the server and returns
  only display fields: never pass a raw claim to a Client Component. The claiming route takes
  the account from the session and never from the request. It carries a foreign key to `players`, so it is in the
  reset script's truncate list and in `rollover.test.ts`'s; a claim does not survive a reset,
  because the row it pointed at does not either.
- `deleteTracker` removes the key's `snap_names` rows too, or "delete every game" left the uploader's
  Snap name, account hash and Discord link behind. `snap_names` has no key column, so a row goes when
  its account hash has no games left under any other key. The tracker page promises this, and lists
  both files the script reads (`GameState.json`, and `AccountState.json` for the account ID only), that
  the whole game file is sent but not stored, and that the script talks to the site and nowhere else.
  Keep the page in step with the script and with what `recordGame` keeps.
  `recordGame` writes the game, its `snap_names` row and the key's `last_upload_at` in one
  transaction. The name used to go first and alone, so a failed game insert left a name that
  `deleteTracker` could never find. `snap_names.games` adds one only for a new game; it added
  one per upload, so retries and a second key sending the same game inflated it, and counts
  stored before that fix stay high because `tracked_games` keeps no name to recount from. The
  parser refuses a `FinalCubeValue` that is not a whole number within a Postgres int as
  `invalid-fields` (422, which the tracker holds) and reads an unstorable turn count as null;
  an int overflow used to reach the insert as a 500, which the tracker retries for ever.
  `TRACKER_REPORT_DISCORD_URL` sets where `-SaveRaw` files are sent; only an https discord.gg or
  discord.com address is shown. Marvel Snap's terms (last updated 2 June 2025, pasted in full by the
  owner on 16 October 2026) list under Code of Conduct, "You may not": "use automated scripts,
  software, code or systems to collect information from or otherwise interact with the Services" and
  "conduct text and data mining (TDM) activities on the Services". The Services include Second
  Dinner's "related websites", so the same clause reaches the leaderboard snapshot of marvelsnap.com,
  and the licence section ("may not be downloaded, copied, reproduced, distributed, transmitted,
  broadcast, displayed ... without our ... prior written consent") reaches the card art served
  through `/art`. No statement from Second Dinner about trackers or fan sites was found, so the
  tracker page quotes the clause and says the tracker is not approved; never write that it is
  allowed without one. The owner emailed Second Dinner on 16 October 2026 to ask whether the site
  is acceptable. Until there is an answer, add no requests to their sites: no shorter cadence, no
  new endpoint, no second routine caller.
- The PC tracker is demoted, by the owner's call on 16 October 2026: no home page card or shortcut,
  Stats sits last in the header and its links say "Experimental, Windows PC only", and the setup
  page says why Windows may warn. Against Untapped.gg and snap.fan, which install as real apps and
  draw an in-match overlay, a PowerShell script started with the execution policy bypassed loses on
  trust and features, and fixing that means a signed app with an overlay, a different project.
  The site's own edge is the leaderboard (the top 1000 every 10 minutes, with history and renames),
  which needs no install. Keep the tracker working for its users; do not promote it again unless
  that changes.
- The name on a tracker key is a label for the key ("Gaming PC"), not a Snap name. The form used
  to say "Display name / Your Snap name", which read as though keys were identified by it.
- A tracker key can upload games, read the stats it recorded and delete itself with every game it
  uploaded, all by the key alone. Nothing else revokes a key: making a new one leaves the old one
  working, which the launcher used to get wrong ("If you share it by mistake, make a new key").
  The launcher, the README in the zip and the setup page all say so, and `download.test.ts` keeps
  the old advice out. If key replacement or revocation without deletion is ever added, change all
  three together.
- Admin is `ADMIN_DISCORD_IDS`, checked with `isAdmin` inside every admin route handler. Hiding a
  control in the UI is not the boundary; if a new admin action appears, it checks server side too.
- Merging players is destructive and one-way, reachable from the profile page as an admin and as
  `npm run merge-players`. Both preview then apply, and both refuse when the two held a rank in the
  same snapshot; keep that check if the merge logic is ever touched. The route re-plans server side
  rather than trusting a plan from the client.
- `src/app/leaderboard/movers/opengraph-image.tsx` draws the share card for Movers at request
  time from the board, cached for 10 minutes to match the snapshot cadence. It deliberately
  loads no font and no image file: Satori takes either, but a disk read there is the trap
  `/api/tracker/download` fell into, where Next cannot see the dependency and it has to be
  listed in `outputFileTracingIncludes`, and a broken unfurl fails quietly. Colours carry the
  brand instead. Render it and look at it after any change; five rows overflowed 630px while
  three looked perfect, and nothing but the picture says so. `clip` cuts long names because
  Satori's `text-overflow: ellipsis` is unreliable.
- `cubeDiscipline` in `stats/aggregate.ts` reads the columns the tracker has always written and
  nothing looked at: `conceded` was inserted on every upload and read by no query at all, and
  `snapped`/`opponent_snapped` were only shown per game. Anything else added to `tracked_games`
  deserves the same check before adding a column for it.
- Small samples use `LOW_SAMPLE` in `stats-ui.tsx`; do not invent a second threshold. The cube
  panel only draws a conclusion when both sides clear it, and says which side is short, because
  somebody who never retreats is exactly who the panel is for and also the slowest to collect
  retreats.
- There are two palettes, cream (`light`) and forest (`dark`), on `html[data-theme]`, with the
  tokens redefined under `:root[data-theme="dark"]` in `globals.css`. Components use the token
  names only, so both palettes follow automatically; never hard-code a palette colour. A saved
  choice (`snaphub:theme` in localStorage) wins; with none, the device's light or dark setting
  decides, and the page follows it live until the visitor picks. The inline script in
  `layout.tsx` sets the attribute before first paint; without it a dark visitor sees a cream
  flash on every load, and `theme.spec.ts` checks it with hydration blocked. That script and
  `themeFor` in `theme-toggle.tsx` must give the same answer. The server always renders `light`,
  which is why `<html>` carries `suppressHydrationWarning`.
- Small samples are tagged on the count (`SmallSample` in `stats-ui.tsx`), in the archetype and
  card tables. Rows used to be faded; the cream palette dropped that for contrast, which left
  greyed rates as the only sign, and those do not stand out when scanning a table.
- Home uses a responsive cream/forest hero, not a raster banner. Keep decorative artwork hidden
  below md and verify 390px screenshots so the mobile hero never crops or pushes content offscreen.
- The current brand guide is `brand/README.md`; `brand/brand-sheet.png` is a historical reference.
  The approved emblem is an angular split card with a transparent lightning cut inside an open jade ring.
  Keep the custom `WORDMARK` geometry unchanged: SNAP lettering, HUB alignment and jade dividers are fixed.
  `src/lib/brand.ts` supplies `src/components/brand.tsx`; regenerate the light/dark emblem exports and app icon
  with `node scripts/build-brand.mjs`, keeping the cut transparent on both palettes. Check the Apple icon
  and home share preview too. Manrope/Inter remain the UI fonts. Pointer effects belong on featured art only,
  never on readable statistics; honor reduced motion and pointer cancellation.
- `/leaderboard?player=<id>` opens the board at that player, and a profile links to it when the
  player is on that season's board. `initialLimit` shows whole pages down to their row and ten
  below it, since the table pages 100 at a time and rank 734 was not on the page at all; the row
  carries `aria-current`, a tint and a left bar (the tint alone was barely darker than hover on
  the forest palette), and it scrolls into view once, centred under the sticky header. It runs
  in the browser on rows the page already sends, so it asks the source for nothing. The table is
  keyed by that id, so moving to another player starts fresh. A player who exists but is not on
  that board gets a notice above the stat tiles: on a phone the tiles fill the first screen, and
  the test passed with the notice out of sight until it checked the viewport.
- The watchlist is browser-only (`snaphub:watchlist`, `lib/leaderboard/watchlist.ts`), so it has
  no table and no foreign key to `players` for the reset script, the merge and the cleanups to
  carry. An id is not a person: `reset-leaderboard.sql` restarts the ids and a merge deletes the
  absorbed one, and a name is not either, since a detected rename changes it. Each entry keeps the
  record's `first_seen` as the server gave it, and `sameRecord` accepts the record now behind the
  id only if it was first seen no later than that: a rename leaves the date alone, a merge only
  moves the kept record's earlier (`least`), and a record made after the watch cannot be the player
  watched. The board asks `/api/players?ids=` (this site's database, never the source; at most
  `MAX_WATCHED`, a chosen bound) for each id once, and the Watching button stays disabled until
  every id has an answer, so nothing is shown on a guess. Entries that fail are listed as no longer
  on record with Remove, never dropped silently. The route takes an `int[]` parameter, so it runs
  in the reference-postgres CI job. `watchlist.spec.ts` plants a stale entry for a real id and
  checks that player is never shown as watched.
- `LeaderboardTable`'s `compact` means no search bar and no paging, not fewer columns: hiding
  Best and Last played left three auto-width columns splitting 600px of slack, so the numbers
  floated apart with a void between the name and the score. The Player column carries `w-full`
  to take the slack instead. Anything whose text can wrap in that table needs
  `whitespace-nowrap`; "over a day ago" wrapping made two rows half again as tall as the others.
- `syncReference` runs its guards inside the transaction, so a `throw` rolls back the whole
  import and, because it reverts `last_modified` too, the next run re-fetches the same body and
  throws again: a rejection holds until the source publishes something different. That is the
  intent for a catalog-wide collapse and was a disaster for a single card losing its variants,
  which happens whenever the source delists one. That case now keeps the saved variants for
  that card (`importing` in `sync.ts`) and lets the feed through; the catalog-wide 80% check
  stays, measured on what arrived rather than after retention, so retention cannot hide it.
  Everything downstream reads `importing`, not `records`: the payload, the change rows and the
  `changed` check must agree, or `changed_at` moves for an edit that was never written. Before
  adding a guard here, ask what the source doing this routinely would cost.
- `parseGameState` emits `accountId` only from something that names the uploader: the header,
  `ClientPlayerInfo.AccountId`, or the single result entry carrying a deck. Never from
  `players[localIndex]`. That index falls back to a deck-overlap guess which always answers 0
  or 1, so on a game with an empty board (a turn-one retreat) it ties to slot 0 and is simply
  wrong, and `players[wrong].PlayerInfo.AccountId` is the opponent's real id. `record-game`
  hashes it, so a wrong one files the game under them and writes a `snap_names` row pairing
  their account with the uploader's name, because `playerName` comes from `ClientPlayerInfo`
  and does not move with the guess. `snap_names` is the only rename evidence there is and it
  feeds a one-way merge. No id is the safe answer: the caller then hashes per tracker key. The
  header is honoured only when it names somebody the file contains, or a typo mints a fresh
  identity for every bad value; `record-game.test.ts` covers that and caught it being missed.
- A JS string bound to a `jsonb` column must carry `$n::text::jsonb`. Verified against real
  postgres.js through a PGlite socket server: a bare `$n` stores `jsonb_typeof = string`, so
  `value.at` reads back as `String.prototype.at`, a function. PGlite coerces it to an object
  instead, which is why every such write looked fine locally and was wrong in production, and
  why `lastBoardCheck` reads `updated_at` rather than the value it wrote. All three `meta`
  writes in `ingest.ts` carry the cast now. `getLastSnapshot` has no callers; if you give it
  one, check what the column really holds first.
- `scripts/index-official-patches.mjs` matches card names **case-sensitively**, and
  `patchDate` builds the date field by field through `Date.UTC`. Both were bugs with the same
  shape: invisible where they were run. Lowercasing made the card `Random` match "draw a
  random card" in 55 of 139 articles, more than Thanos; `Date.parse("September 15 2026")` is
  local midnight, so the date moved back a day anywhere east of Greenwich while CI (UTC) and
  the machine that generated the index (UTC-6) both read it correctly. The run prints its
  most-mentioned names for that reason. Regenerating needs network to marvelsnap.com and
  marvelsnapzone.com, which the sandbox does not have, so it runs as the manual **Official patch
  index** workflow (`patch-index.yml`): it pushes a `patch-index/<date>` branch, never main, and
  the "Most mentioned" line in its log is read before the pull request is merged. The index from the
  7 October 2026 run replaced the hand-stripped one and was the first regenerated index merged.
  The first regenerated index (5 October 2026) dropped about 100 links that the lowercased index
  had, among them real cards such as Colossus, which the owner confirmed the article writes in
  ordinary case, so case alone does not explain it. The run now also prints every name that
  matched only with case ignored, with the article text around it, and every id the committed
  index linked that the downloaded lists no longer contain. Read both before changing the
  matcher. The patch index only links cards `isDeckable` accepts (it imports `cards/sync.ts`,
  which Node runs as TypeScript because the file has no imports and only erasable types), so
  alternate-mode, event and not-in-the-game cards are never credited with a patch note.
  The 7 October 2026 run showed two real causes and the matcher now allows both (`namePattern`):
  small joining words in either case ("the Ancient One", "Morgan Le Fay" against the source's
  "Morgan le Fay") and a whole name in capitals (balance-update headings such as SILVER
  SAMURAI). Every other word keeps its case. Each match that needed either is printed under
  "Matched through a small word or an all-caps heading"; read that list before merging.
  A name's first word keeps its case even when it is "The": relaxed, it linked The Collector to
  "the Collector's Vault" (3 articles) and The Nexus to "the Nexus Events update", and won back
  only the Living Tribunal and the Space Throne. Colossus is settled: all 9 lost links are one
  known-issue sentence copied between patch notes, "such as colossus is played on", lowercase
  in the source, so it stays unlinked. In the full log, a run of spaces inside a sample is a
  name that already matched and was removed, not missing text.
- `NOT_IN_GAME` in `cards/sync.ts` is for cards the source lists as released that are in no
  mode of the game. Random is the one known case: the owner confirmed it is not in the game, and
  card sites date it to September 2022, before launch, so it is most likely a removed beta card.
  Its wiki page says "Not in the game" rather than "Other / mode card", which is still right for
  the Champion and event versions. It is kept by id, not by the `^random$` name rule, so it stays
  out of decks even if the source ever gives it a series.
- `claimPlayer` and `claimTracker` both decide in the write, never in a read above it. The
  reads in `claimPlayer` exist to word the error, not to make the decision: `claims.test.ts`
  races two claims through `Promise.all` and PGlite's single connection interleaves them, which
  is enough to reproduce the loser taking a primary-key exception out through the route as a
  500. Any new one-per-thing rule here needs the same shape.
- Identity is a boolean, never the presence of a display string. `DeckBuilder` took
  `signedIn={postAs !== null}` from an optional `postAs`, and `undefined !== null` is true, so
  leaving it out showed the signed-in deck panel to anonymous visitors whose every request then
  401'd.
- Who snapped is read from `StakesRaised` on the uploader's result entry and from each player's
  `_turnsOnStakesRaiseRequested`. There is no `_stakesRaised` in a real GameState.json, which is
  what the parser read, so `snapped` was false on every upload ever taken while
  `opponentSnapped` read the real field and worked. The synthetic builder had invented
  `_stakesRaised` to match the code, so the tests agreed with the bug: the third time this
  family of error has landed, after the `_to` board and the uploader-as-own-opponent fallback.
  `parse-real-game.test.ts` now asserts both sides, because the one real file is a snapped game
  and nothing but the file settles a field name. Games recorded before the fix cannot be
  repaired: `tracked_games` keeps no copy of the source file.
- The second and third locations turn over on turns two and three, so a game that ends before
  then reports them as `RevealOn2` and `RevealOn3`. Those are the game saying nobody saw them,
  not location IDs: they match nothing in the `locations` table, so `locationName` prettified
  them into "Reveal On 2" beside a real location and they were stored in
  `tracked_games.locations` for anything counting locations to count. `parse-game.ts` reads
  them as null; the board already draws a nameless location as "Location 2". Only this pattern
  is filtered, and only because a real retreat showed it.
- The uploader's own cards come from their result entry: `CardDefIdsDrawn` and
  `CardDefIdsPlayed`. `ClientPlayerInfo.CardsDrawn`/`CardsPlayed`, which the parser used to
  read, are an event log covering **both players**, interleaved with `None` placeholders and
  carrying duplicates. On one real game "cards you played" held Domino, Jubilee, Wave, WarMachine
  and Infinaut, none of them in the uploader's deck. Across all four real files the result entry
  equals that log exactly once the opponent's cards and the placeholders are removed. `None` is
  the game's null card id and `cardId` now drops it, which covers the deck, the board and the
  opponent's cards as well.
- `OpponentConceded` on the result entry says the opponent walked away. It feeds `foldRate` and
  `theyFolded`, the mirror of `retreatRate` and `retreated`. Games stored before the column read
  as false, which is indistinguishable from an opponent who played on, so it understates old
  history rather than inventing folds; say how many games it had the flag for, never treat the
  whole history as opponents who never retreated.
- `LocationResults` is the uploader's own per-location record, index-aligned with the locations:
  on every real file its `CardsPlayed` matches that player's card count in the matching zone. It
  fills `won` and `powerPlayed` on each `BoardZone`, so it rides in the existing `board` jsonb
  and needs no column. **`IsWinner` is only written when it is true**, so a lane that is not won
  covers losing it and tying it alike and there is nothing in the file that separates them: the
  UI says "won" and "not won" and draws no "lost" badge. `locationRecords` skips zones with no
  `won` at all rather than counting them as losses, because a board stored before this would
  otherwise drag every rate down.
- `friendly` and `battle_mode` games are stored on upload and excluded on read, in `loadGames`
  and in the league count in `getMetaStats`, which is a separate query and has to agree on its
  own. `battle_mode` used to be written and read by nothing, so battle games counted as ranked.
  Any new read of `tracked_games` needs both filters. Only the false side of `IsBattleMode` has
  been checked against a real file: both real fixtures are ranked and read false, which is the
  direction that matters, since a flag reading true on a ranked game would hide it. A battle
  game read as ranked costs a slightly wrong number; that was the owner's call to accept.
- `EnergySpent` on the result entry is deliberately left unread. It looks like the makings of a
  "wasted energy" stat, and that stat would be wrong: plenty of decks are built to leave energy
  unspent, and several cards pay off for it, so a number that counts leftover energy as waste
  would mark correct play as a mistake. Rejected on the owner's knowledge of high Infinite play,
  so do not re-propose it. It is the same trap `cubeDiscipline` avoids: one figure applied to
  every game alike, when the right play depends on the deck.
- Wiki sections live once, in `src/lib/wiki/sections.ts`. The header menu, the tabs, the
  breadcrumbs and the sitemap all read it; they used to be five hand-kept copies. `private`
  keeps a per-visitor page such as My collection out of the sitemap.
- The wiki layout wraps every wiki page, so it must not load per-visitor data. It used to read
  the visitor's whole saved-variant collection and send it with every page, the guides
  included. `VariantToolsProvider` now fetches `/api/collection` the first time an Owned/Wanted
  button mounts, and those buttons stay disabled until it lands so no click is decided on a
  status that has not arrived. `currentAccount` is wrapped in React `cache` so the site header
  and the wiki layout share one session lookup per request.
- "Keep exploring" (`wiki-discovery.tsx`) matches a mechanic at the start of a word, in JS and
  in SQL (`\m`), so "move" finds moves and moved but not remove. It was a substring match.
  Its term list includes every archetype's own `mechanic`, or that archetype's guide is
  unreachable from card text; Bounce (`return`) and Zoo (`1-cost`) were. Optional sections on
  a card page catch their own errors and sit behind Suspense: the page has only a root error
  boundary, so a throw there replaced the card with the error screen.
- A link to one variant (`#variant-<id>`, used by search) must scroll there once the variants
  arrive. They stream in behind Suspense after the page, so the browser's own anchor scroll and
  Next's can both run before the anchor exists and give up at the top. `ScrollToHash` at the end
  of `CardVariants` does it once they mount. Reproduced by delaying the variants 1.5s in a local
  build: 3 of 3 landed at the top without it, 6 of 6 on the variant with it. Content streaming in
  above after the scroll (Keep exploring) was the other suspect and does not break it, since the
  browser's scroll anchoring holds the position: 6 of 6 with that section delayed instead.
- `artists()` takes options rather than a search string: `name` for one exact artist, `limit`,
  and `seed` for a stable daily pick. Callers ask for what they show; the spotlight used to
  aggregate every artist to display one. An artist page defaults to the release status the
  artist has work in. The gallery's artist filter is case-insensitive on purpose and tested.
- `hookTimeout` matches `testTimeout` (30s) in `vitest.config.mts`. Most files make their first
  database call in a hook, and that call boots PGlite and applies the schema: about 2.7s idle and
  8 to 9.5s under load, against vitest's 10s default. Three suites run at once failed 18 files with
  "Hook timed out in 10000ms", reported as failed files plus extra skipped tests, until it was raised.
  A run with failed files and more than the usual 8 skips is this, or a hook that really hangs.
- The browser tests run `next start`, which serves the **last build**. Changing a source file
  and rerunning them tests the old code. Rebuild first; a check written to catch a bug passed
  against the buggy page for exactly this reason until it was rebuilt.
- The interaction lab (`/wiki/interactions`) was removed by the owner's call: a hand-coded
  calculator of board priority and cube stakes, i.e. game rules written out by hand, showing
  what players already see in the game. The archetype guides were kept.
- The reference route syncs cards and then locations, one after the other. Requested together,
  the locations feed alone was refused with HTTP 403 on nine of 67 hourly runs (21 to 24
  September 2026) and cards never were. `download` also asks once more after a 403 or 429, with
  a pause. Whether sequencing is the cure has not been proven, because the source cannot be
  reached from the sandbox; the Actions history is the measure, so check it before changing either.
  Every card and variant image is hotlinked from the same host, so the browser meets the same
  source that pushes back on the server.
- Art is served through `/art/...` (`lib/art.ts`, `app/art/[...path]/route.ts`), never
  hotlinked. marvelsnapzone answered some of the visitor's image requests with a 403, on some
  loads and not others, on every page with art; the owner confirmed the status in the browser.
  The route fetches once and the CDN keeps it, so a versioned image is asked for once per cache
  fill instead of once per visitor. It serves only the source's `assets/media` directory and only
  webp, png and jpeg, so it is not an open proxy and cannot hand out an SVG from our origin.
  Failures are `no-store` so one refusal is never cached for everyone. `next/image` was not
  used because the optimizer bills per transformation, and there are thousands of variants.
- Past Infinite, the in-game leaderboard is ordered by Snap Points, higher is better. Web sources
  disagree (some say cubes weighted by MMR); the owner plays at high Infinite and confirmed it,
  so the guide says Snap Points.
- Player-visible changes get an entry in `src/lib/changelog.ts`, newest first, dated the day it reaches main.
- Visual hierarchy: `Panel` defaults to a soft surface; use `tone="quiet"` for secondary information.
  Homepage source-check freshness is a single inline description, not a second update timestamp.
  `WIKI_GROUPS` references every canonical section once; desktop groups and the mobile page picker share it.
  Detail routes have their own loading shape so opening a card does not flash a card-library grid.
  Guides mount `ScrollToHash` after their sections arrive, just as streamed variants do; otherwise
  navigation through a loading boundary can lose search-result anchors such as `#priority`.
  `AnimatedCardGrid` uses pre-commit positions and viewport-limited Web Animations, with cancellation
  on resize, focus, touch, unmount and live reduced-motion changes. Keep transforms off reading surfaces.
- Don't write `﻿` escapes with file-writing tools; it has been saved as a literal BOM. Use `String.fromCharCode(0xfeff)`.
- `npm ci` prints an audit summary in every CI log; read it. Next.js 16.3.5 carried a critical remote
  code execution flaw in `next/og` ImageResponse on the Node runtime (GHSA-vcvr-r3jv-pc5j), which is
  what both share cards use, and the Movers card draws player names, which anyone can choose. The
  CI logs showed it from at least 7 October 2026. 16.3.8 fixed it and six other Next advisories. The five highs that remain are
  one chain (`braces` → `micromatch` → `fast-glob` under `eslint-config-next`), lint-time only, with no
  fixed `braces` release; npm's "fix" is a two-major downgrade of the lint config, so do not take it.
  After a Next or renderer upgrade, render the share cards from a build that has board data: the
  Movers card is drawn at build time (`revalidate = 600`), so a build against an empty database only
  ever shows its empty state.
- Keep `src/lib/credits.ts` and the README Credits section in sync when adding sources or dependencies.

- Reference imports run independently at `/api/cron/reference`; never hide failures inside a successful
  leaderboard response. Cards/wiki/builder/stats share canonical card rows. Unreleased rows are not deckable.
- Reference imports preserve known IDs and the last good dataset on validation failure. Do not weaken
  missing-ID checks to accommodate a bad feed. Change history starts after the baseline, not retroactively.

- The builder's browser draft (`snaphub:deck-draft`) records the link it was edited from
  (`draftSource`: `deck:`, `local:` or `code:` plus the value). On load, a draft from the same
  link wins over the link's original, with "Discard edits" to go back; a draft from any other link
  does not. Before this, opening from a link loaded the original and the autosave wrote it over the
  draft on mount, so every reload lost the edits, and phones reload a tab they have put to sleep.
  It works because every move inside the builder rewrites the address with `replaceState`
  (saving to the browser now goes to `?local=`), so the address is what a reload opens; a new
  move that changes what is open without doing that breaks recovery. `saveLocal` and `deleteLocal`
  re-read storage before writing and the list follows the `storage` event, or a save in one tab
  wrote its stale list over another tab's save. The draft is still one per browser, so two tabs
  editing from different links share it and the last edit wins. `builder-recovery.spec.ts` covers
  all of this and failed on the old builder.
- The account that shared a deck can unlist, re-list or delete it (`/api/decks/[id]` PATCH
  `{listed}` and DELETE); an admin can do the same to any deck, and renaming stays admin-only.
  `removeDeck` and `setDeckListed` put the owner check in the write, and the read after only words
  the refusal. A deck shared signed out has no owner, so only an admin can touch it. Visibility is
  in the dedupe key, so flipping a copy onto the side where its owner already has an identical one
  is a 409, never a merge. `ownsDeck` gives the deck page a boolean; owner ids are not sent to the
  browser. `shared-deck-owner.spec.ts` failed on the old My decks, which had no such controls.
- `/decks/mine` reads private drafts and shared copies only for the session account. A browser-to-account
  save creates a private copy; public/unlisted sharing remains explicit. Builder `?private=` lookups must
  check ownership before passing any card or name to the client, and retain that draft's update ID.
- Snapshot success is not just a successful HTTP response from the route: `snapshotRunSucceeded` requires
  the active board to succeed in this run. An empty unpublished month is allowed while the previous live
  board succeeds. The read-only health endpoint uses successful `board_checked` timestamps, never a
  generic cron timestamp, and must not refresh the source itself. The monitor runs on GitHub Actions only,
  so a GitHub-wide outage silences it even though Vercel Cron keeps taking snapshots. GitHub also
  throttles it: from 19 to 21 October 2026 the 15-minute schedule ran 12 times in about 50 hours,
  2.5 to 5.5 hours apart, so an alert, and the stand-in snapshot, can lag that long. Over the same
  checks Vercel Cron refreshed on every 10-minute mark and the board was never 8 minutes old.
  So the fast alert runs inside the snapshot (`alert.ts`, called by the route after `health`):
  with `SNAPSHOT_ALERT_DISCORD_URL` set, a run posts to that Discord webhook when the board turns
  stale and when it turns fresh again, never on every stale run. The `snapshot_alert` row in `meta`
  holds the state last told, and the upsert that flips it decides which run posts (a writable CTE
  reads the old value in the same statement), so two runs at once post once; checked on Postgres
  16 through postgres.js, where they really race, and the test runs in the reference-postgres job.
  A delivery that fails puts the state back so the next run tries again. The first healthy run
  only records a baseline. Posts carry `allowed_mentions: { parse: [] }`, since run details can
  hold source text, and stop at Discord's 2000 characters. It never changes the run's own answer.
  It cannot see Vercel Cron itself stopping, which is why the GitHub monitor stays.
- Only Vercel Cron schedules snapshots (`vercel.json`, Pro plan). The GitHub snapshot workflow is
  manual, and the freshness monitor takes one snapshot when the health check names a board stale or
  missing, then fails anyway so the alert still goes out. GitHub's 10-minute schedule was removed on
  19 October 2026. In 46 hours on 15 and 16 October, it made 45 runs, every one a full fetch of the official
  board, while the monitor found the board fresh on all 41 of its checks, and the terms rule out
  automated collection. Do not add a routine second caller back; `snapshot-workflows.test.ts` runs
  the monitor's step with bash, curl and jq against a stub site and checks the schedule. A cron run
  and a manual or stand-in run can still overlap, so every run goes through `withSnapshotLease`
  (`lease.ts`). Without it, two overlapping runs on real Postgres
  stored every new player twice: `players.name` is not unique and each run decides who is new from a
  read made before the other's inserts commit. PGlite serializes transactions and cannot show this;
  `overlap.test.ts` and `lease.test.ts` run in the reference-postgres CI job for that reason.
  `overlap.test.ts` was checked failing without the lease on a local Postgres 16. A skipped call returns 200 with
  `skipped`, not 503: the run in progress is doing the work and the freshness monitor reads
  `board_checked`, so a stuck run still shows. `SNAPSHOT_LEASE_SECONDS` must stay above the route's
  `maxDuration`; a test compares them. Any new scheduled writer that decides from a read needs the
  same treatment.
- The tracker queue saves capture-time site/key/account identity before uploading, keeps rejected files,
  and removes a payload only after a matching game acknowledgement. Retries must not stop file polling or
  let one failing entry starve later games. Test with real Windows PowerShell 5.1, not just TypeScript mocks.
  `x-snaphub-captured-at` is optional for old trackers; it sets `played_at`, clamped to receipt time for a
  clock in the future. `last_upload_at` remains server receipt time. Retry acknowledgements must never
  rewrite an existing game's played time.
