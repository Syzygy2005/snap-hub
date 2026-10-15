-- Preview of cleanup-bad-boards-2026-10.sql. Read-only: it changes nothing.
--
-- Run it in the Supabase SQL editor first. One row per bad board:
--   stale_sightings, pushed_off, left_again  history rows the cleanup will delete
--   returns_above_stale_part  players the bad run showed above first_stale_rank who were
--                          off the board just before. Real arrivals land at the bottom, which
--                          on a bad board is the stale part, so this should be close to zero.
--                          A large number means first_stale_rank is too high for that run.
--   already_on_board_in_stale_part  players in the stale part who were on the board just
--                          before. The old copies were almost all players who had since left,
--                          so this should be small next to stale_sightings. A large number
--                          means first_stale_rank is too low and real rows would be deleted.
--   If either looks wrong, stop and check before running the cleanup.
--   total_standings_removed, total_players_removed  across all seven, repeated on each row
-- The cleanup prints the same table when it finishes, and the two should match.
--
-- The list of bad boards and the rules below must stay identical to the cleanup script's;
-- cleanup-bad-boards.test.ts checks both.

with bad_boards (season, region, bad_at, fixed_at, first_stale_rank) as (values
  ('2026-10', 'global', timestamptz '2026-10-10 12:20:35.085+00', timestamptz '2026-10-10 12:46:17.871+00', 301),
  ('2026-10', 'global', timestamptz '2026-10-11 17:59:31.625+00', timestamptz '2026-10-11 18:18:15.295+00', 801),
  ('2026-10', 'global', timestamptz '2026-10-11 19:08:37.593+00', timestamptz '2026-10-11 19:24:47.918+00', 901),
  ('2026-10', 'global', timestamptz '2026-10-12 16:43:42.025+00', timestamptz '2026-10-12 17:00:03.975+00', 601),
  ('2026-10', 'global', timestamptz '2026-10-12 21:58:38.572+00', timestamptz '2026-10-12 22:13:51.107+00', 101),
  ('2026-10', 'global', timestamptz '2026-10-14 01:10:18.336+00', timestamptz '2026-10-14 01:44:04.689+00', 601),
  ('2026-10', 'global', timestamptz '2026-10-14 20:08:35.634+00', timestamptz '2026-10-14 20:20:17.529+00', 501)
),
junk_rows as (
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
           order by p.taken_at desc limit 1) is null
),
remaining as (
  select h.player_id, h.season, h.region
    from history h
   where not exists (select 1 from junk_rows j
                      where j.player_id = h.player_id and j.season = h.season and j.region = h.region
                        and j.taken_at = h.taken_at)
),
gone_standings as (
  select distinct j.player_id, j.season, j.region
    from junk_rows j
    join standings s on s.player_id = j.player_id and s.season = j.season and s.region = j.region
   where j.kind = 'stale sighting'
     and not s.on_board
     and not exists (select 1 from remaining r
                      where r.player_id = j.player_id and r.season = j.season and r.region = j.region)
),
gone_players as (
  select distinct j.player_id
    from junk_rows j
   where not exists (select 1 from remaining r where r.player_id = j.player_id)
     and not exists (select 1 from standings s
                      where s.player_id = j.player_id
                        and not exists (select 1 from gone_standings g
                                         where g.player_id = s.player_id and g.season = s.season and g.region = s.region))
     and not exists (select 1 from player_names n where n.player_id = j.player_id)
     and not exists (select 1 from player_claims c where c.player_id = j.player_id)
)
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
                 order by p.taken_at desc limit 1) is not null) as already_on_board_in_stale_part,
       (select count(*) from gone_standings) as total_standings_removed,
       (select count(*) from gone_players) as total_players_removed
  from bad_boards b
  left join junk_rows j on j.bad_at = b.bad_at
 group by b.season, b.region, b.bad_at, b.first_stale_rank
 order by b.bad_at;
