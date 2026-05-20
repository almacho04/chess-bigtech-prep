import { Chess } from "chess.js";
import type { StockfishEngine } from "@/lib/chess/engine";
import type { Difficulty } from "@/lib/chess/difficulty";
import type { ClusterId } from "@/lib/training/clusters";

export type Severity = "inaccuracy" | "mistake" | "blunder";

export type Blunder = {
  /** 0-indexed ply number (0 = white's first move). */
  ply: number;
  /** Move number from the game's perspective (1-indexed, full move). */
  moveNumber: number;
  /** SAN of the move that was played. */
  san: string;
  /** Source square of the move that was played. */
  from: string;
  /** Target square of the move that was played. */
  to: string;
  /** FEN of the position BEFORE the move. */
  fenBefore: string;
  /** FEN of the position AFTER the move. */
  fenAfter: string;
  /** Best move Stockfish would have played from the same position (SAN). */
  bestMoveSan: string | null;
  /** Best move as UCI coordinates, used for arrows/highlights. */
  bestMoveUci: string | null;
  bestMoveFrom: string | null;
  bestMoveTo: string | null;
  /** Tutor themes inferred from the mistake. Feeds profile/training memory. */
  themes: ClusterId[];
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
  /** Analyze one side only when the game has a known human player. */
  sideToAnalyze?: "w" | "b" | "both";
  /** Ask Stockfish for visual best-move arrows only on the worst N mistakes. */
  maxBestMoveAnnotations?: number;
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
  sideToAnalyze: "both",
  maxBestMoveAnnotations: 5,
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

  const moveIndexes = moves
    .map((m, i) => ({ move: m, index: i }))
    .filter(
      ({ move, index }) =>
        index >= config.skipOpeningPlies &&
        (config.sideToAnalyze === "both" ||
          move.color === config.sideToAnalyze),
    )
    .map(({ index }) => index);

  if (moveIndexes.length === 0) {
    config.onProgress?.({ done: 1, total: 1 });
    return [];
  }

  // Evaluate only positions needed to judge the selected side's moves.
  const neededEvalIndexes = new Set<number>();
  for (const index of moveIndexes) {
    neededEvalIndexes.add(index);
    neededEvalIndexes.add(index + 1);
  }
  const evalIndexes = [...neededEvalIndexes].sort((a, b) => a - b);
  const evals: number[] = new Array(fens.length).fill(Number.NaN);
  for (let n = 0; n < evalIndexes.length; n++) {
    if (config.shouldCancel?.()) return [];
    const fenIndex = evalIndexes[n];
    evals[fenIndex] = await engine.evaluate(fens[fenIndex], config.depth);
    config.onProgress?.({ done: n + 1, total: evalIndexes.length });
  }

  // Detect drops.
  const blunders: Blunder[] = [];
  for (const i of moveIndexes) {
    const m = moves[i];
    const before = evals[i];
    const after = evals[i + 1];
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
    // Eval is from white's POV. Drop for the side that just moved:
    //   white moves: drop = before - after
    //   black moves: drop = after - before
    const dropCp = m.color === "w" ? before - after : after - before;
    const severity = classify(dropCp, config);
    if (!severity) continue;

    blunders.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      san: m.san,
      from: m.from,
      to: m.to,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      bestMoveSan: null,
      bestMoveUci: null,
      bestMoveFrom: null,
      bestMoveTo: null,
      themes: [],
      evalBeforeCp: before,
      evalAfterCp: after,
      evalDropCp: dropCp,
      color: m.color,
      severity,
    });
  }

  const annotatedPlySet = new Set(
    [...blunders]
      .sort(
        (a, b) =>
          severityRank(b.severity) - severityRank(a.severity) ||
          b.evalDropCp - a.evalDropCp,
      )
      .slice(0, config.maxBestMoveAnnotations)
      .map((b) => b.ply),
  );
  let progressDone = evalIndexes.length;
  const progressTotal = evalIndexes.length + annotatedPlySet.size;

  for (const b of blunders) {
    if (config.shouldCancel?.()) return [];
    if (annotatedPlySet.has(b.ply)) {
      const best = await engine.bestMove(
        b.fenBefore,
        coachDifficulty(config.depth),
      );
      if (best) {
        const san = sanForMove(b.fenBefore, best.from, best.to, best.promotion);
        b.bestMoveSan = san;
        b.bestMoveUci = `${best.from}${best.to}${best.promotion ?? ""}`;
        b.bestMoveFrom = best.from;
        b.bestMoveTo = best.to;
      }
      progressDone += 1;
      config.onProgress?.({ done: progressDone, total: progressTotal });
    }
    b.themes = classifyBlunderThemes(b);
  }

  return blunders;
}

function severityRank(severity: Severity): number {
  if (severity === "blunder") return 3;
  if (severity === "mistake") return 2;
  return 1;
}

function classifyBlunderThemes(blunder: Blunder): ClusterId[] {
  const themes = new Set<ClusterId>();

  if (blunder.bestMoveSan?.includes("#")) themes.add("mateIn1");
  if (playedMoveHangsPiece(blunder)) themes.add("hangingPiece");
  if (bestMoveLooksLikeFork(blunder)) themes.add("fork");
  if (bestMoveLooksLikePin(blunder)) themes.add("pin");

  // Generic calculation miss: Stockfish found a tactical improvement, but the
  // MVP heuristics cannot confidently map it to fork/pin/hanging material.
  if (themes.size === 0) themes.add("mateIn2");

  return [...themes].slice(0, 2);
}

function playedMoveHangsPiece(blunder: Blunder): boolean {
  try {
    const after = new Chess(blunder.fenAfter);
    const piece = after.get(blunder.to as never);
    if (!piece || piece.color !== blunder.color || piece.type === "k") {
      return false;
    }
    const opponent = blunder.color === "w" ? "b" : "w";
    return (
      after.isAttacked(blunder.to as never, opponent) &&
      !after.isAttacked(blunder.to as never, blunder.color)
    );
  } catch {
    return false;
  }
}

function bestMoveLooksLikeFork(blunder: Blunder): boolean {
  const bestPiece = pieceAt(blunder.fenBefore, blunder.bestMoveFrom);
  if (!bestPiece) return false;
  if (bestPiece.type === "n") return true;
  return Boolean(
    blunder.bestMoveSan?.includes("+") &&
      ["q", "r", "b"].includes(bestPiece.type) &&
      blunder.evalDropCp >= 100,
  );
}

function bestMoveLooksLikePin(blunder: Blunder): boolean {
  const bestPiece = pieceAt(blunder.fenBefore, blunder.bestMoveFrom);
  if (!bestPiece) return false;
  if (!["b", "r", "q"].includes(bestPiece.type)) return false;
  if (blunder.bestMoveSan?.includes("#")) return false;
  return Boolean(blunder.bestMoveSan?.includes("x") || blunder.bestMoveSan?.includes("+"));
}

function pieceAt(fen: string, square: string | null) {
  if (!square) return null;
  try {
    return new Chess(fen).get(square as never) ?? null;
  } catch {
    return null;
  }
}

function coachDifficulty(depth: number): Difficulty {
  return {
    id: "master",
    label: "Coach",
    description: "Coach analysis",
    skillLevel: 20,
    depth,
  };
}

function sanForMove(
  fen: string,
  from: string,
  to: string,
  promotion?: "q" | "r" | "b" | "n",
): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion });
    return move?.san ?? null;
  } catch {
    return null;
  }
}
