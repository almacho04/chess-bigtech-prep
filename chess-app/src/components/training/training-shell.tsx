"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PUZZLES,
  getDailyPuzzle,
  getPuzzleById,
  getPuzzlesByCluster,
  type Puzzle,
} from "@/lib/training/puzzles";
import { CLUSTERS, getCluster, type ClusterId } from "@/lib/training/clusters";
import { computeStreak, type StreakInfo } from "@/lib/training/streak";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getAttemptDates,
  listDueToday,
} from "@/lib/supabase/puzzle-attempts";
import { PuzzleSolver } from "./puzzle-solver";
import { StreakBadge, StreakBanner } from "./streak-badge";

export function TrainingShell() {
  const daily = useMemo(() => getDailyPuzzle(), []);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentClusterId, setCurrentClusterId] =
    useState<ClusterId | null>(null);
  const [dueIds, setDueIds] = useState<string[] | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Fetch SR + streak data on mount (and after each puzzle attempt by remount).
  useEffect(() => {
    let active = true;
    listDueToday(supabase).then((ids) => {
      if (active) setDueIds(ids);
    });
    getAttemptDates(supabase, 60).then((dates) => {
      if (active) setStreak(computeStreak(dates));
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

  // Puzzle currently being solved, if any.
  const current = currentId ? getPuzzleById(currentId) : null;

  // When inside a cluster, "Next puzzle" cycles through THAT cluster only;
  // otherwise it cycles through the full bank.
  const cycleList: Puzzle[] = useMemo(() => {
    if (currentClusterId) return getPuzzlesByCluster(currentClusterId);
    return [...PUZZLES];
  }, [currentClusterId]);

  const currentIndex = useMemo(
    () => (current ? cycleList.findIndex((p) => p.id === current.id) : -1),
    [current, cycleList],
  );
  const hasNext = currentIndex >= 0 && currentIndex < cycleList.length - 1;

  const onNext = useCallback(() => {
    if (currentIndex < 0) return;
    const next = cycleList[currentIndex + 1];
    if (next) setCurrentId(next.id);
  }, [currentIndex, cycleList]);

  // --- Solving a specific puzzle -------------------------------------------
  if (current) {
    return (
      <div className="flex flex-col">
        <div className="border-b border-foreground/10 bg-foreground/[0.02] px-4 py-2 md:px-6">
          <button
            type="button"
            onClick={() => setCurrentId(null)}
            className="text-xs text-foreground/60 hover:text-foreground"
          >
            ← {currentClusterId
              ? `Back to ${getCluster(currentClusterId).label}`
              : "All training"}
          </button>
        </div>
        <PuzzleSolver puzzle={current} onNext={onNext} hasNext={hasNext} />
      </div>
    );
  }

  // --- Inside a cluster (list view) ----------------------------------------
  if (currentClusterId) {
    const cluster = getCluster(currentClusterId);
    const puzzles = getPuzzlesByCluster(currentClusterId);
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <button
          type="button"
          onClick={() => setCurrentClusterId(null)}
          className="mb-3 text-xs text-foreground/60 hover:text-foreground"
        >
          ← All clusters
        </button>
        <header className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl" aria-hidden>
              {cluster.icon}
            </span>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {cluster.label}
            </h1>
            <span className="ml-2 text-sm text-foreground/55">
              {puzzles.length} puzzle{puzzles.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-foreground/70">
            {cluster.description}
          </p>
          <p className="mt-1 max-w-2xl text-xs italic text-foreground/55">
            {cluster.prepAnalogy}
          </p>
        </header>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {puzzles.map((p) => (
            <PuzzleCard
              key={p.id}
              puzzle={p}
              onStart={() => setCurrentId(p.id)}
            />
          ))}
        </ul>
      </section>
    );
  }

  // --- Default landing view ------------------------------------------------
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Training
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/70 md:text-base">
            Tactical patterns framed as the same calculation-under-pressure
            you&rsquo;ll do in a BigTech onsite. Daily puzzle, themed packs,
            and a spaced-repetition queue for the ones you got wrong.
          </p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      <StreakBanner streak={streak} />

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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Choose a cluster
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLUSTERS.map((c) => {
            const count = getPuzzlesByCluster(c.id).length;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCurrentClusterId(c.id)}
                  disabled={count === 0}
                  className="block w-full rounded-lg border border-foreground/10 p-4 text-left transition hover:border-foreground/25 hover:bg-foreground/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg" aria-hidden>
                        {c.icon}
                      </span>
                      <span className="text-sm font-semibold">{c.label}</span>
                    </div>
                    <span className="font-mono text-[11px] text-foreground/40">
                      {count} puzzle{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-foreground/60">
                    {c.description}
                  </div>
                  <div className="mt-1 text-[11px] italic text-foreground/45">
                    {c.prepAnalogy}
                  </div>
                </button>
              </li>
            );
          })}
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
        Daily puzzle · {getCluster(puzzle.cluster).label}
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
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-foreground/40">
          <span>{puzzle.sideToMove === "w" ? "White" : "Black"} to move</span>
          {puzzle.rating ? <span>Rating {puzzle.rating}</span> : null}
        </div>
      </button>
    </li>
  );
}
