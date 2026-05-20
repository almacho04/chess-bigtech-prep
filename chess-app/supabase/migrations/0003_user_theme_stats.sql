-- chess-bigtech-prep · migration 0003
-- Persistent per-user strengths/weaknesses by training theme.
-- Run this in the Supabase SQL Editor after 0002_puzzle_attempts.sql.
-- Idempotent — safe to re-run.

create table if not exists public.user_theme_stats (
  user_id             uuid not null references auth.users (id) on delete cascade,
  theme               text not null check (
    theme in ('mateIn1', 'mateIn2', 'fork', 'pin', 'hangingPiece')
  ),
  attempts            int  not null default 0 check (attempts >= 0),
  successes           int  not null default 0 check (successes >= 0),
  failures            int  not null default 0 check (failures >= 0),
  xp                  int  not null default 0 check (xp >= 0),
  current_streak      int  not null default 0 check (current_streak >= 0),
  best_streak         int  not null default 0 check (best_streak >= 0),
  last_outcome        text check (last_outcome in ('pass', 'fail')),
  last_attempted_at   timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (user_id, theme),
  check (attempts = successes + failures)
);

create index if not exists user_theme_stats_user_theme_idx
  on public.user_theme_stats (user_id, theme);

alter table public.user_theme_stats enable row level security;

drop policy if exists "user_theme_stats_select_own" on public.user_theme_stats;
create policy "user_theme_stats_select_own"
  on public.user_theme_stats for select
  using ( auth.uid() = user_id );

drop policy if exists "user_theme_stats_insert_own" on public.user_theme_stats;
create policy "user_theme_stats_insert_own"
  on public.user_theme_stats for insert
  with check ( auth.uid() = user_id );

drop policy if exists "user_theme_stats_update_own" on public.user_theme_stats;
create policy "user_theme_stats_update_own"
  on public.user_theme_stats for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

drop policy if exists "user_theme_stats_delete_own" on public.user_theme_stats;
create policy "user_theme_stats_delete_own"
  on public.user_theme_stats for delete
  using ( auth.uid() = user_id );
