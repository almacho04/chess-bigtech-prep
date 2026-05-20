import type { ClusterId } from "@/lib/training/clusters";
import type { Severity } from "./analyze";

export type ThemedMistake = {
  themes: readonly ClusterId[];
  severity: Severity;
};

export function topWeaknessesFrom(
  mistakes: readonly ThemedMistake[],
  limit = 3,
): ClusterId[] {
  return scoreWeaknessesFrom(mistakes, limit).map(({ theme }) => theme);
}

export function scoreWeaknessesFrom(
  mistakes: readonly ThemedMistake[],
  limit = 3,
): Array<{ theme: ClusterId; score: number }> {
  const scores = new Map<ClusterId, number>();
  for (const mistake of mistakes) {
    const weight = severityWeight(mistake.severity);
    for (const theme of mistake.themes) {
      scores.set(theme, (scores.get(theme) ?? 0) + weight);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([theme, score]) => ({ theme, score }));
}

function severityWeight(severity: Severity): number {
  if (severity === "blunder") return 4;
  if (severity === "mistake") return 2;
  return 1;
}
