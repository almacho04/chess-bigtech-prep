import type { SupabaseClient } from "@supabase/supabase-js";
import { applyOutcome, nextReviewAt } from "@/lib/training/sm2";

export type AttemptOutcome = "pass" | "fail";

export type PuzzleAttemptRow = {
  user_id: string;
  puzzle_id: string;
  consecutive_correct: number;
  last_outcome: AttemptOutcome;
  last_attempted_at: string;
  next_review_at: string;
};

/**
 * Record an attempt on a puzzle. Upserts into puzzle_attempts and advances the
 * spaced-repetition schedule. Silently no-ops if the user is signed out.
 */
export async function recordAttempt(
  supabase: SupabaseClient,
  puzzleId: string,
  outcome: AttemptOutcome,
): Promise<PuzzleAttemptRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: existing } = await supabase
    .from("puzzle_attempts")
    .select("consecutive_correct")
    .eq("user_id", userId)
    .eq("puzzle_id", puzzleId)
    .maybeSingle();

  const prevStreak = existing?.consecutive_correct ?? 0;
  const newStreak = applyOutcome(prevStreak, outcome);
  const review = nextReviewAt(newStreak);
  const now = new Date();

  const { data, error } = await supabase
    .from("puzzle_attempts")
    .upsert(
      {
        user_id: userId,
        puzzle_id: puzzleId,
        consecutive_correct: newStreak,
        last_outcome: outcome,
        last_attempted_at: now.toISOString(),
        next_review_at: review.toISOString(),
      },
      { onConflict: "user_id,puzzle_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[recordAttempt] upsert failed", error);
    return null;
  }
  return data as PuzzleAttemptRow;
}

/**
 * List puzzle_ids whose next_review_at has passed. Returns at most `limit`
 * rows ordered by oldest-due first.
 */
export async function listDueToday(
  supabase: SupabaseClient,
  limit = 50,
): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("puzzle_attempts")
    .select("puzzle_id, next_review_at")
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[listDueToday] select failed", error);
    return [];
  }
  return (data ?? []).map((r) => r.puzzle_id as string);
}
