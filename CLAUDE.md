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
  marvelsnapzone.com, so the committed `Random` rows were stripped by hand in the meantime.
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
- Don't write `﻿` escapes with file-writing tools; it has been saved as a literal BOM. Use `String.fromCharCode(0xfeff)`.
- Keep `src/lib/credits.ts` and the README Credits section in sync when adding sources or dependencies.

- Reference imports run independently at `/api/cron/reference`; never hide failures inside a successful
  leaderboard response. Cards/wiki/builder/stats share canonical card rows. Unreleased rows are not deckable.
- Reference imports preserve known IDs and the last good dataset on validation failure. Do not weaken
  missing-ID checks to accommodate a bad feed. Change history starts after the baseline, not retroactively.
