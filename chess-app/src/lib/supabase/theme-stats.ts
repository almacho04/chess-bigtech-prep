import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClusterId } from "@/lib/training/clusters";
import type { AttemptOutcome } from "./puzzle-attempts";

export type ThemeStatRow = {
  user_id: string;
  theme: ClusterId;
  /** Legacy aggregate kept for older rows; now mirrors puzzle attempts. */
  attempts: number;
  successes: number;
  failures: number;
  xp: number;
  current_streak: number;
  best_streak: number;
  last_outcome: AttemptOutcome | null;
  last_attempted_at: string | null;
  puzzle_attempts?: number | null;
  puzzle_successes?: number | null;
  puzzle_failures?: number | null;
  game_mistake_signals?: number | null;
  game_weakness_score?: number | null;
  last_signal_source?: ThemeSignalSource | null;
  updated_at: string;
};

export type ThemeStatSummary = ThemeStatRow & {
  puzzleAttempts: number;
  puzzleSuccesses: number;
  puzzleFailures: number;
  gameMistakeSignals: number;
  gameWeaknessScore: number;
  accuracy: number;
  puzzleWeaknessScore: number;
  weaknessScore: number;
};

export type ThemeSignalSource = "puzzle" | "game";

const XP_BY_OUTCOME: Record<AttemptOutcome, number> = {
  pass: 25,
  fail: 5,
};

export async function recordThemeAttempt(
  supabase: SupabaseClient,
  theme: ClusterId,
  outcome: AttemptOutcome,
): Promise<ThemeStatRow | null> {
  const rpcRow = await recordThemeSignalViaRpc(supabase, {
    theme,
    outcome,
    source: "puzzle",
    weight: 1,
  });
  if (rpcRow) return rpcRow;
  return recordThemeAttemptFallback(supabase, theme, outcome);
}

export async function recordThemeGameSignal(
  supabase: SupabaseClient,
  theme: ClusterId,
  weight = 1,
): Promise<ThemeStatRow | null> {
  const normalizedWeight = Math.max(1, Math.round(weight));
  const rpcRow = await recordThemeSignalViaRpc(supabase, {
    theme,
    outcome: null,
    source: "game",
    weight: normalizedWeight,
  });
  if (rpcRow) return rpcRow;
  return recordThemeGameSignalFallback(supabase, theme, normalizedWeight);
}

async function recordThemeSignalViaRpc(
  supabase: SupabaseClient,
  input: {
    theme: ClusterId;
    outcome: AttemptOutcome | null;
    source: ThemeSignalSource;
    weight: number;
  },
): Promise<ThemeStatRow | null> {
  const { data, error } = await supabase.rpc("record_theme_signal", {
    p_theme: input.theme,
    p_outcome: input.outcome,
    p_source: input.source,
    p_weight: input.weight,
  });

  if (error) {
    console.warn("[recordThemeSignal] rpc unavailable", error);
    return null;
  }

  return data ? (data as ThemeStatRow) : null;
}

/**
 * Fallback for projects that have not run migration 0006 yet. This keeps puzzle
 * recording alive on older databases; the RPC path above is the atomic path.
 */
async function recordThemeAttemptFallback(
  supabase: SupabaseClient,
  theme: ClusterId,
  outcome: AttemptOutcome,
): Promise<ThemeStatRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: existing, error: readError } = await supabase
    .from("user_theme_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("theme", theme)
    .maybeSingle();

  if (readError) {
    console.error("[recordThemeAttempt] select failed", readError);
    return null;
  }

  const prev = existing as ThemeStatRow | null;
  const pass = outcome === "pass";
  const currentStreak = pass ? (prev?.current_streak ?? 0) + 1 : 0;
  const bestStreak = Math.max(prev?.best_streak ?? 0, currentStreak);
  const attempts = (prev?.attempts ?? 0) + 1;
  const successes = (prev?.successes ?? 0) + (pass ? 1 : 0);
  const failures = (prev?.failures ?? 0) + (pass ? 0 : 1);
  const puzzleAttempts = (prev?.puzzle_attempts ?? prev?.attempts ?? 0) + 1;
  const puzzleSuccesses =
    (prev?.puzzle_successes ?? prev?.successes ?? 0) + (pass ? 1 : 0);
  const puzzleFailures =
    (prev?.puzzle_failures ?? prev?.failures ?? 0) + (pass ? 0 : 1);
  const now = new Date().toISOString();

  const nextRow = {
    user_id: userId,
    theme,
    attempts,
    successes,
    failures,
    xp: (prev?.xp ?? 0) + XP_BY_OUTCOME[outcome],
    current_streak: currentStreak,
    best_streak: bestStreak,
    last_outcome: outcome,
    last_attempted_at: now,
    puzzle_attempts: puzzleAttempts,
    puzzle_successes: puzzleSuccesses,
    puzzle_failures: puzzleFailures,
    game_mistake_signals: prev?.game_mistake_signals ?? 0,
    game_weakness_score: prev?.game_weakness_score ?? 0,
    last_signal_source: "puzzle" satisfies ThemeSignalSource,
    updated_at: now,
  };

  const modern = await supabase
    .from("user_theme_stats")
    .upsert(
      nextRow,
      { onConflict: "user_id,theme" },
    )
    .select("*")
    .single();

  if (!modern.error) return modern.data as ThemeStatRow;

  const { data, error } = await supabase
    .from("user_theme_stats")
    .upsert(
      {
        user_id: userId,
        theme,
        attempts,
        successes,
        failures,
        xp: nextRow.xp,
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_outcome: outcome,
        last_attempted_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,theme" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[recordThemeAttempt] fallback upsert failed", error);
    return null;
  }

  return data as ThemeStatRow;
}

async function recordThemeGameSignalFallback(
  supabase: SupabaseClient,
  theme: ClusterId,
  weight: number,
): Promise<ThemeStatRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: existing, error: readError } = await supabase
    .from("user_theme_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("theme", theme)
    .maybeSingle();

  if (readError) {
    console.error("[recordThemeGameSignal] select failed", readError);
    return null;
  }

  const prev = existing as ThemeStatRow | null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_theme_stats")
    .upsert(
      {
        user_id: userId,
        theme,
        attempts: prev?.attempts ?? 0,
        successes: prev?.successes ?? 0,
        failures: prev?.failures ?? 0,
        xp: prev?.xp ?? 0,
        current_streak: prev?.current_streak ?? 0,
        best_streak: prev?.best_streak ?? 0,
        last_outcome: prev?.last_outcome ?? null,
        last_attempted_at: prev?.last_attempted_at ?? null,
        puzzle_attempts: prev?.puzzle_attempts ?? prev?.attempts ?? 0,
        puzzle_successes: prev?.puzzle_successes ?? prev?.successes ?? 0,
        puzzle_failures: prev?.puzzle_failures ?? prev?.failures ?? 0,
        game_mistake_signals: (prev?.game_mistake_signals ?? 0) + 1,
        game_weakness_score: (prev?.game_weakness_score ?? 0) + weight,
        last_signal_source: "game" satisfies ThemeSignalSource,
        updated_at: now,
      },
      { onConflict: "user_id,theme" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[recordThemeGameSignal] fallback upsert failed", error);
    return null;
  }

  return data as ThemeStatRow;
}

export async function listThemeStats(
  supabase: SupabaseClient,
): Promise<ThemeStatRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_theme_stats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[listThemeStats] select failed", error);
    return [];
  }

  return (data ?? []) as ThemeStatRow[];
}

export function summarizeThemeStat(row: ThemeStatRow): ThemeStatSummary {
  const puzzleAttempts = row.puzzle_attempts ?? row.attempts ?? 0;
  const puzzleSuccesses = row.puzzle_successes ?? row.successes ?? 0;
  const puzzleFailures = row.puzzle_failures ?? row.failures ?? 0;
  const gameMistakeSignals = row.game_mistake_signals ?? 0;
  const gameWeaknessScore = row.game_weakness_score ?? 0;
  const accuracy =
    puzzleAttempts === 0 ? 0 : puzzleSuccesses / puzzleAttempts;
  const puzzleWeaknessScore =
    puzzleFailures * 3 + Math.max(0, 1 - accuracy) * puzzleAttempts;
  return {
    ...row,
    puzzleAttempts,
    puzzleSuccesses,
    puzzleFailures,
    gameMistakeSignals,
    gameWeaknessScore,
    accuracy,
    puzzleWeaknessScore,
    weaknessScore: puzzleWeaknessScore + gameWeaknessScore,
  };
}

export function totalTutorXp(rows: readonly ThemeStatRow[]): number {
  return rows.reduce((sum, row) => sum + row.xp, 0);
}
