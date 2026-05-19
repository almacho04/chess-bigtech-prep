export type Difficulty = {
  id: "easy" | "medium" | "hard" | "master";
  label: string;
  description: string;
  /** UCI Skill Level option (0–20). Controls how strong Stockfish plays. */
  skillLevel: number;
  /** Time budget per move in milliseconds. Caps the engine's "thinking" time. */
  movetimeMs: number;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Beginner — blunders often",
    skillLevel: 0,
    movetimeMs: 300,
  },
  {
    id: "medium",
    label: "Medium",
    description: "Club player",
    skillLevel: 8,
    movetimeMs: 700,
  },
  {
    id: "hard",
    label: "Hard",
    description: "Strong",
    skillLevel: 15,
    movetimeMs: 1500,
  },
  {
    id: "master",
    label: "Master",
    description: "Full strength",
    skillLevel: 20,
    movetimeMs: 2500,
  },
] as const;

export const DEFAULT_DIFFICULTY: Difficulty["id"] = "medium";

export function getDifficulty(id: Difficulty["id"]): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
