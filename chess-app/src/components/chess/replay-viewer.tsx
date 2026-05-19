"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "./board";
import type { MoveRecord } from "@/lib/chess/game";

type ReplayProps = {
  pgn: string;
  orientation?: "white" | "black";
};

type ReplayState = {
  fens: string[]; // index 0 = starting position
  moves: MoveRecord[]; // length = fens.length - 1
};

function buildReplay(pgn: string): ReplayState {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return { fens: [new Chess().fen()], moves: [] };
  }
  const verbose = chess.history({ verbose: true });
  const fens: string[] = [];
  // Walk fresh from the start position to collect FENs after each move.
  const walker = new Chess();
  fens.push(walker.fen());
  for (const m of verbose) {
    try {
      walker.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      break;
    }
    fens.push(walker.fen());
  }
  const moves: MoveRecord[] = verbose.map((m) => ({
    san: m.san,
    color: m.color,
    from: m.from,
    to: m.to,
    fenAfter: m.after,
  }));
  return { fens, moves };
}

export function ReplayViewer({ pgn, orientation = "white" }: ReplayProps) {
  const replay = useMemo(() => buildReplay(pgn), [pgn]);
  const [index, setIndex] = useState<number>(replay.fens.length - 1);
  const [boardOrientation, setBoardOrientation] = useState<
    "white" | "black"
  >(orientation);

  // If pgn changes (different game), jump to the end.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(replay.fens.length - 1);
  }, [replay]);

  // Keyboard navigation: ← → Home End
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight")
        setIndex((i) => Math.min(replay.fens.length - 1, i + 1));
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(replay.fens.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay.fens.length]);

  const fen = replay.fens[index] ?? replay.fens[0];
  const atStart = index === 0;
  const atEnd = index === replay.fens.length - 1;

  const movesPaired = useMemo(() => {
    const pairs: { no: number; white?: MoveRecord; black?: MoveRecord }[] = [];
    for (let i = 0; i < replay.moves.length; i += 2) {
      pairs.push({
        no: i / 2 + 1,
        white: replay.moves[i],
        black: replay.moves[i + 1],
      });
    }
    return pairs;
  }, [replay.moves]);

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="md:flex-1">
        <Board
          fen={fen}
          orientation={boardOrientation}
          onPieceDrop={() => false}
          disabled
        />
      </div>
      <div className="flex flex-col gap-3 md:w-80">
        <div className="flex items-center justify-between text-sm">
          <div className="text-foreground/60">
            Move{" "}
            <strong className="text-foreground">
              {index === 0 ? "Start" : Math.ceil(index / 2)}
              {index > 0 ? (index % 2 === 1 ? "." : "...") : ""}
            </strong>{" "}
            of {replay.moves.length}
          </div>
          <button
            type="button"
            onClick={() =>
              setBoardOrientation((o) => (o === "white" ? "black" : "white"))
            }
            className="rounded-md border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/5"
          >
            Flip
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <NavButton onClick={() => setIndex(0)} disabled={atStart}>
            ⏮
          </NavButton>
          <NavButton
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={atStart}
          >
            ←
          </NavButton>
          <NavButton
            onClick={() =>
              setIndex((i) => Math.min(replay.fens.length - 1, i + 1))
            }
            disabled={atEnd}
          >
            →
          </NavButton>
          <NavButton
            onClick={() => setIndex(replay.fens.length - 1)}
            disabled={atEnd}
          >
            ⏭
          </NavButton>
        </div>
        <div className="overflow-hidden rounded-md border border-foreground/15">
          <div className="border-b border-foreground/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Moves — click to jump
          </div>
          {movesPaired.length === 0 ? (
            <div className="px-3 py-3 text-sm text-foreground/50">
              No moves recorded.
            </div>
          ) : (
            <ol className="max-h-72 overflow-y-auto font-mono text-sm">
              {movesPaired.map((p) => (
                <li
                  key={p.no}
                  className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 border-b border-foreground/5 px-3 py-1.5 last:border-b-0"
                >
                  <span className="text-foreground/40">{p.no}.</span>
                  <ClickableMove
                    san={p.white?.san}
                    onClick={() => setIndex(2 * (p.no - 1) + 1)}
                    active={index === 2 * (p.no - 1) + 1}
                  />
                  <ClickableMove
                    san={p.black?.san}
                    onClick={() => setIndex(2 * p.no)}
                    active={index === 2 * p.no}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({
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

function ClickableMove({
  san,
  onClick,
  active,
}: {
  san: string | undefined;
  onClick: () => void;
  active: boolean;
}) {
  if (!san) return <span />;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left transition ${
        active
          ? "rounded bg-foreground/10 px-1 font-semibold"
          : "hover:text-foreground/80"
      }`}
    >
      {san}
    </button>
  );
}
