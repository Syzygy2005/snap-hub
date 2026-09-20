@AGENTS.md

# Snap Hub notes

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
  uploader as their own opponent. Add a second real file before widening any of this.
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
- `runSnapshot` fetches the current month every run and the previous month exactly once, marking
  it `season_closed:<season>:<region>` in `meta` afterwards. The mark is only written once the
  current season has a standings row, which is the proof that the old month is really over; do not
  swap that for a settling delay. `rollover.test.ts` covers the turn of the month, the year
  boundary and a failed fetch being retried.
- The snapshot workflow runs every 10 minutes. Shortening it was measured, not guessed: detection
  of real renames went 48% hourly to 81% at ten minutes across eight seeds, and phantoms fell.
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
- `snap_names` records display names a tracker has seen one Snap account using, which is the
  only direct evidence of a rename the site can get. It is **never applied automatically**: the
  game file is uploaded by its own client and the Snap account id arrives in a header the
  uploader sets, so anyone holding a key could describe an account that is not theirs, including
  one they know only from having played against them. `otherNamesUsedWith` feeds a read-only
  panel an admin sees on a player profile, next to merge, and a person decides. Keep it that way
  unless there is a way to prove account ownership.
- `player_claims` links a Discord account to a player row, one each way. Nothing on the board
  can check a claim, so an unverified one is shown to the claimant and to nobody else; it goes
  public once a `snap_names` row on the same account matches the player's current name
  (`verified_by = 'tracker'`) or an admin confirms it. The claiming route takes the account from
  the session and never from the request. It carries a foreign key to `players`, so it is in the
  reset script's truncate list and in `rollover.test.ts`'s; a claim does not survive a reset,
  because the row it pointed at does not either.
- The name on a tracker key is a label for the key ("Gaming PC"), not a Snap name. The form used
  to say "Display name / Your Snap name", which read as though keys were identified by it.
- Admin is `ADMIN_DISCORD_IDS`, checked with `isAdmin` inside every admin route handler. Hiding a
  control in the UI is not the boundary; if a new admin action appears, it checks server side too.
- Merging players is destructive and one-way, reachable from the profile page as an admin and as
  `npm run merge-players`. Both preview then apply, and both refuse when the two held a rank in the
  same snapshot; keep that check if the merge logic is ever touched. The route re-plans server side
  rather than trusting a plan from the client.
- Player-visible changes get an entry in `src/lib/changelog.ts`, newest first, dated the day it reaches main.
- Don't write `﻿` escapes with file-writing tools; it has been saved as a literal BOM. Use `String.fromCharCode(0xfeff)`.
- Keep `src/lib/credits.ts` and the README Credits section in sync when adding sources or dependencies.
