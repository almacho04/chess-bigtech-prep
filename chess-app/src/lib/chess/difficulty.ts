export type Difficulty = {
  id: "easy" | "medium" | "hard" | "master";
  label: string;
  description: string;
  skillLevel: number; // Stockfish UCI Skill Level option, 0–20
  depth: number;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Beginner — blunders often",
    skillLevel: 0,
    depth: 5,
  },
  {
    id: "medium",
    label: "Medium",
    description: "Club player",
    skillLevel: 8,
    depth: 10,
  },
  {
    id: "hard",
    label: "Hard",
    description: "Strong",
    skillLevel: 15,
    depth: 14,
  },
  {
    id: "master",
    label: "Master",
    description: "Full strength",
    skillLevel: 20,
    depth: 18,
  },
] as const;

export const DEFAULT_DIFFICULTY: Difficulty["id"] = "medium";

export function getDifficulty(id: Difficulty["id"]): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
