import type { StreakInfo } from "@/lib/training/streak";

/**
 * Visual streak indicator for the training header. Returns null for
 * signed-out users (caller decides) or when there's no data yet.
 */
export function StreakBadge({ streak }: { streak: StreakInfo | null }) {
  if (!streak) return null;

  if (streak.current === 0 && !streak.trainedToday) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 py-1 text-xs text-foreground/60">
        <span aria-hidden>🔥</span>
        Train today to start a streak
      </span>
    );
  }

  const atRisk = streak.current >= 1 && !streak.trainedToday;
  const palette = atRisk
    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${palette}`}
      title={`Longest streak: ${streak.longest} day${streak.longest === 1 ? "" : "s"}`}
    >
      <span aria-hidden>🔥</span>
      {streak.current}-day streak
      <span className="text-[10px] font-normal opacity-80">
        · {streak.trainedToday ? "trained today ✓" : "train today to keep it"}
      </span>
    </span>
  );
}

/**
 * Soft amber banner shown above the training content when the user has an
 * active streak but hasn't trained today.
 */
export function StreakBanner({ streak }: { streak: StreakInfo | null }) {
  if (!streak) return null;
  if (streak.current < 2) return null;
  if (streak.trainedToday) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      Don&rsquo;t break your {streak.current}-day streak — one puzzle today
      keeps it alive.
    </div>
  );
}
