/**
 * Training puzzle bank.
 *
 * Two sources are merged into a single read-only `PUZZLES` array:
 *
 * 1. **Hand-curated native puzzles** — already in our "post-setup" format
 *    (the FEN is the puzzle position, `solution` is the user's UCI moves).
 *
 * 2. **Lichess-derived puzzles** (CC0, from `Lichess/chess-puzzles`) — in their
 *    native format: FEN is the position BEFORE the opponent's setup move, and
 *    `moves[0]` is that setup. At module load we apply the setup with
 *    chess.js, so the rest of the app only sees the user-facing FEN and the
 *    user/opponent alternating solution.
 *
 * Validation strategy (see PuzzleSolver):
 *  - For `cluster === "mateIn1"` we accept ANY move that produces checkmate
 *    (some hand-curated positions have multiple mating moves and that's fine).
 *  - For every other cluster we require the user's move to match the next
 *    UCI in `solution` exactly; opponent replies are auto-played.
 */

import { Chess } from "chess.js";
import type { ClusterId } from "./clusters";

export type PromotionPiece = "q" | "r" | "b" | "n";
export type Difficulty = "easy" | "medium" | "hard";

export type Puzzle = {
  id: string;
  title: string;
  prompt: string;
  /** The position the user actually sees on the board. */
  fen: string;
  sideToMove: "w" | "b";
  difficulty: Difficulty;
  cluster: ClusterId;
  rating?: number;
  /**
   * Alternating user/opponent UCI moves, starting with the user's first move.
   * Length 1 for mate-in-1; longer for multi-step puzzles.
   */
  solution: string[];
  hint?: string;
};

// ---------------------------------------------------------------------------
// Native (hand-curated) puzzles. FEN is already the puzzle position.
// ---------------------------------------------------------------------------

type RawNative = Omit<Puzzle, "sideToMove">;

const NATIVE_PUZZLES: readonly RawNative[] = [
  {
    id: "native-backrank-rook",
    title: "Back-rank delivery",
    prompt: "White to move. Find checkmate in one.",
    fen: "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    difficulty: "easy",
    cluster: "mateIn1",
    solution: ["d1d8"],
    hint: "The 8th rank is wide open.",
  },
  {
    id: "native-ladder-rooks",
    title: "Rook ladder",
    prompt: "White to move. Two rooks, one decisive blow.",
    fen: "7k/R7/8/8/8/8/8/R5K1 w - - 0 1",
    difficulty: "easy",
    cluster: "mateIn1",
    solution: ["a1a8"],
    hint: "Bring the back rook up.",
  },
  {
    id: "native-queen-backrank",
    title: "Queen finishes the job",
    prompt: "White to move. The king is sealed in.",
    fen: "6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1",
    difficulty: "easy",
    cluster: "mateIn1",
    solution: ["e1e8"],
    hint: "The 8th rank again.",
  },
  {
    id: "native-queen-king-pair",
    title: "Queen + king",
    prompt: "White to move. The king cuts off the escape squares.",
    fen: "5k2/8/5K2/8/8/8/8/3Q4 w - - 0 1",
    difficulty: "easy",
    cluster: "mateIn1",
    solution: ["d1d8"],
    hint: "Slide the queen along the 8th rank.",
  },
  {
    id: "native-trade-the-rooks",
    title: "Trade for the win",
    prompt: "White to move. The rook lift produces mate.",
    fen: "r5k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    difficulty: "medium",
    cluster: "mateIn1",
    solution: ["a1a8"],
    hint: "Capture and check at the same time.",
  },
  {
    id: "native-black-backrank",
    title: "Same idea, mirrored",
    prompt: "Black to move. Find checkmate in one.",
    fen: "3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
    difficulty: "easy",
    cluster: "mateIn1",
    solution: ["d8d1"],
    hint: "The 1st rank is the new 8th rank.",
  },
];

// ---------------------------------------------------------------------------
// Lichess-derived puzzles (CC0, https://database.lichess.org/#puzzles)
// FEN is BEFORE the opponent's setup move; moves[0] is the setup.
// ---------------------------------------------------------------------------

type RawLichess = {
  /** PuzzleId from Lichess, prefixed with "lichess-". */
  id: string;
  /** FEN before the setup move. */
  startFen: string;
  /** Space-separated UCI moves: setup, user1, opp1, user2, ... */
  moves: string;
  rating: number;
  cluster: ClusterId;
};

// Note: a script could regenerate this list from the Lichess CSV by filtering
// by rating and theme. We embed a curated subset so /training works offline
// and the bundle stays small.
const LICHESS_PUZZLES: readonly RawLichess[] = [
  // === mateIn1 (rating 400 – 1500) ============================================
  { id: "lichess-001gi", startFen: "r6r/1pNk1ppp/2np4/b3p3/4P1b1/N1Q5/P4PPP/R3KB1R w KQ - 3 18", moves: "c7a8 a5c3", rating: 819, cluster: "mateIn1" },
  { id: "lichess-001KR", startFen: "6Qk/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K b - - 0 28", moves: "h8g8 f1f8", rating: 645, cluster: "mateIn1" },
  { id: "lichess-001wb", startFen: "r3k2r/pb1p1ppp/1b4q1/1Q2P3/8/2NP1Pn1/PP4PP/R1B2R1K w kq - 1 17", moves: "h2g3 g6h5", rating: 1144, cluster: "mateIn1" },
  { id: "lichess-002CP", startFen: "r5k1/pp4pp/4p1q1/4p3/3n4/P5P1/1PP2Q1P/2KR1R2 w - - 4 24", moves: "f2e3 g6c2", rating: 925, cluster: "mateIn1" },
  { id: "lichess-001pC", startFen: "r4rk1/pp3ppp/3b4/2p1pPB1/7N/2PP3n/PP4PP/R2Q1RqK w - - 5 18", moves: "f1g1 h3f2", rating: 870, cluster: "mateIn1" },
  { id: "lichess-002HE", startFen: "1qr2rk1/1p1p1ppp/pB2p1n1/7n/2P1P3/1Q2NP1P/PP2B1Pb/3R1RK1 w - - 1 20", moves: "g1f2 b8g3", rating: 1116, cluster: "mateIn1" },
  { id: "lichess-002Z9", startFen: "4r1k1/1p2R1p1/p2p2Pp/P1pP4/5q2/1R3p2/1P1Q3P/5B1K b - - 0 34", moves: "f4d2 e7e8", rating: 1231, cluster: "mateIn1" },
  { id: "lichess-002Q2", startFen: "7k/p4R1p/3p3r/2pN1n2/2PbBBb1/3P2P1/P3r3/5R1K w - - 1 28", moves: "f4h6 f5g3", rating: 925, cluster: "mateIn1" },
  { id: "lichess-001rZ", startFen: "2kr1b1r/p1p2pp1/2pqb3/7p/3N2n1/2NPB3/PPP2PPP/R2Q1RK1 w - - 2 13", moves: "d4e6 d6h2", rating: 523, cluster: "mateIn1" },
  { id: "lichess-004JD", startFen: "3r4/R7/2p5/p1P2p2/1p4k1/nP6/P2KNP2/8 w - - 3 41", moves: "d2e3 a3c2", rating: 1297, cluster: "mateIn1" },
  { id: "lichess-004iZ", startFen: "r2r2k1/2q1bpp1/3p1n1p/1ppN4/1P1BP3/P5Q1/PPP3PP/R5K1 b - - 1 20", moves: "f6d5 g3g7", rating: 449, cluster: "mateIn1" },
  { id: "lichess-004yJ", startFen: "r4rk1/1bp2ppp/p1q1pn2/2P5/8/3B1N2/P1P1QPPP/R4RK1 w - - 0 16", moves: "f3e5 c6g2", rating: 926, cluster: "mateIn1" },
  { id: "lichess-005Ep", startFen: "5kr1/ppR3p1/3R3p/8/1r1n4/8/1P3PPP/2K5 b - - 4 31", moves: "d4b5 d6d8", rating: 739, cluster: "mateIn1" },
  { id: "lichess-005x9", startFen: "r1b1kb1Q/ppp4p/6pB/3P4/2pn4/8/PPP1qPPP/RN1K3R w q - 2 13", moves: "d1c1 e2c2", rating: 906, cluster: "mateIn1" },
  { id: "lichess-006GK", startFen: "2kr1br1/ppBb1ppp/8/3P2Q1/3n2n1/5N2/PP3qPP/RN2R2K b - - 0 16", moves: "d4f3 g5d8", rating: 1020, cluster: "mateIn1" },
  { id: "lichess-007HB", startFen: "rn2q1k1/pp3ppp/2pb4/3p1B2/2Pn4/1Q3N2/PP3PPP/R1B4K w - - 0 15", moves: "f3d4 e8e1", rating: 512, cluster: "mateIn1" },
  { id: "lichess-007QU", startFen: "2rq1rk1/1b3p1p/p3p3/1p1pB1p1/2nP2N1/1RP1PP2/P1Q3PP/3R2K1 b - - 1 22", moves: "f7f5 g4h6", rating: 1108, cluster: "mateIn1" },
  { id: "lichess-007bH", startFen: "r2q1rk1/2p2ppn/2pbp2p/p2p4/P4PQ1/1P1PP3/1BPN2PP/4RR1K b - - 4 15", moves: "f7f5 g4g7", rating: 963, cluster: "mateIn1" },
  { id: "lichess-008LD", startFen: "8/6pp/4N1k1/5p2/5P2/5rPb/4R2P/6K1 w - - 0 35", moves: "e6g5 f3f1", rating: 404, cluster: "mateIn1" },
  { id: "lichess-008Nz", startFen: "6k1/2p2ppp/pnp5/B7/2P3PP/1P1bPPR1/r6r/3R2K1 b - - 1 29", moves: "d3e2 d1d8", rating: 473, cluster: "mateIn1" },
  { id: "lichess-0082f", startFen: "r4rk1/2q2ppp/3pp3/4Pb1N/pp6/1B4Q1/PPP3PP/1K1RR3 b - - 0 21", moves: "a4b3 g3g7", rating: 858, cluster: "mateIn1" },
  { id: "lichess-007c6", startFen: "2kr3r/pp1n2pp/2QB1bp1/5q2/2B5/8/PPP2PPP/3R1RK1 b - - 0 17", moves: "b7c6 c4a6", rating: 721, cluster: "mateIn1" },
  { id: "lichess-004zI", startFen: "2q3k1/4br1p/6RQ/1p1n2p1/7P/1P4P1/1B2PP2/6K1 b - - 0 27", moves: "h7g6 h6h8", rating: 1443, cluster: "mateIn1" },

  // === mateIn2 (rating 400 – 1600) ============================================
  { id: "lichess-001Wz", startFen: "4r1k1/5ppp/r1p5/p1n1RP2/8/2P2N1P/2P3P1/3R2K1 b - - 0 21", moves: "e8e5 d1d8 e5e8 d8e8", rating: 1118, cluster: "mateIn2" },
  { id: "lichess-000Zo", startFen: "4r3/1k6/pp3r2/1b2P2p/3R1p2/P1R2P2/1P4PP/6K1 w - - 0 35", moves: "e5f6 e8e1 g1f2 e1f1", rating: 1376, cluster: "mateIn2" },
  { id: "lichess-001w5", startFen: "1rb2rk1/q5P1/4p2p/3p3p/3P1P2/2P5/2QK3P/3R2R1 b - - 0 29", moves: "f8f7 c2h7 g8h7 g7g8q", rating: 1035, cluster: "mateIn2" },
  { id: "lichess-001om", startFen: "5r1k/pp4pp/5p2/1BbQp1r1/6K1/7P/1PP3P1/3R3R w - - 2 26", moves: "g4h4 c5f2 g2g3 f2g3", rating: 1018, cluster: "mateIn2" },
  { id: "lichess-002Mm", startFen: "rn1qr1k1/ppp3pQ/3p1pP1/3Pp3/2P1P3/8/PP3PP1/R1B1K3 b Q - 2 16", moves: "g8f8 h7h8 f8e7 h8g7", rating: 947, cluster: "mateIn2" },
  { id: "lichess-004X6", startFen: "1r4k1/p4ppp/2Q5/3pq3/8/P6P/2PR1PP1/Rr4K1 w - - 1 26", moves: "a1b1 b8b1 d2d1 b1d1", rating: 1152, cluster: "mateIn2" },
  { id: "lichess-004XI", startFen: "8/3kqp2/4p3/p2p4/3P1P2/4P1rP/7r/1QR2K2 b - - 1 34", moves: "e7a3 b1b7 d7e8 c1c8", rating: 982, cluster: "mateIn2" },
  { id: "lichess-005Bm", startFen: "4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43", moves: "c7f7 h4g6 f8g8 f6h8", rating: 1204, cluster: "mateIn2" },
  { id: "lichess-005N7", startFen: "r6k/2q3pp/8/2p1n3/R1Qp4/7P/2PB1PP1/6K1 b - - 0 32", moves: "e5c4 a4a8 c7b8 a8b8", rating: 654, cluster: "mateIn2" },
  { id: "lichess-006HV", startFen: "1r6/5k2/2p1pNp1/p5Pp/1pQ1P2P/2P4R/KP3P2/3q4 w - - 4 31", moves: "c4c6 b4b3 a2a3 d1a1", rating: 1163, cluster: "mateIn2" },
  { id: "lichess-0061g", startFen: "6k1/pp3pp1/2p1q1Pp/3b4/8/6Q1/PB3Pp1/3RrNK1 b - - 2 27", moves: "e1d1 g3b8 e6e8 b8e8", rating: 801, cluster: "mateIn2" },
  { id: "lichess-007Rn", startFen: "4r1k1/p4p1p/1p6/6q1/3P2n1/P4Q2/1P1B2P1/7K w - - 0 34", moves: "d2g5 e8e1 f3f1 e1f1", rating: 990, cluster: "mateIn2" },
  { id: "lichess-007XE", startFen: "2kr3r/p1p1bpp1/2p2n1p/8/8/1P6/P1P1RPPP/RNB3K1 w - - 1 16", moves: "e2e7 d8d1 e7e1 d1e1", rating: 630, cluster: "mateIn2" },
  { id: "lichess-008GK", startFen: "1k1r4/ppp3p1/8/1P5p/8/P3n2P/2P1r1P1/B3NRK1 b - - 4 31", moves: "d8d1 f1f8 d1d8 f8d8", rating: 489, cluster: "mateIn2" },

  // === fork (rating 600 – 1700) ===============================================
  { id: "lichess-000Pw", startFen: "6k1/5p1p/4p3/4q3/3nN3/2Q3P1/PP3P1P/6K1 w - - 2 37", moves: "e4d2 d4e2 g1f1 e2c3", rating: 1550, cluster: "fork" },
  { id: "lichess-001wr", startFen: "r4rk1/p3ppbp/Pp1q1np1/3PpbB1/2B5/2N5/1PPQ1PPP/3RR1K1 w - - 4 18", moves: "f2f3 d6c5 g1h1 c5c4", rating: 970, cluster: "fork" },
  { id: "lichess-002IE", startFen: "r3brk1/5pp1/p1nqpn1p/P2pN3/2pP4/2P1PN2/5PPP/RB1QK2R b KQ - 4 16", moves: "c6e5 d4e5 d6e7 e5f6", rating: 1205, cluster: "fork" },
  { id: "lichess-002GQ", startFen: "5rk1/5ppp/4p3/4N3/8/1Pn5/5PPP/5RK1 w - - 0 28", moves: "f1c1 c3e2 g1f1 e2c1", rating: 654, cluster: "fork" },
  { id: "lichess-002Tf", startFen: "r3kbnr/ppp1qppp/2n5/3pP3/5B2/4PQ2/PPP2PPP/RN2KB1R w KQkq - 1 7", moves: "f1b5 e7b4 b1c3 b4b2", rating: 1564, cluster: "fork" },
  { id: "lichess-000rO", startFen: "3R4/8/K7/pB2b3/1p6/1P2k3/3p4/8 w - - 4 58", moves: "a6a5 e5c7 a5b4 c7d8", rating: 1110, cluster: "fork" },
  { id: "lichess-0017R", startFen: "r2qk2r/pp2ppbp/1n1p2p1/3Pn3/2P5/2NBBP1P/PP3P2/R2QK2R b KQkq - 0 12", moves: "e5c4 d3c4 b6c4 d1a4 d8d7 a4c4", rating: 1528, cluster: "fork" },
  { id: "lichess-004nd", startFen: "3q2k1/2r5/pp3p1Q/2b1n3/P3N3/2P5/1P4PP/R6K b - - 0 24", moves: "c7d7 e4f6 d8f6 h6f6", rating: 898, cluster: "fork" },
  { id: "lichess-006wz", startFen: "2r5/4ppkp/5bp1/1p6/1P6/P3B3/2r2PPP/1R1R2K1 b - - 2 22", moves: "f6b2 b1b2 c2b2 e3d4 f7f6 d4b2", rating: 1428, cluster: "fork" },
  { id: "lichess-008D5", startFen: "r1bqk2r/pp3ppp/4p2n/3pP3/1b1P1P2/2N5/PP4PP/R1BQKB1R b KQkq - 2 9", moves: "h6f5 d1a4 c8d7 a4b4", rating: 1408, cluster: "fork" },
  { id: "lichess-008P4", startFen: "8/4k3/1p1p4/rP2p1p1/P2nP1P1/3BK3/8/R7 w - - 0 35", moves: "e3d2 d4b3 d2c3 b3a1", rating: 713, cluster: "fork" },

  // === pin (mixed ratings — pin puzzles in low brackets are rare on Lichess) ==
  { id: "lichess-001kG", startFen: "rnbq3r/1p2bkpp/p4n2/8/2pNP3/2N5/PPP3PP/R1BQ1RK1 b - - 1 11", moves: "e7c5 d1h5 f7g8 h5c5", rating: 1859, cluster: "pin" },
  { id: "lichess-006pe", startFen: "r4r2/2q1NN2/4bQpk/2n4p/pp5P/8/1PP2PP1/2KR3R b - - 0 28", moves: "e6f7 e7f5 h6h7 f6g7", rating: 1585, cluster: "pin" },

  // === hangingPiece (rating up to 1500) =======================================
  { id: "lichess-002bK", startFen: "8/7p/2b1k3/p2p1pPB/1n1P3P/N1p1P3/4K3/8 b - - 1 42", moves: "c6b5 a3b5 c3c2 e2d2", rating: 1129, cluster: "hangingPiece" },
  { id: "lichess-005wJ", startFen: "r3kb1r/ppqn1ppp/4pn2/1Q2Nb2/3P4/8/PP2PPPP/RNB1KB1R w KQkq - 4 9", moves: "e5d7 c7c1", rating: 1389, cluster: "hangingPiece" },
  { id: "lichess-000lC", startFen: "3r3r/pQNk1ppp/1qnb1n2/1B6/8/8/PPP3PP/3R1R1K w - - 5 19", moves: "d1d6 d7d6 b7b6 a7b6", rating: 1402, cluster: "hangingPiece" },
];

// ---------------------------------------------------------------------------
// Module-load transform
// ---------------------------------------------------------------------------

function ratingToDifficulty(r: number): Difficulty {
  if (r < 1100) return "easy";
  if (r < 1700) return "medium";
  return "hard";
}

function clusterTitle(cluster: ClusterId, idTail: string): string {
  const labels: Record<ClusterId, string> = {
    mateIn1: "Mate in 1",
    mateIn2: "Mate in 2",
    fork: "Fork tactic",
    pin: "Pin tactic",
    hangingPiece: "Hanging piece",
  };
  return `${labels[cluster]} · #${idTail}`;
}

function clusterPrompt(side: "w" | "b", cluster: ClusterId): string {
  const sideStr = side === "w" ? "White" : "Black";
  const inst: Record<ClusterId, string> = {
    mateIn1: "Find checkmate in one.",
    mateIn2: "Force checkmate in two.",
    fork: "Find the move that wins material with a double attack.",
    pin: "Exploit the pin to win material or the game.",
    hangingPiece: "Take the free material.",
  };
  return `${sideStr} to move. ${inst[cluster]}`;
}

function buildLichess(raw: RawLichess): Puzzle | null {
  let chess: Chess;
  try {
    chess = new Chess(raw.startFen);
  } catch (err) {
    console.warn(`[puzzles] skipping ${raw.id}: invalid FEN`, err);
    return null;
  }
  const allMoves = raw.moves.trim().split(/\s+/);
  if (allMoves.length < 2) return null;
  const setup = allMoves[0];
  try {
    chess.move({
      from: setup.slice(0, 2),
      to: setup.slice(2, 4),
      promotion:
        setup.length >= 5 ? (setup[4] as PromotionPiece) : undefined,
    });
  } catch (err) {
    console.warn(`[puzzles] skipping ${raw.id}: setup move ${setup} failed`, err);
    return null;
  }
  const fen = chess.fen();
  const sideToMove = (chess.turn() === "b" ? "b" : "w") as "w" | "b";
  const idTail = raw.id.slice(-5).toUpperCase();
  return {
    id: raw.id,
    title: clusterTitle(raw.cluster, idTail),
    prompt: clusterPrompt(sideToMove, raw.cluster),
    fen,
    sideToMove,
    difficulty: ratingToDifficulty(raw.rating),
    cluster: raw.cluster,
    rating: raw.rating,
    solution: allMoves.slice(1),
  };
}

function buildNative(raw: RawNative): Puzzle {
  const sideToMove = (raw.fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b";
  return { ...raw, sideToMove };
}

export const PUZZLES: readonly Puzzle[] = [
  ...NATIVE_PUZZLES.map(buildNative),
  ...LICHESS_PUZZLES.map(buildLichess).filter(
    (p): p is Puzzle => p !== null,
  ),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export function getPuzzlesByCluster(cluster: ClusterId): Puzzle[] {
  return PUZZLES.filter((p) => p.cluster === cluster);
}

/** Deterministic daily puzzle — rotates one per UTC day across the bank. */
export function getDailyPuzzle(now: Date = new Date()): Puzzle {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000);
  return PUZZLES[dayOfYear % PUZZLES.length];
}
