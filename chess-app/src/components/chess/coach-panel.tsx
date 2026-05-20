"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StockfishEngine } from "@/lib/chess/engine";
import { getCluster } from "@/lib/training/clusters";
import type { HumanColor } from "@/lib/supabase/games";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  recordAnalysisWeaknesses,
  saveGameAnalysis,
  type GameAnalysisRow,
} from "@/lib/supabase/game-analysis";
import { Board, type BoardArrow } from "./board";
import {
  analyzeGame,
  type AnalysisProgress,
  type Blunder,
  type Severity,
} from "@/lib/coach/analyze";

type State =
  | { kind: "idle" }
  | { kind: "analyzing"; progress: AnalysisProgress }
  | {
      kind: "done";
      blunders: Blunder[];
      analysis: GameAnalysisRow | null;
      saved: boolean;
      profiled: boolean;
    }
  | { kind: "error"; message: string };

export function CoachPanel({
  pgn,
  gameId,
  humanColor,
  initialAnalysis,
}: {
  pgn: string;
  gameId?: string;
  humanColor?: HumanColor | null;
  initialAnalysis?: GameAnalysisRow | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<State>(() =>
    initialAnalysis
      ? {
          kind: "done",
          blunders: initialAnalysis.blunders,
          analysis: initialAnalysis,
          saved: true,
          profiled: true,
        }
      : { kind: "idle" },
  );
  const engineRef = useRef<StockfishEngine | null>(null);
  const cancelRef = useRef(false);
  const hasPersistedAnalysisRef = useRef(Boolean(initialAnalysis));

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const onAnalyze = useCallback(async () => {
    cancelRef.current = false;
    setState({ kind: "analyzing", progress: { done: 0, total: 1 } });
    try {
      engineRef.current?.dispose();
      const engine = new StockfishEngine();
      engineRef.current = engine;
      await engine.init();
      await engine.newGame(20);
      const analysisDepth = 8;
      const blunders = await analyzeGame(engine, pgn, {
        depth: analysisDepth,
        sideToAnalyze: humanColor ?? "both",
        maxBestMoveAnnotations: 5,
        onProgress: (p) =>
          setState((s) =>
            s.kind === "analyzing" ? { kind: "analyzing", progress: p } : s,
          ),
        shouldCancel: () => cancelRef.current,
      });
      if (cancelRef.current) return;

      let savedAnalysis: GameAnalysisRow | null = null;
      let profiled = false;
      const shouldRecordProfile =
        Boolean(gameId) && !hasPersistedAnalysisRef.current;
      if (gameId) {
        savedAnalysis = await saveGameAnalysis(supabase, {
          game_id: gameId,
          analysis_depth: analysisDepth,
          blunders,
        });
        if (savedAnalysis) {
          if (shouldRecordProfile) {
            await recordAnalysisWeaknesses(supabase, blunders);
            profiled = true;
          }
          hasPersistedAnalysisRef.current = true;
        }
      }

      if (cancelRef.current) return;
      setState({
        kind: "done",
        blunders,
        analysis: savedAnalysis,
        saved: Boolean(savedAnalysis),
        profiled,
      });
    } catch (err) {
      if (cancelRef.current) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "analysis failed",
      });
    }
    }, [gameId, humanColor, pgn, supabase]);

  if (state.kind === "idle") {
    return (
      <section className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          AI Coach
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Run Stockfish over {humanColor ? "your moves" : "the game"} and flag
          the moments that lost material or position. The worst notes get visual
          best-move arrows and are saved for the tutor.
        </p>
        <button
          type="button"
          onClick={onAnalyze}
          className="mt-3 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Analyze this game →
        </button>
      </section>
    );
  }

  if (state.kind === "analyzing") {
    const pct = Math.round(
      (state.progress.done / Math.max(1, state.progress.total)) * 100,
    );
    return (
      <section className="mt-6 rounded-lg border border-sky-500/40 bg-sky-500/[0.07] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Analyzing…
          </h2>
          <span className="font-mono text-xs text-foreground/60">
            {state.progress.done}/{state.progress.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-sky-500 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-foreground/55">
          Stockfish is evaluating {humanColor ? "your moves" : "both sides"} at
          depth 8 and adding arrows to the five biggest swings. Cached reviews
          load instantly next time.
        </p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
        <h2 className="font-semibold text-red-900 dark:text-red-100">
          Analysis failed
        </h2>
        <p className="mt-1 text-red-900/80 dark:text-red-100/80">
          {state.message}
        </p>
        <button
          type="button"
          onClick={onAnalyze}
          className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs hover:bg-red-500/10"
        >
          Try again
        </button>
      </section>
    );
  }

  // state.kind === "done"
  const reviewedAt = state.analysis?.analyzed_at
    ? new Date(state.analysis.analyzed_at).toLocaleString()
    : null;
  return (
    <section className="mt-6 rounded-lg border border-foreground/10 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            AI Coach · {state.blunders.length} note
            {state.blunders.length === 1 ? "" : "s"}
          </h2>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-foreground/55">
            {state.saved ? (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-2 py-0.5">
                {reviewedAt ? `Cached ${reviewedAt}` : "Saved to tutor memory"}
              </span>
            ) : gameId ? (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/[0.06] px-2 py-0.5">
                Analysis not saved
              </span>
            ) : null}
            {state.profiled ? (
              <span className="rounded-full border border-sky-500/25 bg-sky-500/[0.06] px-2 py-0.5">
                Weak spots updated
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          title="Runs Stockfish again and overwrites the cached review."
          className="text-xs text-foreground/60 hover:text-foreground"
        >
          Re-analyze (costly)
        </button>
      </div>
      {state.blunders.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/60">
          No significant blunders or mistakes detected. Clean game.
        </p>
      ) : (
        <>
          {state.analysis?.summary ? (
            <div className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/70">
              {state.analysis.summary}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <LegendDot color="bg-red-500" label="played mistake" />
            <LegendDot color="bg-emerald-500" label="better move" />
            <span className="rounded-full border border-foreground/10 px-2 py-1 text-foreground/60">
              themes are likely estimates
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {state.blunders.map((b) => (
              <BlunderRow key={b.ply} blunder={b} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2 py-1 text-foreground/60">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

type ExplainResponse = {
  explanation: string;
  source: "gemini" | "placeholder";
  reason?: string;
};

function BlunderRow({ blunder }: { blunder: Blunder }) {
  const [response, setResponse] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchExplanation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fenBefore: blunder.fenBefore,
          san: blunder.san,
          evalDropCp: blunder.evalDropCp,
          severity: blunder.severity,
          color: blunder.color,
          bestMoveSan: blunder.bestMoveSan,
        }),
      });
      const data = (await res.json()) as ExplainResponse;
      setResponse(data);
    } catch {
      setResponse({
        explanation: "(failed to load explanation)",
        source: "placeholder",
        reason: "fetch_failed",
      });
    } finally {
      setLoading(false);
    }
  }, [blunder]);

  const isPlaceholder = response?.source === "placeholder";
  const canRetry =
    isPlaceholder && response?.reason && response.reason !== "missing_key";

  return (
    <li
      className={`rounded-md border p-3 text-sm ${severityClasses(blunder.severity)}`}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(220px,0.95fr)_1fr]">
        <MistakeBoard blunder={blunder} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-xs text-foreground/55">
              {blunder.moveNumber}.{blunder.color === "b" ? ".." : ""}
            </span>
            <span className="font-mono font-semibold">{blunder.san}</span>
            <span className="text-xs uppercase tracking-wide opacity-80">
              {blunder.severity}
            </span>
            <span
              className="ml-auto font-mono text-xs"
              title={`Eval dropped by ${(blunder.evalDropCp / 100).toFixed(2)} pawn-equivalents. 1 pawn ≈ 100 centipawns.`}
            >
              −{(blunder.evalDropCp / 100).toFixed(1)} (
              {pawnDescriptor(blunder.evalDropCp)})
            </span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <MoveBadge
              label="Played"
              value={`${blunder.san} (${blunder.from}${blunder.to})`}
              tone="bad"
            />
            <MoveBadge
              label="Better"
              value={
                blunder.bestMoveSan && blunder.bestMoveUci
                  ? `${blunder.bestMoveSan} (${blunder.bestMoveUci})`
                  : "Stockfish did not return a move"
              }
              tone="good"
            />
          </div>

          {blunder.themes.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blunder.themes.map((theme) => {
                const cluster = getCluster(theme);
                return (
                  <span
                    key={theme}
                    title="Likely theme estimated from Stockfish and the board pattern."
                    className="rounded-full border border-foreground/10 bg-background/40 px-2 py-0.5 text-[11px] text-foreground/60"
                  >
                    <span aria-hidden>{cluster.icon}</span> {cluster.label}
                  </span>
                );
              })}
            </div>
          ) : null}

          {response ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">
                {response.explanation}
              </p>
              {canRetry ? (
                <button
                  type="button"
                  onClick={fetchExplanation}
                  disabled={loading}
                  className="mt-2 text-xs underline decoration-dotted underline-offset-2 hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? "Retrying…" : "Retry"}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={fetchExplanation}
              disabled={loading}
              className="mt-2 inline-flex items-center text-xs underline decoration-dotted underline-offset-2 hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "Loading coach…" : "Coach says…"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function MistakeBoard({ blunder }: { blunder: Blunder }) {
  const arrows: BoardArrow[] = [
    {
      startSquare: blunder.from,
      endSquare: blunder.to,
      color: "#ef4444",
    },
  ];

  if (
    blunder.bestMoveFrom &&
    blunder.bestMoveTo &&
    (blunder.bestMoveFrom !== blunder.from || blunder.bestMoveTo !== blunder.to)
  ) {
    arrows.push({
      startSquare: blunder.bestMoveFrom,
      endSquare: blunder.bestMoveTo,
      color: "#10b981",
    });
  }

  const highlightedSquares: Record<string, React.CSSProperties> = {
    [blunder.from]: {
      boxShadow: "inset 0 0 0 4px rgba(239, 68, 68, 0.38)",
    },
    [blunder.to]: {
      background:
        "radial-gradient(circle, rgba(239,68,68,0.45) 38%, transparent 42%)",
    },
  };

  if (blunder.bestMoveFrom) {
    highlightedSquares[blunder.bestMoveFrom] = {
      ...(highlightedSquares[blunder.bestMoveFrom] ?? {}),
      boxShadow: "inset 0 0 0 4px rgba(16, 185, 129, 0.38)",
    };
  }
  if (blunder.bestMoveTo) {
    highlightedSquares[blunder.bestMoveTo] = {
      ...(highlightedSquares[blunder.bestMoveTo] ?? {}),
      background:
        "radial-gradient(circle, rgba(16,185,129,0.45) 38%, transparent 42%)",
    };
  }

  return (
    <div className="rounded-md border border-foreground/10 bg-background/60 p-2">
      <Board
        id={`coach-mistake-${blunder.ply}`}
        fen={blunder.fenBefore}
        orientation={blunder.color === "w" ? "white" : "black"}
        onPieceDrop={() => false}
        highlightedSquares={highlightedSquares}
        arrows={arrows}
        disabled
      />
      <div className="mt-2 text-center text-[11px] text-foreground/55">
        Position before the mistake
      </div>
    </div>
  );
}

function MoveBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "bad" | "good";
}) {
  const palette =
    tone === "bad"
      ? "border-red-500/30 bg-red-500/[0.06]"
      : "border-emerald-500/30 bg-emerald-500/[0.06]";
  return (
    <div className={`rounded-md border px-2 py-1.5 ${palette}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono">{value}</div>
    </div>
  );
}

/**
 * Translate a centipawn drop into a plain-English magnitude — so non-chess
 * players reading the coach panel know what "1.1 pawns" actually means.
 */
function pawnDescriptor(cpDrop: number): string {
  const p = cpDrop / 100;
  if (p < 0.75) return "slight slip";
  if (p < 1.75) return "≈ a pawn";
  if (p < 3.25) return "≈ a minor piece";
  if (p < 5.5) return "≈ a rook";
  return "decisive";
}

function severityClasses(s: Severity): string {
  if (s === "blunder")
    return "border-red-500/40 bg-red-500/[0.06] text-red-900 dark:text-red-100";
  if (s === "mistake")
    return "border-orange-500/40 bg-orange-500/[0.06] text-orange-900 dark:text-orange-100";
  return "border-amber-500/30 bg-amber-500/[0.04] text-amber-900 dark:text-amber-100";
}
