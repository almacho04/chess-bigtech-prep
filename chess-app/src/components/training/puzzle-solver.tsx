"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/chess/board";
import {
  isPromotionMove,
  legalTargetsFrom,
} from "@/lib/chess/game";
import type { Puzzle } from "@/lib/training/puzzles";

type Feedback = "idle" | "wrong" | "solved";

export function PuzzleSolver({
  puzzle,
  onNext,
  hasNext,
}: {
  puzzle: Puzzle;
  onNext?: () => void;
  hasNext?: boolean;
}) {
  const [currentFen, setCurrentFen] = useState<string>(puzzle.fen);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [attempts, setAttempts] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Reset state when the puzzle changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentFen(puzzle.fen);
    setFeedback("idle");
    setAttempts(0);
    setShowHint(false);
    setSelectedSquare(null);
  }, [puzzle]);

  // On a wrong attempt, briefly show the move then revert to the puzzle start.
  useEffect(() => {
    if (feedback !== "wrong") return;
    const t = setTimeout(() => {
      setCurrentFen(puzzle.fen);
      setFeedback("idle");
      setSelectedSquare(null);
    }, 1000);
    return () => clearTimeout(t);
  }, [feedback, puzzle.fen]);

  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (feedback === "solved") return false;
      const chess = new Chess(currentFen);
      // For mate-in-1 puzzles, auto-queen on promotion (the right piece is
      // almost always a queen at this level).
      const promotion = isPromotionMove(chess, from, to) ? "q" : undefined;
      let moved;
      try {
        moved = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      if (!moved) return false;

      setCurrentFen(chess.fen());
      if (chess.isCheckmate()) {
        setFeedback("solved");
        setSelectedSquare(null);
      } else {
        setFeedback("wrong");
        setAttempts((a) => a + 1);
      }
      return true;
    },
    [currentFen, feedback],
  );

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
      if (feedback === "solved") return;
      if (selectedSquare && selectedSquare !== square) {
        const ok = attemptMove(selectedSquare, square);
        if (ok) return;
      }
      const targets = legalTargetsFrom(new Chess(currentFen), square);
      setSelectedSquare(targets.length > 0 ? square : null);
    },
    [attemptMove, currentFen, feedback, selectedSquare],
  );

  const tryAgain = useCallback(() => {
    setCurrentFen(puzzle.fen);
    setFeedback("idle");
    setSelectedSquare(null);
  }, [puzzle.fen]);

  const highlightedSquares = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selectedSquare || feedback === "solved") return {};
    const targets = legalTargetsFrom(new Chess(currentFen), selectedSquare);
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
  }, [selectedSquare, currentFen, feedback]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:flex-row md:p-6">
      <div className="md:flex-1">
        <Board
          fen={currentFen}
          orientation={puzzle.sideToMove === "w" ? "white" : "black"}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          highlightedSquares={highlightedSquares}
          disabled={feedback === "solved"}
        />
      </div>
      <div className="flex flex-col gap-4 md:w-80">
        <div className="rounded-md border border-foreground/15 bg-foreground/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {puzzle.pack} · {puzzle.difficulty}
          </div>
          <h2 className="mt-1 text-base font-semibold">{puzzle.title}</h2>
          <p className="mt-1 text-sm text-foreground/70">{puzzle.prompt}</p>
        </div>

        <FeedbackBanner
          feedback={feedback}
          attempts={attempts}
        />

        {showHint && puzzle.hint ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Hint: {puzzle.hint}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <SmallButton onClick={tryAgain} disabled={feedback === "idle"}>
            Reset
          </SmallButton>
          <SmallButton
            onClick={() => setShowHint(true)}
            disabled={!puzzle.hint || showHint}
          >
            Show hint
          </SmallButton>
          {hasNext ? (
            <button
              type="button"
              onClick={onNext}
              disabled={feedback !== "solved"}
              className="col-span-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition disabled:opacity-40"
            >
              Next puzzle →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeedbackBanner({
  feedback,
  attempts,
}: {
  feedback: Feedback;
  attempts: number;
}) {
  if (feedback === "solved") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
      >
        ✓ Checkmate. Nicely done.
      </div>
    );
  }
  if (feedback === "wrong") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100"
      >
        Not quite — that doesn&rsquo;t produce mate.
      </div>
    );
  }
  if (attempts === 0) {
    return (
      <div className="rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground/70">
        Find the move that mates immediately.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground/70">
      {attempts} attempt{attempts === 1 ? "" : "s"} so far.
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-foreground/15 px-3 py-2 text-sm transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
