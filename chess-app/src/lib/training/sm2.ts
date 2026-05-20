/**
 * Simplified spaced-repetition schedule (a stripped-down SM-2). Each puzzle
 * has a single `consecutiveCorrect` counter that grows on each pass and
 * resets to zero on a fail.
 *
 *   pass attempt #N  →  due in INTERVALS_DAYS[clamp(N, end)] days
 *   any fail         →  due tomorrow (interval reset)
 */

export const INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30, 60];

const MS_PER_DAY = 86_400_000;

export function nextReviewAt(
  consecutiveCorrect: number,
  now: number = Date.now(),
): Date {
  const idx = Math.max(
    0,
    Math.min(consecutiveCorrect, INTERVALS_DAYS.length - 1),
  );
  return new Date(now + INTERVALS_DAYS[idx] * MS_PER_DAY);
}

/**
 * Given the previous streak and a new attempt outcome, return the next streak.
 */
export function applyOutcome(
  prevStreak: number,
  outcome: "pass" | "fail",
): number {
  return outcome === "pass" ? prevStreak + 1 : 0;
}
