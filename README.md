# Snap Hub

**Build / Track / Compete.** A fan-made Marvel Snap site: an Infinite leaderboard that keeps history, a deck
builder, and win rate / cube rate stats from a PC tracker.

- **Leaderboard**: the official top 1000, saved every 30 minutes. 24h rank and point changes, past seasons, and
  players who share a name kept apart.
- **Movers**: climbers, fallers, new entries and drop-outs over 6h / 24h / 7d.
- **Player pages**: rank and points chart, point changes, past seasons.
- **Deck builder**: filter by cost, ability and series; energy curve; copy a code the game accepts; import codes
  (long or short format, or the text the game copies); share links.
- **Stats**: meta share, win rate and cube rate by deck archetype and by card (in deck / drawn / played), plus a
  private "My stats" page with match history. Data comes from players running the PC tracker.

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

   Deploy. Tables are created on the first request. Then in **Settings → Functions**, set the function region to the
   one closest to your Supabase region so database calls stay fast.
4. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `SITE_URL`: your Vercel address, e.g. `https://snap-hub.vercel.app`
   - `CRON_SECRET`: the same value as in Vercel
5. **GitHub repo → Actions → Leaderboard snapshot → Run workflow** for the first snapshot. It then runs every 30
   minutes. GitHub pauses scheduled workflows after 60 days without commits; re-enable it from the Actions tab.

Every push to GitHub redeploys the site on Vercel.

## Stats tracker

`public/tracker/snaphub-tracker.ps1` is a PowerShell script (Windows PowerShell 5.1 or later) that watches
`%USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod\GameState.json`. When a game finishes
it gzips the file and posts it to `/api/tracker/games` with the player's tracker key. The server parses it
(`src/lib/stats/parse-game.ts`), keeps a summary, and discards the raw file. Setup instructions for players are
on `/stats/tracker`.

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
