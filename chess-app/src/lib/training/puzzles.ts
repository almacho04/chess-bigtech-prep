/**
 * Hand-curated mate-in-1 puzzles. Each starting position is verified to have
 * at least one legal move that produces immediate checkmate.
 *
 * The solver accepts ANY user move that lands in a checkmate position — so
 * a puzzle with multiple mating moves still validates correctly without us
 * having to enumerate them.
 *
 * Tagged with `pack` so we can grow this into themed sets later (forks, pins,
 * mate-in-2, calculation drills under time pressure, etc).
 */

export type Difficulty = "easy" | "medium" | "hard";
export type Pack = "mates" | "tactics";

export type Puzzle = {
  id: string;
  title: string;
  prompt: string;
  fen: string;
  sideToMove: "w" | "b";
  difficulty: Difficulty;
  pack: Pack;
  hint?: string;
  /**
   * `goal` describes how the solver should validate the user's move.
   *  - `mate-in-1`: any move that produces checkmate is correct.
   */
  goal: "mate-in-1";
};

export const PUZZLES: readonly Puzzle[] = [
  {
    id: "backrank-rook",
    title: "Back-rank delivery",
    prompt: "White to move. Find checkmate in one.",
    fen: "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    sideToMove: "w",
    difficulty: "easy",
    pack: "mates",
    hint: "The 8th rank is wide open.",
    goal: "mate-in-1",
  },
  {
    id: "ladder-rooks",
    title: "Rook ladder",
    prompt: "White to move. Two rooks, one decisive blow.",
    fen: "7k/R7/8/8/8/8/8/R5K1 w - - 0 1",
    sideToMove: "w",
    difficulty: "easy",
    pack: "mates",
    hint: "Bring the back rook up.",
    goal: "mate-in-1",
  },
  {
    id: "queen-backrank",
    title: "Queen finishes the job",
    prompt: "White to move. The king is sealed in.",
    fen: "6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1",
    sideToMove: "w",
    difficulty: "easy",
    pack: "mates",
    hint: "The 8th rank again.",
    goal: "mate-in-1",
  },
  {
    id: "queen-king-pair",
    title: "Queen + king",
    prompt: "White to move. The king cuts off the escape squares.",
    fen: "5k2/8/5K2/8/8/8/8/3Q4 w - - 0 1",
    sideToMove: "w",
    difficulty: "easy",
    pack: "mates",
    hint: "Slide the queen along the 8th rank.",
    goal: "mate-in-1",
  },
  {
    id: "trade-the-rooks",
    title: "Trade for the win",
    prompt: "White to move. The rook lift produces mate.",
    fen: "r5k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    sideToMove: "w",
    difficulty: "medium",
    pack: "mates",
    hint: "Capture and check at the same time.",
    goal: "mate-in-1",
  },
  {
    id: "black-backrank",
    title: "Same idea, mirrored",
    prompt: "Black to move. Find checkmate in one.",
    fen: "3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
    sideToMove: "b",
    difficulty: "easy",
    pack: "mates",
    hint: "The 1st rank is the new 8th rank.",
    goal: "mate-in-1",
  },
];

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export function getPuzzlesByPack(pack: Pack): Puzzle[] {
  return PUZZLES.filter((p) => p.pack === pack);
}

/**
 * Deterministic daily puzzle selection — same puzzle for everyone on the
 * same UTC day, rotating once per day.
 */
export function getDailyPuzzle(now: Date = new Date()): Puzzle {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000);
  return PUZZLES[dayOfYear % PUZZLES.length];
}
