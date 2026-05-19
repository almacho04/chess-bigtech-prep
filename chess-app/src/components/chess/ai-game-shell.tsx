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
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  getDifficulty,
  type Difficulty,
} from "@/lib/chess/difficulty";
import { StockfishEngine } from "@/lib/chess/engine";
import { Board } from "./board";
import { MoveHistory } from "./move-history";
import {
  PromotionPicker,
  type PromotionPiece,
} from "./promotion-picker";
import { StatusBanner } from "./status-banner";

type HumanColor = "w" | "b";
type PendingPromotion = { from: string; to: string; color: HumanColor };

const STORAGE_KEY = "chess.ai-game.v1";

type PersistedAiGame = {
  pgn: string;
  humanColor: HumanColor;
  difficultyId: Difficulty["id"];
};

function loadAiGame(): PersistedAiGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as PersistedAiGame).pgn !== "string"
    )
      return null;
    const p = parsed as PersistedAiGame;
    return {
      pgn: p.pgn,
      humanColor: p.humanColor === "b" ? "b" : "w",
      difficultyId: DIFFICULTIES.some((d) => d.id === p.difficultyId)
        ? p.difficultyId
        : DEFAULT_DIFFICULTY,
    };
  } catch {
    return null;
  }
}

function saveAiGame(game: PersistedAiGame): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // ignore
  }
}

function clearAiGame(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function AiGameShell() {
  const chessRef = useRef<Chess>(new Chess());
  const engineRef = useRef<StockfishEngine | null>(null);
  const aliveRef = useRef(true);

  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [humanColor, setHumanColor] = useState<HumanColor>("w");
  const [difficultyId, setDifficultyId] =
    useState<Difficulty["id"]>(DEFAULT_DIFFICULTY);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [engineState, setEngineState] = useState<
    "loading" | "ready" | "thinking" | "error"
  >("loading");
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const difficulty = useMemo(
    () => getDifficulty(difficultyId),
    [difficultyId],
  );

  const status = useMemo(() => describeStatus(new Chess(fen)), [fen]);
  const isHumanTurn = useMemo(() => {
    if (status.kind !== "ongoing") return false;
    const turnColor = fen.split(" ")[1] as HumanColor;
    return turnColor === humanColor;
  }, [fen, humanColor, status.kind]);

  const syncFromChess = useCallback(() => {
    setFen(chessRef.current.fen());
    setMoves(historyToRecords(chessRef.current));
  }, []);

  // Mount: load persisted game, init engine
  useEffect(() => {
    aliveRef.current = true;
    const persisted = loadAiGame();
    if (persisted) {
      chessRef.current = createGame(persisted.pgn);
      // Hydration from localStorage runs once on mount; cascading renders are
      // intended (single hydration burst, not a runtime feedback loop).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHumanColor(persisted.humanColor);
      setDifficultyId(persisted.difficultyId);
      setFen(chessRef.current.fen());
      setMoves(historyToRecords(chessRef.current));
    }
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine
      .init()
      .then(() => engine.newGame(getDifficulty(persisted?.difficultyId ?? DEFAULT_DIFFICULTY).skillLevel))
      .then(() => {
        if (aliveRef.current) setEngineState("ready");
      })
      .catch(() => {
        if (aliveRef.current) setEngineState("error");
      });
    setMounted(true);
    return () => {
      aliveRef.current = false;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Persist on relevant changes
  useEffect(() => {
    if (!mounted) return;
    saveAiGame({
      pgn: chessRef.current.pgn(),
      humanColor,
      difficultyId,
    });
  }, [fen, humanColor, difficultyId, mounted]);

  // Trigger engine reply when it's AI's turn and engine is idle
  useEffect(() => {
    if (!mounted) return;
    if (engineState !== "ready") return;
    if (status.kind !== "ongoing") return;
    const turnColor = fen.split(" ")[1] as HumanColor;
    if (turnColor === humanColor) return;

    let cancelled = false;
    // Marking "thinking" inside the effect is the synchronization point for
    // launching async engine work; the follow-up setEngineState("ready")
    // happens in the IIFE below once bestMove resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEngineState("thinking");
    const fenSnapshot = fen;
    const diff = getDifficulty(difficultyId);

    (async () => {
      try {
        const engine = engineRef.current;
        if (!engine) return;
        const uci = await engine.bestMove(fenSnapshot, diff);
        if (cancelled || !aliveRef.current) return;
        // Sanity: position must not have moved on while we waited
        if (chessRef.current.fen() !== fenSnapshot) return;
        if (uci) {
          tryMove(chessRef.current, uci.from, uci.to, uci.promotion);
          syncFromChess();
        }
      } finally {
        if (aliveRef.current && !cancelled) setEngineState("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when it's the engine's turn or difficulty/color changes
  }, [fen, humanColor, difficultyId, mounted, engineState, status.kind, syncFromChess]);

  const applyHumanMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      if (!isHumanTurn) return false;
      if (engineState === "thinking") return false;
      const move = tryMove(chessRef.current, from, to, promotion);
      if (!move) return false;
      setSelectedSquare(null);
      syncFromChess();
      return true;
    },
    [engineState, isHumanTurn, syncFromChess],
  );

  const attemptHumanMove = useCallback(
    (from: string, to: string): boolean => {
      if (!isHumanTurn) return false;
      if (engineState === "thinking") return false;
      if (isPromotionMove(new Chess(fen), from, to)) {
        setPendingPromotion({ from, to, color: humanColor });
        return false; // snap back; picker appears
      }
      return applyHumanMove(from, to);
    },
    [applyHumanMove, engineState, fen, humanColor, isHumanTurn],
  );

  const onPromotionPick = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) return;
      applyHumanMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
    },
    [applyHumanMove, pendingPromotion],
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
      return attemptHumanMove(sourceSquare, targetSquare);
    },
    [attemptHumanMove],
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!isHumanTurn) return;
      if (selectedSquare && selectedSquare !== square) {
        const ok = attemptHumanMove(selectedSquare, square);
        if (ok) return;
        if (pendingPromotion) {
          setSelectedSquare(null);
          return;
        }
      }
      const targets = legalTargetsFrom(new Chess(fen), square);
      // Only let humans select their own pieces (legalTargets returns [] otherwise)
      setSelectedSquare(targets.length > 0 ? square : null);
    },
    [attemptHumanMove, fen, isHumanTurn, pendingPromotion, selectedSquare],
  );

  const onUndo = useCallback(() => {
    if (engineState === "thinking") return;
    // Undo human's last move plus the AI's reply that triggered it (two plies),
    // so it's the human's turn again. If only one ply exists (we played black),
    // a single undo suffices.
    const undoneA = chessRef.current.undo();
    if (!undoneA) return;
    const turnAfterA = chessRef.current.turn();
    if (turnAfterA !== humanColor) {
      chessRef.current.undo();
    }
    setSelectedSquare(null);
    syncFromChess();
  }, [engineState, humanColor, syncFromChess]);

  const onFlip = useCallback(() => {
    setHumanColor((c) => (c === "w" ? "b" : "w"));
  }, []);

  const onNewGame = useCallback(
    async (color: HumanColor, diffId: Difficulty["id"]) => {
      if (
        moves.length > 0 &&
        typeof window !== "undefined" &&
        !window.confirm("Start a new game? Current progress will be lost.")
      ) {
        return;
      }
      chessRef.current = new Chess();
      setHumanColor(color);
      setDifficultyId(diffId);
      setSelectedSquare(null);
      clearAiGame();
      syncFromChess();
      // Tell the engine it's a new game and update skill level
      const engine = engineRef.current;
      if (engine) {
        setEngineState("thinking");
        try {
          await engine.newGame(getDifficulty(diffId).skillLevel);
          if (aliveRef.current) setEngineState("ready");
        } catch {
          if (aliveRef.current) setEngineState("error");
        }
      }
    },
    [moves.length, syncFromChess],
  );

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

  const boardOrientation = humanColor === "w" ? "white" : "black";
  const boardDisabled =
    !mounted ||
    engineState === "loading" ||
    engineState === "error" ||
    status.kind !== "ongoing" ||
    !isHumanTurn;

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
          orientation={boardOrientation}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          highlightedSquares={highlightedSquares}
          disabled={boardDisabled}
        />
      </div>
      <div className="flex flex-col gap-4 md:w-80">
        <StatusBanner status={status} />
        <EngineIndicator state={engineState} difficulty={difficulty} />
        <DifficultySelect
          value={difficultyId}
          onChange={setDifficultyId}
          disabled={engineState === "thinking"}
        />
        <SideAndControls
          humanColor={humanColor}
          onFlip={onFlip}
          onUndo={onUndo}
          canUndo={moves.length > 0 && engineState !== "thinking"}
          onNewGameAs={(c) => onNewGame(c, difficultyId)}
        />
        <MoveHistory moves={moves} />
      </div>
      <PromotionPicker
        open={pendingPromotion !== null}
        color={pendingPromotion?.color ?? humanColor}
        onPick={onPromotionPick}
        onCancel={onPromotionCancel}
      />
    </div>
  );
}

function EngineIndicator({
  state,
  difficulty,
}: {
  state: "loading" | "ready" | "thinking" | "error";
  difficulty: Difficulty;
}) {
  let label: string;
  let palette: string;
  if (state === "loading") {
    label = "Loading Stockfish…";
    palette = "border-foreground/15 bg-foreground/5";
  } else if (state === "error") {
    label = "Engine failed to load. Try reloading the page.";
    palette =
      "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100";
  } else if (state === "thinking") {
    label = `Stockfish (${difficulty.label}) is thinking…`;
    palette =
      "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100";
  } else {
    label = `Stockfish ready · ${difficulty.label}`;
    palette = "border-foreground/15 bg-foreground/5";
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-md border px-3 py-2 text-sm ${palette}`}
    >
      {label}
    </div>
  );
}

function DifficultySelect({
  value,
  onChange,
  disabled,
}: {
  value: Difficulty["id"];
  onChange: (id: Difficulty["id"]) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-foreground/60">Difficulty</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Difficulty["id"])}
        disabled={disabled}
        className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm disabled:opacity-50"
      >
        {DIFFICULTIES.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label} — {d.description}
          </option>
        ))}
      </select>
    </label>
  );
}

function SideAndControls({
  humanColor,
  onFlip,
  onUndo,
  canUndo,
  onNewGameAs,
}: {
  humanColor: HumanColor;
  onFlip: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onNewGameAs: (color: HumanColor) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-foreground/60">
        You play as{" "}
        <strong className="text-foreground">
          {humanColor === "w" ? "White" : "Black"}
        </strong>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SmallButton onClick={onUndo} disabled={!canUndo}>
          ← Undo
        </SmallButton>
        <SmallButton onClick={onFlip}>Flip board</SmallButton>
        <SmallButton onClick={() => onNewGameAs("w")}>
          New · play White
        </SmallButton>
        <SmallButton onClick={() => onNewGameAs("b")}>
          New · play Black
        </SmallButton>
      </div>
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
