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
- `parse-game.ts` has only been tested on synthetic files. When a real GameState.json turns up (tracker `-SaveRaw`),
  add it as a fixture before changing field paths. The per-location board pairs `_to` with
  `LocationDefIdsAtEndOfGame` by index; a real file would confirm that order.
- `/api/tracker/download` reads `public/tracker/snaphub-tracker.ps1` off disk at request time. Next.js can't infer
  that, so it's listed in `outputFileTracingIncludes`; moving or renaming the script means updating both.
- Sign-in needs `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; without them `discordConfig()` returns null
  and the header hides the button. Discord matches the redirect URL literally, so OAuth uses
  `canonicalOrigin` (`SITE_URL`, else Vercel's production domain, else the request) rather than the host the
  visitor arrived on, and a sign-in starting elsewhere is moved there first. Register exactly one redirect.
- Don't write `﻿` escapes with file-writing tools; it has been saved as a literal BOM. Use `String.fromCharCode(0xfeff)`.
- Keep `src/lib/credits.ts` and the README Credits section in sync when adding sources or dependencies.
