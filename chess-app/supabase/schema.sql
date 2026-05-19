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
  completed_at        timestamptz not null default now()
);

create index if not exists games_user_completed_idx
  on public.games (user_id, completed_at desc);

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
