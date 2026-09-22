-- Wipe the leaderboard and start again from the next snapshot.
--
-- Run it in the Supabase SQL editor (Dashboard -> SQL Editor -> New query), paste, Run.
-- Read the notes below first. This cannot be undone.
--
-- WHAT GOES
--   players, player_names, player_claims, standings, history, snapshots, and the "last
--   updated" marker. That is every rank, every point change and every profile the site has
--   recorded. Claims go with the player rows they point at, so anybody who claimed a profile
--   has to claim it again afterwards; the rows they claimed no longer exist.
--
-- WHAT STAYS
--   Accounts, sign-ins, decks and their owners, tracker keys, tracked games, the card list.
--   Nothing outside the leaderboard has a foreign key to players, so none of it is touched.
--
-- WHAT COMES BACK, AND WHAT DOES NOT
--   The next snapshot refetches the current and previous month's boards from the official API,
--   so the standings return within minutes. The point history does not: the API serves a board as
--   it stands now, not how it moved, so every point change recorded so far is gone for good and
--   Movers stays empty until enough new snapshots have accumulated.
--
-- ORDER OF OPERATIONS
--   1. Deploy first. Running this against an ingest that still writes bad data just starts the
--      same mess on a clean table.
--   2. Run this.
--   3. GitHub -> Actions -> Leaderboard snapshot -> Run workflow, for the first board.
--   Every player will carry a "new" tag on that first snapshot, because to the site they are.

begin;

truncate table history, standings, player_names, player_claims, players, snapshots restart identity;

-- "updated X ago" would otherwise outlive the data it describes, and the season_closed marks
-- say a finished month's final board is already stored, which after this it is not: leaving
-- them would stop the previous month ever being fetched again.
-- board_checked:* too, or the freshness line outlives the board it describes and the page
-- reads "Source checked 3 minutes ago" over an empty leaderboard.
delete from meta where key = 'last_snapshot' or key like 'season_closed:%' or key like 'board_checked:%';

commit;
