import { Chess } from "chess.js";
import type { StockfishEngine } from "@/lib/chess/engine";

export type Severity = "inaccuracy" | "mistake" | "blunder";

export type Blunder = {
  /** 0-indexed ply number (0 = white's first move). */
  ply: number;
  /** Move number from the game's perspective (1-indexed, full move). */
  moveNumber: number;
  /** SAN of the move that was played. */
  san: string;
  /** FEN of the position BEFORE the move. */
  fenBefore: string;
  /** FEN of the position AFTER the move. */
  fenAfter: string;
  /** Best move Stockfish would have played from the same position (SAN). */
  bestMoveSan: string | null;
  /** Eval before move (centipawns, from white's POV). */
  evalBeforeCp: number;
  /** Eval after move (centipawns, from white's POV). */
  evalAfterCp: number;
  /** How many centipawns the moving side lost (always positive). */
  evalDropCp: number;
  color: "w" | "b";
  severity: Severity;
};

export type AnalysisProgress = {
  done: number;
  total: number;
};

export type AnalyzeOptions = {
  /** Search depth per position. 8 is a good MVP balance of speed and quality. */
  depth?: number;
  /** Only flag drops at or above this many centipawns. */
  inaccuracyCp?: number;
  mistakeCp?: number;
  blunderCp?: number;
  /** Skip the first N plies (opening theory is rarely a blunder source). */
  skipOpeningPlies?: number;
  /** Called with progress updates while analyzing. */
  onProgress?: (p: AnalysisProgress) => void;
  /** Read this on each tick — return true to stop early. */
  shouldCancel?: () => boolean;
};

const DEFAULTS = {
  depth: 8,
  inaccuracyCp: 50,
  mistakeCp: 100,
  blunderCp: 200,
  skipOpeningPlies: 4,
} as const;

function classify(
  dropCp: number,
  thresholds: {
    inaccuracyCp: number;
    mistakeCp: number;
    blunderCp: number;
  },
): Severity | null {
  if (dropCp >= thresholds.blunderCp) return "blunder";
  if (dropCp >= thresholds.mistakeCp) return "mistake";
  if (dropCp >= thresholds.inaccuracyCp) return "inaccuracy";
  return null;
}

/**
 * Walk a game's PGN, evaluate every position, and return moves whose evaluation
 * drop crosses the configured thresholds. Runs against the supplied engine —
 * the caller owns its lifecycle.
 */
export async function analyzeGame(
  engine: StockfishEngine,
  pgn: string,
  opts: AnalyzeOptions = {},
): Promise<Blunder[]> {
  const config = { ...DEFAULTS, ...opts };

  const game = new Chess();
  try {
    game.loadPgn(pgn);
  } catch {
    return [];
  }
  const moves = game.history({ verbose: true });
  if (moves.length === 0) return [];

  // Replay to collect FENs (one per ply + the starting position).
  const fens: string[] = [];
  const replayer = new Chess();
  fens.push(replayer.fen());
  for (const m of moves) {
    replayer.move({ from: m.from, to: m.to, promotion: m.promotion });
    fens.push(replayer.fen());
  }

  // Evaluate each position. Total = moves + 1 (before + after each ply).
  const total = fens.length;
  const evals: number[] = new Array(total).fill(0);
  for (let i = 0; i < total; i++) {
    if (config.shouldCancel?.()) return [];
    evals[i] = await engine.evaluate(fens[i], config.depth);
    config.onProgress?.({ done: i + 1, total });
  }

  // Detect drops.
  const blunders: Blunder[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (i < config.skipOpeningPlies) continue;
    const m = moves[i];
    const before = evals[i];
    const after = evals[i + 1];
    // Eval is from white's POV. Drop for the side that just moved:
    //   white moves: drop = before - after
    //   black moves: drop = after - before
    const dropCp = m.color === "w" ? before - after : after - before;
    const severity = classify(dropCp, config);
    if (!severity) continue;

    // What was the best alternative? Ask the engine for bestmove at the prior FEN.
    // Skip this for speed in the MVP — fill bestMoveSan with null and let the
    // explain step include it later if needed. (Bumping cost from 1 to 2 evals
    // per move would double total analysis time.)
    blunders.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      san: m.san,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      bestMoveSan: null,
      evalBeforeCp: before,
      evalAfterCp: after,
      evalDropCp: dropCp,
      color: m.color,
      severity,
    });
  }

  return blunders;
}
