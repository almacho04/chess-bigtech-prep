"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PUZZLES,
  getDailyPuzzle,
  getPuzzleById,
  type Puzzle,
} from "@/lib/training/puzzles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listDueToday } from "@/lib/supabase/puzzle-attempts";
import { PuzzleSolver } from "./puzzle-solver";

export function TrainingShell() {
  const daily = useMemo(() => getDailyPuzzle(), []);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [dueIds, setDueIds] = useState<string[] | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Fetch "due today" puzzles on mount; null = not yet loaded, [] = none due.
  useEffect(() => {
    let active = true;
    listDueToday(supabase).then((ids) => {
      if (active) setDueIds(ids);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const duePuzzles = useMemo<Puzzle[]>(() => {
    if (!dueIds) return [];
    return dueIds
      .map((id) => getPuzzleById(id))
      .filter((p): p is Puzzle => p !== undefined);
  }, [dueIds]);

  const currentIndex = useMemo(
    () => PUZZLES.findIndex((p) => p.id === currentId),
    [currentId],
  );
  const current = currentIndex >= 0 ? PUZZLES[currentIndex] : null;
  const hasNext = currentIndex >= 0 && currentIndex < PUZZLES.length - 1;

  const onNext = useCallback(() => {
    if (currentIndex < 0) return;
    const next = PUZZLES[currentIndex + 1];
    if (next) setCurrentId(next.id);
  }, [currentIndex]);

  if (current) {
    return (
      <div className="flex flex-col">
        <div className="border-b border-foreground/10 bg-foreground/[0.02] px-4 py-2 md:px-6">
          <button
            type="button"
            onClick={() => setCurrentId(null)}
            className="text-xs text-foreground/60 hover:text-foreground"
          >
            ← All training puzzles
          </button>
        </div>
        <PuzzleSolver puzzle={current} onNext={onNext} hasNext={hasNext} />
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Training
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70 md:text-base">
          Mate-in-1 patterns, framed as the same calculation-under-pressure
          you&rsquo;ll do in a BigTech onsite. Find the move that ends the
          game now, not three moves from now.
        </p>
      </div>

      <DailyCard puzzle={daily} onStart={() => setCurrentId(daily.id)} />

      {duePuzzles.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Due today
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {duePuzzles.length}
            </span>
          </h2>
          <p className="mb-2 max-w-2xl text-xs text-foreground/55">
            Puzzles you previously solved or missed are re-served on a
            spaced-repetition schedule — same loop as Anki.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {duePuzzles.map((p) => (
              <PuzzleCard
                key={p.id}
                puzzle={p}
                onStart={() => setCurrentId(p.id)}
                accent
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Pack — mates
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PUZZLES.map((p) => (
            <PuzzleCard key={p.id} puzzle={p} onStart={() => setCurrentId(p.id)} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function DailyCard({
  puzzle,
  onStart,
}: {
  puzzle: Puzzle;
  onStart: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Daily puzzle
      </div>
      <div className="mt-1 text-lg font-semibold">{puzzle.title}</div>
      <div className="mt-1 text-sm text-foreground/70">{puzzle.prompt}</div>
      <button
        type="button"
        onClick={onStart}
        className="mt-3 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
      >
        Solve now →
      </button>
    </div>
  );
}

function PuzzleCard({
  puzzle,
  onStart,
  accent = false,
}: {
  puzzle: Puzzle;
  onStart: () => void;
  accent?: boolean;
}) {
  const border = accent
    ? "border-amber-500/40 hover:border-amber-500/70 hover:bg-amber-500/[0.04]"
    : "border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03]";
  return (
    <li>
      <button
        type="button"
        onClick={onStart}
        className={`block w-full rounded-lg border p-4 text-left transition ${border}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{puzzle.title}</span>
          <span className="text-[10px] uppercase tracking-wide text-foreground/40">
            {puzzle.difficulty}
          </span>
        </div>
        <div className="mt-1 text-xs text-foreground/60">{puzzle.prompt}</div>
        <div className="mt-2 text-[11px] font-mono text-foreground/40">
          {puzzle.sideToMove === "w" ? "White" : "Black"} to move
        </div>
      </button>
    </li>
  );
}
