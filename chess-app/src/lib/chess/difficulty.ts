export type Difficulty = {
  id: "easy" | "medium" | "hard" | "master";
  label: string;
  description: string;
  /** UCI Skill Level option (0–20). Controls how strong Stockfish plays. */
  skillLevel: number;
  /**
   * Max search depth. Stockfish.js v10 reliably honours `go depth N`;
   * `go movetime` is unreliable in this build, so depth is the cap we use.
   */
  depth: number;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Beginner — blunders often",
    skillLevel: 0,
    depth: 4,
  },
  {
    id: "medium",
    label: "Medium",
    description: "Club player",
    skillLevel: 8,
    depth: 7,
  },
  {
    id: "hard",
    label: "Hard",
    description: "Strong",
    skillLevel: 15,
    depth: 10,
  },
  {
    id: "master",
    label: "Master",
    description: "Full strength",
    skillLevel: 20,
    depth: 13,
  },
] as const;

export const DEFAULT_DIFFICULTY: Difficulty["id"] = "medium";

export function getDifficulty(id: Difficulty["id"]): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
