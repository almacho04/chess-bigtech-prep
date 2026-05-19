import { Chess, type Move } from "chess.js";

export type Color = "white" | "black";

export type GameStatus =
  | { kind: "ongoing"; turn: Color; inCheck: boolean }
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | {
      kind: "draw";
      reason:
        | "fifty-move"
        | "threefold-repetition"
        | "insufficient-material"
        | "other";
    };

export type MoveRecord = {
  san: string;
  color: "w" | "b";
  from: string;
  to: string;
  fenAfter: string;
};

export function createGame(pgn?: string): Chess {
  const c = new Chess();
  if (pgn) {
    try {
      c.loadPgn(pgn);
    } catch {
      // ignore — caller gets a fresh game
    }
  }
  return c;
}

export function tryMove(
  chess: Chess,
  from: string,
  to: string,
  promotion: "q" | "r" | "b" | "n" = "q",
): Move | null {
  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

export function describeStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return {
      kind: "checkmate",
      winner: chess.turn() === "w" ? "black" : "white",
    };
  }
  if (chess.isStalemate()) return { kind: "stalemate" };
  if (chess.isDraw()) {
    if (chess.isInsufficientMaterial())
      return { kind: "draw", reason: "insufficient-material" };
    if (chess.isThreefoldRepetition())
      return { kind: "draw", reason: "threefold-repetition" };
    if (chess.isDrawByFiftyMoves())
      return { kind: "draw", reason: "fifty-move" };
    return { kind: "draw", reason: "other" };
  }
  return {
    kind: "ongoing",
    turn: chess.turn() === "w" ? "white" : "black",
    inCheck: chess.inCheck(),
  };
}

export function historyToRecords(chess: Chess): MoveRecord[] {
  return chess.history({ verbose: true }).map((m) => ({
    san: m.san,
    color: m.color,
    from: m.from,
    to: m.to,
    fenAfter: m.after,
  }));
}

export function legalTargetsFrom(chess: Chess, square: string): string[] {
  try {
    const moves = chess.moves({ square: square as never, verbose: true });
    return moves.map((m) => m.to);
  } catch {
    return [];
  }
}
