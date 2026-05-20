import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClusterId } from "@/lib/training/clusters";
import type { AttemptOutcome } from "./puzzle-attempts";

export type ThemeStatRow = {
  user_id: string;
  theme: ClusterId;
  attempts: number;
  successes: number;
  failures: number;
  xp: number;
  current_streak: number;
  best_streak: number;
  last_outcome: AttemptOutcome | null;
  last_attempted_at: string | null;
  updated_at: string;
};

export type ThemeStatSummary = ThemeStatRow & {
  accuracy: number;
  weaknessScore: number;
};

const XP_BY_OUTCOME: Record<AttemptOutcome, number> = {
  pass: 25,
  fail: 5,
};

/**
 * Update the user's persistent tutor memory for a training theme. This is a
 * lightweight MVP counter, not a high-contention leaderboard path, so a
 * read-then-upsert is enough and keeps the SQL easy to inspect.
 */
export async function recordThemeAttempt(
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
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_theme_stats")
    .upsert(
      {
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
        updated_at: now,
      },
      { onConflict: "user_id,theme" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[recordThemeAttempt] upsert failed", error);
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
  const accuracy = row.attempts === 0 ? 0 : row.successes / row.attempts;
  const weaknessScore =
    row.failures * 3 + Math.max(0, 1 - accuracy) * row.attempts;
  return {
    ...row,
    accuracy,
    weaknessScore,
  };
}

export function totalTutorXp(rows: readonly ThemeStatRow[]): number {
  return rows.reduce((sum, row) => sum + row.xp, 0);
}
