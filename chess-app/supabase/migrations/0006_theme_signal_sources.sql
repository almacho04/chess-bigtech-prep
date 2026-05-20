-- chess-bigtech-prep · migration 0006
-- Split puzzle accuracy from real-game tutor memory and record theme signals
-- atomically through a Postgres RPC.
-- Run this in the Supabase SQL Editor after 0005_game_dedupe.sql.
-- Idempotent — safe to re-run.

alter table public.user_theme_stats
  add column if not exists puzzle_attempts int not null default 0 check (puzzle_attempts >= 0),
  add column if not exists puzzle_successes int not null default 0 check (puzzle_successes >= 0),
  add column if not exists puzzle_failures int not null default 0 check (puzzle_failures >= 0),
  add column if not exists game_mistake_signals int not null default 0 check (game_mistake_signals >= 0),
  add column if not exists game_weakness_score int not null default 0 check (game_weakness_score >= 0),
  add column if not exists last_signal_source text check (last_signal_source in ('puzzle', 'game'));

-- Move game-review tags that older app versions wrote as fake puzzle failures
-- into the new game counters. Guard on game_mistake_signals = 0 so re-running
-- this migration will not subtract repeatedly.
do $$
begin
  if to_regclass('public.game_analyses') is not null then
    with game_counts as (
      select
        ga.user_id,
        theme,
        count(*)::int as signals
      from public.game_analyses ga
      cross join unnest(ga.top_weaknesses) as themes(theme)
      group by ga.user_id, theme
    )
    update public.user_theme_stats uts
    set
      failures = greatest(0, uts.failures - game_counts.signals),
      attempts = uts.successes + greatest(0, uts.failures - game_counts.signals),
      xp = greatest(0, uts.xp - (game_counts.signals * 5)),
      game_mistake_signals = game_counts.signals,
      game_weakness_score = game_counts.signals * 3,
      last_signal_source = 'game',
      updated_at = now()
    from game_counts
    where uts.user_id = game_counts.user_id
      and uts.theme = game_counts.theme
      and uts.game_mistake_signals = 0;
  end if;
end;
$$;

-- Backfill remaining older tutor rows as puzzle rows. Future game reviews no
-- longer touch these puzzle counters.
update public.user_theme_stats
set
  puzzle_attempts = attempts,
  puzzle_successes = successes,
  puzzle_failures = failures,
  last_signal_source = coalesce(last_signal_source, 'puzzle')
where puzzle_attempts = 0
  and attempts > 0;

do $$
begin
  alter table public.user_theme_stats
    add constraint user_theme_stats_puzzle_counts_check
    check (puzzle_attempts = puzzle_successes + puzzle_failures);
exception
  when duplicate_object then null;
end;
$$;

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
      user_id,
      theme,
      attempts,
      successes,
      failures,
      xp,
      current_streak,
      best_streak,
      puzzle_attempts,
      puzzle_successes,
      puzzle_failures,
      game_mistake_signals,
      game_weakness_score,
      last_signal_source,
      updated_at
    )
    values (
      v_user_id,
      p_theme,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      v_weight,
      'game',
      v_now
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
    user_id,
    theme,
    attempts,
    successes,
    failures,
    xp,
    current_streak,
    best_streak,
    last_outcome,
    last_attempted_at,
    puzzle_attempts,
    puzzle_successes,
    puzzle_failures,
    game_mistake_signals,
    game_weakness_score,
    last_signal_source,
    updated_at
  )
  values (
    v_user_id,
    p_theme,
    1,
    case when v_pass then 1 else 0 end,
    case when v_pass then 0 else 1 end,
    case when v_pass then 25 else 5 end,
    case when v_pass then 1 else 0 end,
    case when v_pass then 1 else 0 end,
    p_outcome,
    v_now,
    1,
    case when v_pass then 1 else 0 end,
    case when v_pass then 0 else 1 end,
    0,
    0,
    'puzzle',
    v_now
  )
  on conflict (user_id, theme) do update
  set
    attempts = public.user_theme_stats.attempts + 1,
    successes = public.user_theme_stats.successes + case when v_pass then 1 else 0 end,
    failures = public.user_theme_stats.failures + case when v_pass then 0 else 1 end,
    xp = public.user_theme_stats.xp + case when v_pass then 25 else 5 end,
    current_streak = case
      when v_pass then public.user_theme_stats.current_streak + 1
      else 0
    end,
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
