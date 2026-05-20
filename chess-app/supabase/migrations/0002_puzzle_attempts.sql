-- chess-bigtech-prep · migration 0002
-- Spaced-repetition state for the /training puzzle queue.
-- Run this in the Supabase SQL Editor after the original schema.sql.
-- Idempotent — safe to re-run.

create table if not exists public.puzzle_attempts (
  user_id             uuid not null references auth.users (id) on delete cascade,
  puzzle_id           text not null,
  -- How many times in a row the user has passed this puzzle. Resets to 0 on fail.
  consecutive_correct int  not null default 0,
  last_outcome        text not null check ( last_outcome in ('pass', 'fail') ),
  last_attempted_at   timestamptz not null default now(),
  -- When this puzzle should next surface in "Due today".
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
