"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/chess/board";
import {
  isPromotionMove,
  legalTargetsFrom,
} from "@/lib/chess/game";
import type { PromotionPiece, Puzzle } from "@/lib/training/puzzles";
import { getCluster } from "@/lib/training/clusters";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAttempt } from "@/lib/supabase/puzzle-attempts";

type Feedback = "idle" | "wrong" | "solved";

const OPPONENT_REPLY_DELAY_MS = 350;

export function PuzzleSolver({
  puzzle,
  onNext,
  hasNext,
}: {
  puzzle: Puzzle;
  onNext?: () => void;
  hasNext?: boolean;
}) {
  // `stepStartFen` is the position at which the user is expected to make their
  // move for the current step. Wrong attempts revert to it (not all the way to
  // puzzle.fen, so multi-step progress isn't lost).
  const [stepStartFen, setStepStartFen] = useState<string>(puzzle.fen);
  const [currentFen, setCurrentFen] = useState<string>(puzzle.fen);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [attempts, setAttempts] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [recordedOutcome, setRecordedOutcome] = useState<
    "pass" | "fail" | null
  >(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const isMateIn1 = puzzle.cluster === "mateIn1";
  const totalUserSteps = Math.max(1, Math.ceil(puzzle.solution.length / 2));
  const userStepNumber = Math.floor(currentStep / 2) + 1;

  // Reset all transient state when the puzzle changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepStartFen(puzzle.fen);
    setCurrentFen(puzzle.fen);
    setCurrentStep(0);
    setFeedback("idle");
    setAttempts(0);
    setShowHint(false);
    setSelectedSquare(null);
    setRecordedOutcome(null);
  }, [puzzle]);

  // Record the FIRST outcome of each puzzle attempt into the SR schedule.
  useEffect(() => {
    if (recordedOutcome) return;
    if (feedback === "wrong") {
      void recordAttempt(supabase, puzzle.id, "fail");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecordedOutcome("fail");
    } else if (feedback === "solved") {
      void recordAttempt(supabase, puzzle.id, "pass");
      setRecordedOutcome("pass");
    }
  }, [feedback, puzzle.id, recordedOutcome, supabase]);

  // On a wrong attempt, briefly show the move then revert to the step-start FEN.
  useEffect(() => {
    if (feedback !== "wrong") return;
    const t = setTimeout(() => {
      setCurrentFen(stepStartFen);
      setFeedback("idle");
      setSelectedSquare(null);
    }, 1000);
    return () => clearTimeout(t);
  }, [feedback, stepStartFen]);

  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (feedback === "solved" || feedback === "wrong") return false;

      // We need the chess instance at the position right before the user's move.
      const chess = new Chess(stepStartFen);
      const expectedUci: string | undefined = puzzle.solution[currentStep];

      // Detect promotion piece. For Lichess puzzles, the solution carries the
      // exact promotion letter; for mateIn1 hand puzzles, default to queen.
      let promotion: PromotionPiece | undefined;
      if (expectedUci && expectedUci.length >= 5) {
        promotion = expectedUci[4] as PromotionPiece;
      } else if (isPromotionMove(chess, from, to)) {
        promotion = "q";
      }

      let userMove;
      try {
        userMove = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      if (!userMove) return false;

      const userUci = `${from}${to}${promotion ?? ""}`;
      const correct = isMateIn1
        ? chess.isCheckmate()
        : expectedUci !== undefined && userUci === expectedUci;

      if (!correct) {
        setCurrentFen(chess.fen());
        setFeedback("wrong");
        setAttempts((a) => a + 1);
        return true;
      }

      setCurrentFen(chess.fen());
      setSelectedSquare(null);

      // Is there an opponent reply?
      const opponentStep = currentStep + 1;
      const opponentUci = puzzle.solution[opponentStep];
      if (!opponentUci) {
        // No more moves — puzzle solved.
        setFeedback("solved");
        return true;
      }

      // Apply opponent's reply after a short pause so the user can see their move.
      setTimeout(() => {
        const after = new Chess(chess.fen());
        try {
          after.move({
            from: opponentUci.slice(0, 2),
            to: opponentUci.slice(2, 4),
            promotion:
              opponentUci.length >= 5
                ? (opponentUci[4] as PromotionPiece)
                : undefined,
          });
        } catch {
          // Data-quality fallback: if the opponent reply doesn't apply, declare
          // the puzzle solved rather than wedge the UI.
          setFeedback("solved");
          return;
        }
        const fenAfterOpponent = after.fen();
        setCurrentFen(fenAfterOpponent);
        setStepStartFen(fenAfterOpponent);
        const nextUserStep = opponentStep + 1;
        if (nextUserStep >= puzzle.solution.length) {
          setFeedback("solved");
        } else {
          setCurrentStep(nextUserStep);
        }
      }, OPPONENT_REPLY_DELAY_MS);

      return true;
    },
    [
      currentStep,
      feedback,
      isMateIn1,
      puzzle.solution,
      stepStartFen,
    ],
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
      if (feedback === "solved" || feedback === "wrong") return;
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
    setStepStartFen(puzzle.fen);
    setCurrentFen(puzzle.fen);
    setCurrentStep(0);
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

  const cluster = getCluster(puzzle.cluster);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:flex-row md:p-6">
      <div className="md:flex-1">
        <Board
          fen={currentFen}
          orientation={puzzle.sideToMove === "w" ? "white" : "black"}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          highlightedSquares={highlightedSquares}
          disabled={feedback !== "idle"}
        />
      </div>
      <div className="flex flex-col gap-4 md:w-80">
        <div className="rounded-md border border-foreground/15 bg-foreground/5 p-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-foreground/50">
            <span>
              {cluster.label} · {puzzle.difficulty}
              {puzzle.rating ? ` · ${puzzle.rating}` : ""}
            </span>
            {totalUserSteps > 1 ? (
              <span className="font-mono normal-case text-foreground/60">
                Step {userStepNumber}/{totalUserSteps}
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 text-base font-semibold">{puzzle.title}</h2>
          <p className="mt-1 text-sm text-foreground/70">{puzzle.prompt}</p>
        </div>

        <FeedbackBanner
          feedback={feedback}
          attempts={attempts}
          isMulti={totalUserSteps > 1}
        />

        {showHint && puzzle.hint ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Hint: {puzzle.hint}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <SmallButton
            onClick={tryAgain}
            disabled={feedback === "idle" && currentStep === 0}
          >
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
  isMulti,
}: {
  feedback: Feedback;
  attempts: number;
  isMulti: boolean;
}) {
  if (feedback === "solved") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
      >
        ✓ {isMulti ? "Sequence solved. Nicely done." : "Checkmate. Nicely done."}
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
        Not quite — try again.
      </div>
    );
  }
  if (attempts === 0) {
    return (
      <div className="rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground/70">
        {isMulti
          ? "Find the forcing sequence. Make your move."
          : "Find the move that mates immediately."}
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
