@AGENTS.md

# Snap Hub notes

- Private account drafts use `account_decks`, never `decks`. Keep every read/update/delete scoped to
  the session account; unlisted public decks remain accessible by link. Public sharing is an explicit copy.
- `board_checked:<season>:<region>` records only successful source checks, including unchanged boards.
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
- The name on a tracker key is a label for the key ("Gaming PC"), not a Snap name. The form used
  to say "Display name / Your Snap name", which read as though keys were identified by it.
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
- Home uses a responsive cream/forest hero, not a raster banner. Keep decorative artwork hidden
  below md and verify 390px screenshots so the mobile hero never crops or pushes content offscreen.
- The Jade League rebrand uses Manrope/Inter and a hand-and-card emblem; keep app icons, share images,
  and SVG exports consistent with components/brand.tsx. Pointer effects belong on featured art only,
  never on readable statistics; honor reduced motion and pointer cancellation.
- `LeaderboardTable`'s `compact` means no search bar and no paging, not fewer columns: hiding
  Best and Last played left three auto-width columns splitting 600px of slack, so the numbers
  floated apart with a void between the name and the score. The Player column carries `w-full`
  to take the slack instead. Anything whose text can wrap in that table needs
  `whitespace-nowrap`; "over a day ago" wrapping made two rows half again as tall as the others.
- Player-visible changes get an entry in `src/lib/changelog.ts`, newest first, dated the day it reaches main.
- Don't write `﻿` escapes with file-writing tools; it has been saved as a literal BOM. Use `String.fromCharCode(0xfeff)`.
- Keep `src/lib/credits.ts` and the README Credits section in sync when adding sources or dependencies.

- Reference imports run independently at `/api/cron/reference`; never hide failures inside a successful
  leaderboard response. Cards/wiki/builder/stats share canonical card rows. Unreleased rows are not deckable.
- Reference imports preserve known IDs and the last good dataset on validation failure. Do not weaken
  missing-ID checks to accommodate a bad feed. Change history starts after the baseline, not retroactively.
