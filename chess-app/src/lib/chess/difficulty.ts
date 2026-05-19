export type Difficulty = {
  id: "easy" | "medium" | "hard" | "master";
  label: string;
  description: string;
  /** UCI Skill Level option (0–20). Controls how strong Stockfish plays. */
  skillLevel: number;
  /** Time budget per move in milliseconds. Caps how long the engine "thinks." */
  movetimeMs: number;
  /** Max search depth as a secondary cap; engine stops at min(time, depth). */
  maxDepth: number;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Beginner — blunders often",
    skillLevel: 0,
    movetimeMs: 200,
    maxDepth: 5,
  },
  {
    id: "medium",
    label: "Medium",
    description: "Club player",
    skillLevel: 8,
    movetimeMs: 500,
    maxDepth: 10,
  },
  {
    id: "hard",
    label: "Hard",
    description: "Strong",
    skillLevel: 15,
    movetimeMs: 1200,
    maxDepth: 14,
  },
  {
    id: "master",
    label: "Master",
    description: "Full strength",
    skillLevel: 20,
    movetimeMs: 2000,
    maxDepth: 18,
  },
] as const;

export const DEFAULT_DIFFICULTY: Difficulty["id"] = "medium";

export function getDifficulty(id: Difficulty["id"]): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
