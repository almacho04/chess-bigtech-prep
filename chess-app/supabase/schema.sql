-- chess-bigtech-prep · Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Idempotent: safe to re-run; uses IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------
-- profiles: per-user app metadata, 1:1 with auth.users
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  city         text,
  elo          int  not null default 1200,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- Auto-insert a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- games: one row per completed game
-- ---------------------------------------------------------------
create table if not exists public.games (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  mode                text not null check ( mode in ('local', 'ai') ),
  opponent_difficulty text check ( opponent_difficulty in ('easy', 'medium', 'hard', 'master') ),
  human_color         text check ( human_color in ('w', 'b') ),
  pgn                 text not null,
  result              text not null check ( result in ('1-0', '0-1', '1/2-1/2', '*') ),
  move_count          int  not null default 0,
  completed_at        timestamptz not null default now(),
  game_hash           text generated always as (
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
  ) stored
);

create index if not exists games_user_completed_idx
  on public.games (user_id, completed_at desc);

create unique index if not exists games_user_game_hash_unique
  on public.games (user_id, game_hash);

alter table public.games enable row level security;

drop policy if exists "games_select_own"  on public.games;
create policy "games_select_own"
  on public.games for select
  using ( auth.uid() = user_id );

drop policy if exists "games_insert_own"  on public.games;
create policy "games_insert_own"
  on public.games for insert
  with check ( auth.uid() = user_id );

drop policy if exists "games_update_own"  on public.games;
create policy "games_update_own"
  on public.games for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

drop policy if exists "games_delete_own"  on public.games;
create policy "games_delete_own"
  on public.games for delete
  using ( auth.uid() = user_id );

-- ---------------------------------------------------------------
-- puzzle_attempts: spaced-repetition state for training puzzles
-- ---------------------------------------------------------------
create table if not exists public.puzzle_attempts (
  user_id             uuid not null references auth.users (id) on delete cascade,
  puzzle_id           text not null,
  consecutive_correct int  not null default 0,
  last_outcome        text not null check ( last_outcome in ('pass', 'fail') ),
  last_attempted_at   timestamptz not null default now(),
  next_review_at      timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);

create index if not exists puzzle_attempts_due_idx
  on public.puzzle_attempts (user_id, next_review_at);

alter table public.puzzle_attempts enable row level security;

drop policy if exists "puzzle_attempts_select_own" on public.puzzle_attempts;
create policy "puzzle_attempts_select_own"
  on public.puzzle_attempts for select
  using ( auth.uid() = user_id );

drop policy if exists "puzzle_attempts_insert_own" on public.puzzle_attempts;
create policy "puzzle_attempts_insert_own"
  on public.puzzle_attempts for insert
  with check ( auth.uid() = user_id );

drop policy if exists "puzzle_attempts_update_own" on public.puzzle_attempts;
create policy "puzzle_attempts_update_own"
  on public.puzzle_attempts for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

drop policy if exists "puzzle_attempts_delete_own" on public.puzzle_attempts;
create policy "puzzle_attempts_delete_own"
  on public.puzzle_attempts for delete
  using ( auth.uid() = user_id );

-- ---------------------------------------------------------------
-- user_theme_stats: tutor memory split by puzzle and game sources
-- ---------------------------------------------------------------
create table if not exists public.user_theme_stats (
  user_id              uuid not null references auth.users (id) on delete cascade,
  theme                text not null check (
    theme in ('mateIn1', 'mateIn2', 'fork', 'pin', 'hangingPiece')
  ),
  attempts             int  not null default 0 check (attempts >= 0),
  successes            int  not null default 0 check (successes >= 0),
  failures             int  not null default 0 check (failures >= 0),
  xp                   int  not null default 0 check (xp >= 0),
  current_streak       int  not null default 0 check (current_streak >= 0),
  best_streak          int  not null default 0 check (best_streak >= 0),
  last_outcome         text check (last_outcome in ('pass', 'fail')),
  last_attempted_at    timestamptz,
  puzzle_attempts      int  not null default 0 check (puzzle_attempts >= 0),
  puzzle_successes     int  not null default 0 check (puzzle_successes >= 0),
  puzzle_failures      int  not null default 0 check (puzzle_failures >= 0),
  game_mistake_signals int  not null default 0 check (game_mistake_signals >= 0),
  game_weakness_score  int  not null default 0 check (game_weakness_score >= 0),
  last_signal_source   text check (last_signal_source in ('puzzle', 'game')),
  updated_at           timestamptz not null default now(),
  primary key (user_id, theme),
  check (attempts = successes + failures),
  check (puzzle_attempts = puzzle_successes + puzzle_failures)
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

-- ---------------------------------------------------------------
-- game_analyses: persisted AI Coach reviews
-- ---------------------------------------------------------------
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

create or replace function public.record_theme_signal(
  p_theme text,
  p_outcome text default null,
  p_source text default 'puzzle',
  p_weight int default 1
)
returns public.user_theme_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_pass boolean;
  v_weight int := greatest(1, coalesce(p_weight, 1));
  v_row public.user_theme_stats;
begin
  if v_user_id is null then
    return null;
  end if;

  if p_theme not in ('mateIn1', 'mateIn2', 'fork', 'pin', 'hangingPiece') then
    raise exception 'unsupported theme: %', p_theme;
  end if;

  if p_source not in ('puzzle', 'game') then
    raise exception 'unsupported theme source: %', p_source;
  end if;

  if p_source = 'game' then
    insert into public.user_theme_stats (
      user_id, theme, attempts, successes, failures, xp,
      current_streak, best_streak, puzzle_attempts, puzzle_successes,
      puzzle_failures, game_mistake_signals, game_weakness_score,
      last_signal_source, updated_at
    )
    values (
      v_user_id, p_theme, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, v_weight,
      'game', v_now
    )
    on conflict (user_id, theme) do update
    set
      game_mistake_signals = public.user_theme_stats.game_mistake_signals + 1,
      game_weakness_score = public.user_theme_stats.game_weakness_score + v_weight,
      last_signal_source = 'game',
      updated_at = v_now
    returning * into v_row;

    return v_row;
  end if;

  if p_outcome not in ('pass', 'fail') then
    raise exception 'puzzle signals require pass/fail outcome';
  end if;

  v_pass := p_outcome = 'pass';

  insert into public.user_theme_stats (
    user_id, theme, attempts, successes, failures, xp, current_streak,
    best_streak, last_outcome, last_attempted_at, puzzle_attempts,
    puzzle_successes, puzzle_failures, game_mistake_signals,
    game_weakness_score, last_signal_source, updated_at
  )
  values (
    v_user_id, p_theme, 1,
    case when v_pass then 1 else 0 end,
    case when v_pass then 0 else 1 end,
    case when v_pass then 25 else 5 end,
    case when v_pass then 1 else 0 end,
    case when v_pass then 1 else 0 end,
    p_outcome, v_now, 1,
    case when v_pass then 1 else 0 end,
    case when v_pass then 0 else 1 end,
    0, 0, 'puzzle', v_now
  )
  on conflict (user_id, theme) do update
  set
    attempts = public.user_theme_stats.attempts + 1,
    successes = public.user_theme_stats.successes + case when v_pass then 1 else 0 end,
    failures = public.user_theme_stats.failures + case when v_pass then 0 else 1 end,
    xp = public.user_theme_stats.xp + case when v_pass then 25 else 5 end,
    current_streak = case when v_pass then public.user_theme_stats.current_streak + 1 else 0 end,
    best_streak = greatest(
      public.user_theme_stats.best_streak,
      case when v_pass then public.user_theme_stats.current_streak + 1 else 0 end
    ),
    last_outcome = p_outcome,
    last_attempted_at = v_now,
    puzzle_attempts = public.user_theme_stats.puzzle_attempts + 1,
    puzzle_successes = public.user_theme_stats.puzzle_successes + case when v_pass then 1 else 0 end,
    puzzle_failures = public.user_theme_stats.puzzle_failures + case when v_pass then 0 else 1 end,
    last_signal_source = 'puzzle',
    updated_at = v_now
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.record_theme_signal(text, text, text, int)
  to authenticated;
