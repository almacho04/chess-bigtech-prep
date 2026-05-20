/**
 * Derive a daily training streak from a list of attempt timestamps.
 *
 * Definition: a "day" is the user's local YYYY-MM-DD. The current streak is
 * the count of consecutive calendar days, ending today (or yesterday if the
 * user hasn't trained today yet but is still on time to keep it), on which
 * at least one puzzle attempt was recorded.
 */

export type StreakInfo = {
  /** Days in the current streak. 0 if no attempts in the last 2 days. */
  current: number;
  /** Longest streak in the input range. */
  longest: number;
  /** Did the user record at least one attempt today (local time)? */
  trainedToday: boolean;
  /** Most recent attempt date, or null if no attempts. */
  lastTrainedAt: Date | null;
};

function ymdLocal(d: Date): string {
  // YYYY-MM-DD in the runtime's local timezone (matches what the user sees).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return ymdLocal(dt);
}

export function computeStreak(
  dates: Date[],
  now: Date = new Date(),
): StreakInfo {
  if (dates.length === 0) {
    return {
      current: 0,
      longest: 0,
      trainedToday: false,
      lastTrainedAt: null,
    };
  }

  // Unique local-YMD strings, sorted ascending.
  const days = Array.from(new Set(dates.map(ymdLocal))).sort();
  const todayYmd = ymdLocal(now);
  const yesterdayYmd = addDays(todayYmd, -1);
  const trainedToday = days.includes(todayYmd);

  // Longest streak — scan ascending.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === addDays(days[i - 1], 1)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current streak — walk back from today (or yesterday) until a gap.
  let current = 0;
  const daySet = new Set(days);
  let cursor: string;
  if (trainedToday) {
    cursor = todayYmd;
  } else if (daySet.has(yesterdayYmd)) {
    cursor = yesterdayYmd;
  } else {
    cursor = "";
  }
  while (cursor && daySet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const lastTrainedAt = new Date(
    Math.max(...dates.map((d) => d.getTime())),
  );

  return { current, longest, trainedToday, lastTrainedAt };
}
