"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  createGame,
  describeStatus,
  historyToRecords,
  isPromotionMove,
  legalTargetsFrom,
  tryMove,
  type MoveRecord,
} from "@/lib/chess/game";
import {
  clearGame,
  loadGame,
  saveGame,
} from "@/lib/storage/local-game";
import { Board } from "./board";
import { Controls } from "./controls";
import { MoveHistory } from "./move-history";
import {
  PromotionPicker,
  type PromotionPiece,
} from "./promotion-picker";
import { StatusBanner } from "./status-banner";

type Orientation = "white" | "black";
type PendingPromotion = { from: string; to: string; color: "w" | "b" };

export function GameShell() {
  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadGame();
    if (persisted) {
      chessRef.current = createGame(persisted.pgn);
      setFen(chessRef.current.fen());
      setMoves(historyToRecords(chessRef.current));
      setRedoStack(persisted.redoStack);
      setOrientation(persisted.orientation);
    }
    setMounted(true);
  }, []);

  // Persist on every meaningful change
  useEffect(() => {
    if (!mounted) return;
    saveGame({
      pgn: chessRef.current.pgn(),
      redoStack,
      orientation,
    });
  }, [fen, redoStack, orientation, mounted]);

  const syncFromChess = useCallback(() => {
    setFen(chessRef.current.fen());
    setMoves(historyToRecords(chessRef.current));
  }, []);

  const applyMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      const move = tryMove(chessRef.current, from, to, promotion);
      if (!move) return false;
      setRedoStack([]);
      setSelectedSquare(null);
      syncFromChess();
      return true;
    },
    [syncFromChess],
  );

  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      // Detect promotions BEFORE applying so we can ask the user which piece.
      // The check uses a fresh Chess from `fen` to avoid reading the ref here.
      if (isPromotionMove(new Chess(fen), from, to)) {
        const turnColor = (fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b";
        setPendingPromotion({ from, to, color: turnColor });
        return false; // snap piece back; picker appears
      }
      return applyMove(from, to);
    },
    [applyMove, fen],
  );

  const onPromotionPick = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) return;
      applyMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
    },
    [applyMove, pendingPromotion],
  );

  const onPromotionCancel = useCallback(() => {
    setPendingPromotion(null);
  }, []);

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare) return false;
      return attemptMove(sourceSquare, targetSquare);
    },
    [attemptMove],
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (selectedSquare && selectedSquare !== square) {
        const ok = attemptMove(selectedSquare, square);
        if (ok) return;
        // If a promotion picker was opened, attemptMove returned false but we
        // still want to deselect the source square so it's not stuck-highlighted.
        if (pendingPromotion) {
          setSelectedSquare(null);
          return;
        }
      }
      // Toggle / re-select: only select squares that have a movable piece for the side to move
      const targets = legalTargetsFrom(chessRef.current, square);
      setSelectedSquare(targets.length > 0 ? square : null);
    },
    [attemptMove, pendingPromotion, selectedSquare],
  );

  const onUndo = useCallback(() => {
    const undone = chessRef.current.undo();
    if (!undone) return;
    setRedoStack((s) => [...s, undone.san]);
    setSelectedSquare(null);
    syncFromChess();
  }, [syncFromChess]);

  const onRedo = useCallback(() => {
    setRedoStack((s) => {
      if (s.length === 0) return s;
      const next = s[s.length - 1];
      try {
        const m = chessRef.current.move(next);
        if (!m) return s;
      } catch {
        return s;
      }
      syncFromChess();
      return s.slice(0, -1);
    });
  }, [syncFromChess]);

  const onNewGame = useCallback(() => {
    if (
      moves.length > 0 &&
      typeof window !== "undefined" &&
      !window.confirm("Start a new game? Current progress will be lost.")
    ) {
      return;
    }
    chessRef.current = new Chess();
    setRedoStack([]);
    setSelectedSquare(null);
    clearGame();
    syncFromChess();
  }, [moves.length, syncFromChess]);

  const onFlip = useCallback(() => {
    setOrientation((o) => (o === "white" ? "black" : "white"));
  }, []);

  // Derived state is computed from FEN (a fresh Chess per memo) so React can
  // track dependencies; the mutable ref is only read inside event handlers.
  const status = useMemo(() => describeStatus(new Chess(fen)), [fen]);

  const highlightedSquares = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selectedSquare) return {};
    const targets = legalTargetsFrom(new Chess(fen), selectedSquare);
    const out: Record<string, React.CSSProperties> = {
      [selectedSquare]: { background: "rgba(250, 204, 21, 0.45)" },
    };
    for (const t of targets) {
      out[t] = {
        background:
          "radial-gradient(circle, rgba(34,197,94,0.55) 22%, transparent 24%)",
      };
    }
    return out;
  }, [selectedSquare, fen]);

  if (!mounted) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row md:p-6">
        <div
          aria-hidden
          className="mx-auto aspect-square w-full max-w-[min(80vh,560px)] animate-pulse rounded-md bg-foreground/5"
        />
        <div className="flex flex-col gap-4 md:w-80">
          <div className="h-10 animate-pulse rounded-md bg-foreground/5" />
          <div className="h-24 animate-pulse rounded-md bg-foreground/5" />
          <div className="h-48 animate-pulse rounded-md bg-foreground/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:flex-row md:p-6">
      <div className="md:flex-1">
        <Board
          fen={fen}
          orientation={orientation}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          highlightedSquares={highlightedSquares}
          disabled={status.kind !== "ongoing"}
        />
      </div>
      <div className="flex flex-col gap-4 md:w-80">
        <StatusBanner status={status} />
        <Controls
          onUndo={onUndo}
          onRedo={onRedo}
          onNewGame={onNewGame}
          onFlip={onFlip}
          canUndo={moves.length > 0}
          canRedo={redoStack.length > 0}
        />
        <MoveHistory moves={moves} />
      </div>
      <PromotionPicker
        open={pendingPromotion !== null}
        color={pendingPromotion?.color ?? "w"}
        onPick={onPromotionPick}
        onCancel={onPromotionCancel}
      />
    </div>
  );
}
