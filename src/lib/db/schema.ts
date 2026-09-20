// Idempotent schema, applied on first connection. Works on Postgres (Supabase) and PGlite.
export const SCHEMA = /* sql */ `
create table if not exists players (
  id serial primary key,
  name text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists players_name_idx on players (name);
create index if not exists players_name_lower_idx on players (lower(name));

-- Names a player used before renaming. The board has no player IDs, so a rename otherwise
-- reads as one player vanishing and a brand new one appearing with no history.
create table if not exists player_names (
  id serial primary key,
  player_id int not null references players(id) on delete cascade,
  name text not null,
  changed_at timestamptz not null
);
create index if not exists player_names_player_idx on player_names (player_id, changed_at desc);

-- One row per snapshot that actually changed something.
create table if not exists snapshots (
  id serial primary key,
  season text not null,
  region text not null,
  taken_at timestamptz not null,
  total_players int,
  entries int not null,
  changed int not null
);
create index if not exists snapshots_season_idx on snapshots (season, region, taken_at desc);

-- Latest known position of every player who has appeared on a board this season.
create table if not exists standings (
  season text not null,
  region text not null,
  player_id int not null references players(id),
  rank int not null,
  score int not null,
  best_rank int not null,
  peak_score int not null,
  on_board boolean not null default true,
  first_seen timestamptz not null,
  updated_at timestamptz not null,
  score_changed_at timestamptz not null,
  history_at timestamptz not null,
  primary key (season, region, player_id)
);
create index if not exists standings_rank_idx on standings (season, region, on_board, rank);

-- Change log. A row is written when a score changes, a player enters or leaves
-- the board (rank null = left), or their rank drifts and the last row is stale.
create table if not exists history (
  player_id int not null references players(id),
  season text not null,
  region text not null,
  taken_at timestamptz not null,
  rank int,
  score int not null
);
create index if not exists history_player_idx on history (player_id, season, region, taken_at);
create index if not exists history_time_idx on history (season, region, taken_at);

create table if not exists cards (
  def_id text primary key,
  name text not null,
  cost int not null,
  power int not null,
  ability text not null,
  art text not null,
  series text not null,
  tags text[] not null default '{}',
  deckable boolean not null,
  updated_at timestamptz not null default now()
);

-- Signed-in people. Discord owns the credential; we keep only what's shown on the site.
create table if not exists accounts (
  id serial primary key,
  discord_id text not null unique,
  username text not null,
  avatar text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Only a hash of the session token is stored, the same way tracker keys are held, so the
-- table is useless to anyone who reads it and a session can be revoked by deleting a row.
create table if not exists sessions (
  token_hash text primary key,
  account_id int not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_account_idx on sessions (account_id);
create index if not exists sessions_expiry_idx on sessions (expires_at);

create table if not exists decks (
  id text primary key,
  name text not null,
  cards text[] not null,
  card_key text not null,
  -- false = reachable by link but kept off the Decks page.
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  views int not null default 0
);
-- Added after launch; decks that predate it are public, which is what they already were.
alter table decks add column if not exists listed boolean not null default true;
-- A public and an unlisted copy of the same list are different decks, so visibility is part
-- of the dedupe key. Replaces decks_dedupe_idx, which would have handed the second person
-- the first person's row and silently changed who could see it.
drop index if exists decks_dedupe_idx;
-- Who posted it. Null for a deck shared before accounts existed, or by someone signed out,
-- and set null on account deletion so the deck survives and simply loses its byline.
alter table decks add column if not exists owner_id int references accounts(id) on delete set null;
create index if not exists decks_owner_idx on decks (owner_id);
-- Dedupe is per poster now: two people sharing the same list under the same name each get
-- their own deck, rather than the second silently landing on the first one's. NULLS NOT
-- DISTINCT keeps signed-out posts collapsing together exactly as they did before.
drop index if exists decks_dedupe_v2_idx;
create unique index if not exists decks_dedupe_v3_idx on decks (card_key, name, listed, owner_id) nulls not distinct;
create index if not exists decks_created_idx on decks (created_at desc);

-- Game news: balance updates and patches, written by an admin. Below accounts, which it
-- references. Bodies are stored and rendered as plain text, never HTML.
create table if not exists news (
  id serial primary key,
  kind text not null,
  title text not null,
  body text not null,
  -- The official post this is about. Null when there is nothing to link to.
  source_url text,
  -- When the change happened, which is not when the row was written.
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set null on account deletion so the item survives and only loses its byline.
  author_id int references accounts(id) on delete set null
);
create index if not exists news_published_idx on news (published_at desc);

-- Stats tracker. A tracker key belongs to one person; games are uploaded by the PC tracker script.
create table if not exists trackers (
  id serial primary key,
  name text not null,
  token_hash text not null unique,
  -- Null for a key made before accounts existed, or by someone not signed in. The key stays
  -- the upload credential either way; the account only decides whose stats page shows it.
  account_id int references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  last_upload_at timestamptz
);
alter table trackers add column if not exists account_id int references accounts(id) on delete set null;
create index if not exists trackers_account_idx on trackers (account_id);

create table if not exists tracked_games (
  id serial primary key,
  tracker_id int not null references trackers(id) on delete cascade,
  -- sha256 of the Snap account ID, so the same game uploaded twice from one account is ignored
  -- while both players in a game can each upload their side.
  account_hash text not null,
  game_id text not null,
  played_at timestamptz not null,
  league text,
  battle_mode boolean not null default false,
  friendly boolean not null default false,
  result text not null check (result in ('win', 'loss', 'tie')),
  cubes int not null,
  final_cube_value int not null,
  snapped boolean not null default false,
  opponent_snapped boolean not null default false,
  conceded boolean not null default false,
  turns int,
  total_turns int,
  deck_name text,
  deck_cards text[] not null,
  deck_key text not null,
  opponent_name text,
  opponent_cards text[] not null default '{}',
  cards_drawn text[] not null default '{}',
  cards_played text[] not null default '{}',
  locations text[] not null default '{}',
  -- [{location, player, opponent}] per location at the end of the game. Null for games
  -- recorded before this was captured, which is why nothing reads it without a fallback.
  board jsonb
);
alter table tracked_games add column if not exists board jsonb;
create unique index if not exists tracked_games_dedupe_idx on tracked_games (game_id, account_hash);
create index if not exists tracked_games_time_idx on tracked_games (played_at desc);
create index if not exists tracked_games_tracker_idx on tracked_games (tracker_id, played_at desc);

-- Display names a tracker has seen one Snap account using. The leaderboard has no player IDs,
-- so this is the only direct evidence of a rename the site can get; everything else is inference
-- from scores. The account is whatever the uploader's client said it was, and a game file is
-- client-supplied, so these rows are evidence for a person to weigh and never something applied
-- to the public board on their own.
create table if not exists snap_names (
  account_hash text not null,
  name text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  games int not null default 0,
  -- The signed-in account whose key reported this, when there was one. A Discord account is
  -- the only identity here that somebody had to prove; the Snap account id arrives in a header
  -- the uploader sets. Null means the key belongs to nobody in particular, which is weaker
  -- evidence rather than no evidence.
  account_id int references accounts(id) on delete set null,
  primary key (account_hash, name)
);
create index if not exists snap_names_name_idx on snap_names (name);

create table if not exists meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
`;
