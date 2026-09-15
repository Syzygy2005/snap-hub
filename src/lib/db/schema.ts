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

create table if not exists decks (
  id text primary key,
  name text not null,
  cards text[] not null,
  card_key text not null,
  created_at timestamptz not null default now(),
  views int not null default 0
);
create unique index if not exists decks_dedupe_idx on decks (card_key, name);
create index if not exists decks_created_idx on decks (created_at desc);

-- Stats tracker. A tracker key belongs to one person; games are uploaded by the PC tracker script.
create table if not exists trackers (
  id serial primary key,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_upload_at timestamptz
);

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
  locations text[] not null default '{}'
);
create unique index if not exists tracked_games_dedupe_idx on tracked_games (game_id, account_hash);
create index if not exists tracked_games_time_idx on tracked_games (played_at desc);
create index if not exists tracked_games_tracker_idx on tracked_games (tracker_id, played_at desc);

create table if not exists meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
`;
