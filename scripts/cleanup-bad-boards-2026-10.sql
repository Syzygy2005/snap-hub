-- Remove what the official board's bad copies wrote between 10 and 14 October 2026.
--
-- Run it in the Supabase SQL editor (Dashboard -> SQL Editor -> New query), paste, Run.
-- Run scripts/cleanup-bad-boards-2026-10-preview.sql first and check its numbers; this script
-- prints the same numbers when it finishes. Deleted rows cannot be brought back, so take a
-- backup first if the project has none recent.
--
-- WHAT HAPPENED
--   Seven times the official board sent its lower part from an old copy: everything from
--   first_stale_rank down was stale, and the next run put it right. Each bad board was stored,
--   which wrote three kinds of junk into history, all of them at the two runs listed below:
--     stale sighting  a player shown from the old copy, at the bad run
--     pushed off      a real player the old copy displaced, marked gone at the bad run and
--                     back at the next one
--     left again      a stale player marked gone at the next run
--   The ingest now holds boards like these (SUSPECT_DEPARTURES in ingest.ts), so this only
--   needs to run once.
--
-- WHAT GOES
--   Those history rows. October standings for players the bad boards were the only sighting
--   of, and the players themselves when nothing else refers to them.
--
-- WHAT IS REPAIRED
--   For players still in standings: rank, score and last-seen time where the bad board was the
--   last thing to write them, "last moved" where a return that changed nothing moved it, first
--   seen, best rank and peak where the bad board was their first sighting, and the player's
--   "last on a board" time where the bad board set it. Each is rebuilt from the history that
--   remains, which records every score change but not every rank change, so a rebuilt rank or
--   time can be slightly older than the true one. None of these is guessed.
--
-- WHAT STAYS
--   Everything at the bad run above first_stale_rank, every real departure (one that did not
--   come back at the next run), every sighting at the next run, best rank and peak for anyone
--   seen before the bad board (the old copy was real October data), and every other table.

begin;

-- pg_temp, so a rerun in the same session starts clean and no permanent table can ever match.
drop table if exists pg_temp.bad_boards, pg_temp.junk_rows, pg_temp.cleanup_summary, pg_temp.gone_standings, pg_temp.gone_players;

create temp table bad_boards (season text, region text, bad_at timestamptz, fixed_at timestamptz, first_stale_rank int);

insert into bad_boards values
  ('2026-10', 'global', timestamptz '2026-10-10 12:20:35.085+00', timestamptz '2026-10-10 12:46:17.871+00', 301),
  ('2026-10', 'global', timestamptz '2026-10-11 17:59:31.625+00', timestamptz '2026-10-11 18:18:15.295+00', 801),
  ('2026-10', 'global', timestamptz '2026-10-11 19:08:37.593+00', timestamptz '2026-10-11 19:24:47.918+00', 901),
  ('2026-10', 'global', timestamptz '2026-10-12 16:43:42.025+00', timestamptz '2026-10-12 17:00:03.975+00', 601),
  ('2026-10', 'global', timestamptz '2026-10-12 21:58:38.572+00', timestamptz '2026-10-12 22:13:51.107+00', 101),
  ('2026-10', 'global', timestamptz '2026-10-14 01:10:18.336+00', timestamptz '2026-10-14 01:44:04.689+00', 601),
  ('2026-10', 'global', timestamptz '2026-10-14 20:08:35.634+00', timestamptz '2026-10-14 20:20:17.529+00', 501);

create temp table junk_rows as
  select h.player_id, h.season, h.region, h.taken_at, 'stale sighting' as kind, b.bad_at
    from history h
    join bad_boards b on b.season = h.season and b.region = h.region and h.taken_at = b.bad_at
   where h.rank >= b.first_stale_rank
  union all
  select h.player_id, h.season, h.region, h.taken_at, 'pushed off', b.bad_at
    from history h
    join bad_boards b on b.season = h.season and b.region = h.region and h.taken_at = b.bad_at
   where h.rank is null
     and exists (select 1 from history r
                  where r.player_id = h.player_id and r.season = h.season and r.region = h.region
                    and r.taken_at = b.fixed_at and r.rank is not null)
  union all
  select h.player_id, h.season, h.region, h.taken_at, 'left again', b.bad_at
    from history h
    join bad_boards b on b.season = h.season and b.region = h.region and h.taken_at = b.fixed_at
   where h.rank is null
     and exists (select 1 from history s
                  where s.player_id = h.player_id and s.season = h.season and s.region = h.region
                    and s.taken_at = b.bad_at and s.rank >= b.first_stale_rank)
     and (select p.rank from history p
           where p.player_id = h.player_id and p.season = h.season and p.region = h.region
             and p.taken_at < b.bad_at
           order by p.taken_at desc limit 1) is null;

create temp table cleanup_summary as
select b.bad_at,
       count(j.kind) filter (where j.kind = 'stale sighting') as stale_sightings,
       count(j.kind) filter (where j.kind = 'pushed off') as pushed_off,
       count(j.kind) filter (where j.kind = 'left again') as left_again,
       (select count(*) from history h
         where h.season = b.season and h.region = b.region and h.taken_at = b.bad_at
           and h.rank < b.first_stale_rank
           and (select p.rank from history p
                 where p.player_id = h.player_id and p.season = h.season and p.region = h.region
                   and p.taken_at < h.taken_at
                 order by p.taken_at desc limit 1) is null) as returns_above_stale_part,
       (select count(*) from history h
         where h.season = b.season and h.region = b.region and h.taken_at = b.bad_at
           and h.rank >= b.first_stale_rank
           and (select p.rank from history p
                 where p.player_id = h.player_id and p.season = h.season and p.region = h.region
                   and p.taken_at < h.taken_at
                 order by p.taken_at desc limit 1) is not null) as already_on_board_in_stale_part
  from bad_boards b
  left join junk_rows j on j.bad_at = b.bad_at
 group by b.season, b.region, b.bad_at, b.first_stale_rank;

delete from history h
 using junk_rows j
 where h.player_id = j.player_id and h.season = j.season and h.region = j.region and h.taken_at = j.taken_at;

create temp table gone_standings as
  select distinct j.player_id, j.season, j.region
    from junk_rows j
    join standings s on s.player_id = j.player_id and s.season = j.season and s.region = j.region
   where j.kind = 'stale sighting'
     and not s.on_board
     and not exists (select 1 from history h
                      where h.player_id = j.player_id and h.season = j.season and h.region = j.region);

delete from standings s
 using gone_standings g
 where s.player_id = g.player_id and s.season = g.season and s.region = g.region;

update standings s
   set rank = last.rank, score = last.score, updated_at = last.taken_at
  from (select distinct on (h.player_id, h.season, h.region) h.player_id, h.season, h.region, h.rank, h.score, h.taken_at
          from history h
         where h.rank is not null
           and (h.player_id, h.season, h.region) in (select player_id, season, region from junk_rows where kind = 'stale sighting')
         order by h.player_id, h.season, h.region, h.taken_at desc) last,
       bad_boards b
 where s.player_id = last.player_id and s.season = last.season and s.region = last.region
   and b.season = s.season and b.region = s.region and s.updated_at = b.bad_at
   and not s.on_board;

update standings s
   set first_seen = seen.first_at,
       best_rank = least(seen.best_rank, case when s.on_board then s.rank end),
       peak_score = greatest(seen.peak_score, case when s.on_board then s.score end)
  from (select h.player_id, h.season, h.region, min(h.taken_at) as first_at, min(h.rank) as best_rank, max(h.score) as peak_score
          from history h
         where h.rank is not null
           and (h.player_id, h.season, h.region) in (select player_id, season, region from junk_rows where kind = 'stale sighting')
         group by h.player_id, h.season, h.region) seen,
       bad_boards b
 where s.player_id = seen.player_id and s.season = seen.season and s.region = seen.region
   and b.season = s.season and b.region = s.region and s.first_seen = b.bad_at;

update standings s
   set score_changed_at = moved.changed_at
  from (select player_id, season, region, max(taken_at) as changed_at
          from (select player_id, season, region, taken_at, rank, score,
                       lag(rank) over w as prev_rank,
                       lag(score) over w as prev_score,
                       row_number() over w as n
                  from history
                 where (player_id, season, region) in (select player_id, season, region from junk_rows)
                window w as (partition by player_id, season, region order by taken_at)) steps
         where rank is not null and (n = 1 or prev_rank is null or prev_score <> score)
         group by player_id, season, region) moved,
       bad_boards b
 where s.player_id = moved.player_id and s.season = moved.season and s.region = moved.region
   and b.season = s.season and b.region = s.region
   and s.score_changed_at in (b.bad_at, b.fixed_at)
   and moved.changed_at < s.score_changed_at;

update players p
   set last_seen = seen.last_at
  from (select h.player_id, max(h.taken_at) as last_at
          from history h
         where h.rank is not null
           and h.player_id in (select player_id from junk_rows where kind = 'stale sighting')
         group by h.player_id) seen
 where p.id = seen.player_id
   and p.last_seen in (select bad_at from bad_boards);

update players p
   set first_seen = seen.first_at
  from (select h.player_id, min(h.taken_at) as first_at
          from history h
         where h.player_id in (select player_id from junk_rows where kind = 'stale sighting')
         group by h.player_id) seen
 where p.id = seen.player_id
   and p.first_seen in (select bad_at from bad_boards);

create temp table gone_players as
  select distinct j.player_id
    from junk_rows j
   where not exists (select 1 from history h where h.player_id = j.player_id)
     and not exists (select 1 from standings s where s.player_id = j.player_id)
     and not exists (select 1 from player_names n where n.player_id = j.player_id)
     and not exists (select 1 from player_claims c where c.player_id = j.player_id);

delete from players p
 using gone_players g
 where p.id = g.player_id;

commit;

select s.*,
       (select count(*) from gone_standings) as total_standings_removed,
       (select count(*) from gone_players) as total_players_removed
  from cleanup_summary s
 order by s.bad_at;
