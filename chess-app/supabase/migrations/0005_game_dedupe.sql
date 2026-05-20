-- chess-bigtech-prep · migration 0005
-- Prevent duplicate completed-game rows when an already-finished localStorage
-- game is rehydrated and auto-save runs again.
-- Run this in the Supabase SQL Editor after 0004_game_analyses.sql.
-- Idempotent — safe to re-run.

alter table public.games
  add column if not exists game_hash text generated always as (
    md5(
      mode
      || '|'
      || coalesce(opponent_difficulty, '')
      || '|'
      || coalesce(human_color, '')
      || '|'
      || result
      || '|'
      || pgn
    )
  ) stored;

-- Remove exact duplicate completed games before adding the unique index.
-- Prefer keeping a row that already has an analysis; otherwise keep the newest.
with ranked as (
  select
    g.id,
    row_number() over (
      partition by g.user_id, g.game_hash
      order by
        case when ga.id is null then 0 else 1 end desc,
        g.completed_at desc,
        g.id desc
    ) as rn
  from public.games g
  left join public.game_analyses ga on ga.game_id = g.id
  where g.game_hash is not null
)
delete from public.games g
using ranked r
where g.id = r.id
  and r.rn > 1;

create unique index if not exists games_user_game_hash_unique
  on public.games (user_id, game_hash);
