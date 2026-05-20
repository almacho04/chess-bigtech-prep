-- chess-bigtech-prep · migration 0004
-- Persisted Stockfish coach analyses for completed games.
-- Run this in the Supabase SQL Editor after 0003_user_theme_stats.sql.
-- Idempotent — safe to re-run.

create table if not exists public.game_analyses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  game_id             uuid not null references public.games (id) on delete cascade,
  analysis_depth      int  not null default 8 check (analysis_depth > 0),
  inaccuracy_count    int  not null default 0 check (inaccuracy_count >= 0),
  mistake_count       int  not null default 0 check (mistake_count >= 0),
  blunder_count       int  not null default 0 check (blunder_count >= 0),
  top_weaknesses      text[] not null default '{}',
  summary             text not null,
  blunders            jsonb not null default '[]'::jsonb,
  analyzed_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, game_id)
);

create index if not exists game_analyses_user_analyzed_idx
  on public.game_analyses (user_id, analyzed_at desc);

create index if not exists game_analyses_game_idx
  on public.game_analyses (game_id);

alter table public.game_analyses enable row level security;

drop policy if exists "game_analyses_select_own" on public.game_analyses;
create policy "game_analyses_select_own"
  on public.game_analyses for select
  using ( auth.uid() = user_id );

drop policy if exists "game_analyses_insert_own" on public.game_analyses;
create policy "game_analyses_insert_own"
  on public.game_analyses for insert
  with check ( auth.uid() = user_id );

drop policy if exists "game_analyses_update_own" on public.game_analyses;
create policy "game_analyses_update_own"
  on public.game_analyses for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

drop policy if exists "game_analyses_delete_own" on public.game_analyses;
create policy "game_analyses_delete_own"
  on public.game_analyses for delete
  using ( auth.uid() = user_id );
