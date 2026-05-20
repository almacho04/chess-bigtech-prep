"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StockfishEngine } from "@/lib/chess/engine";
import {
  analyzeGame,
  type AnalysisProgress,
  type Blunder,
  type Severity,
} from "@/lib/coach/analyze";

type State =
  | { kind: "idle" }
  | { kind: "analyzing"; progress: AnalysisProgress }
  | { kind: "done"; blunders: Blunder[] }
  | { kind: "error"; message: string };

export function CoachPanel({ pgn }: { pgn: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const engineRef = useRef<StockfishEngine | null>(null);
  const cancelRef = useRef(false);

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
      const blunders = await analyzeGame(engine, pgn, {
        depth: 8,
        onProgress: (p) =>
          setState((s) =>
            s.kind === "analyzing" ? { kind: "analyzing", progress: p } : s,
          ),
        shouldCancel: () => cancelRef.current,
      });
      if (cancelRef.current) return;
      setState({ kind: "done", blunders });
    } catch (err) {
      if (cancelRef.current) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "analysis failed",
      });
    }
  }, [pgn]);

  if (state.kind === "idle") {
    return (
      <section className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          AI Coach
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Run Stockfish over the game and flag every move that lost material
          or position. Each flagged move gets a plain-language coaching note.
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
          Stockfish is evaluating every position at depth 8. Depending on game
          length this takes ~30 s. Stays in your browser.
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
  return (
    <section className="mt-6 rounded-lg border border-foreground/10 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          AI Coach · {state.blunders.length} note
          {state.blunders.length === 1 ? "" : "s"}
        </h2>
        <button
          type="button"
          onClick={onAnalyze}
          className="text-xs text-foreground/60 hover:text-foreground"
        >
          Re-analyze
        </button>
      </div>
      {state.blunders.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/60">
          No significant blunders or mistakes detected. Clean game.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {state.blunders.map((b) => (
            <BlunderRow key={b.ply} blunder={b} />
          ))}
        </ul>
      )}
    </section>
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
          −{(blunder.evalDropCp / 100).toFixed(1)} ({pawnDescriptor(blunder.evalDropCp)})
        </span>
      </div>
      {response ? (
        <>
          <p className="mt-2 text-sm leading-relaxed">{response.explanation}</p>
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
          {loading ? "Loading coach…" : "💡 Coach says…"}
        </button>
      )}
    </li>
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
