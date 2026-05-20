/**
 * Thin UCI wrapper around Stockfish running in a Web Worker.
 *
 * The engine files are vendored at /public/engines/ so the Worker loads them
 * same-origin (no bundler involvement). All methods are no-ops on the server.
 */

import type { Difficulty } from "./difficulty";

export type UciMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

const WORKER_URL = "/engines/stockfish.wasm.js";
const DEBUG =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners = new Set<(line: string) => void>();
  private readyPromise: Promise<void> | null = null;

  /** Idempotent: subsequent calls return the same promise. */
  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    if (typeof window === "undefined") {
      return Promise.reject(new Error("Stockfish requires a browser"));
    }
    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(WORKER_URL);
      } catch (err) {
        reject(err);
        return;
      }
      this.worker.onmessage = (e) => {
        const line = String(e.data);
        if (DEBUG) {
          console.debug("[stockfish ←]", line);
        }
        for (const l of this.listeners) l(line);
      };
      this.worker.onerror = (err) => reject(err);
      const onLine = (line: string) => {
        if (line === "uciok") {
          this.listeners.delete(onLine);
          resolve();
        }
      };
      this.listeners.add(onLine);
      this.send("uci");
    });
    return this.readyPromise;
  }

  /** Should be called once per game before requesting moves. */
  async newGame(skillLevel: number): Promise<void> {
    await this.init();
    // Cancel any in-flight search before resetting engine state.
    this.send("stop");
    this.send("setoption name Hash value 64");
    this.send(`setoption name Skill Level value ${skillLevel}`);
    this.send("ucinewgame");
    this.send("isready");
    await this.waitForLine((l) => l === "readyok", { timeoutMs: 5000 });
  }

  /**
   * Ask for the best move from the given FEN. Capped by `depth` —
   * Stockfish.js v10's `movetime` is unreliable in this build, but `depth`
   * works correctly. Skill Level handles strength variance per difficulty.
   *
   * Returns `null` if the engine doesn't respond within a generous timeout —
   * lets the caller surface an error instead of hanging the UI.
   */
  async bestMove(fen: string, difficulty: Difficulty): Promise<UciMove | null> {
    await this.init();
    // Apply skill level on every move so mid-game difficulty changes take effect.
    this.send(`setoption name Skill Level value ${difficulty.skillLevel}`);
    // Cancel any leftover search before starting a new one.
    this.send("stop");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${difficulty.depth}`);
    // Generous safety net — depth N typically completes in seconds, but if the
    // worker crashes or the WASM hangs, we don't want to wedge the UI forever.
    const timeoutMs = 30_000;
    const line = await this.waitForLine(
      (l) => l.startsWith("bestmove"),
      { timeoutMs },
    );
    if (!line) {
      this.send("stop");
      if (DEBUG) {
        console.error(
          "[stockfish] bestmove timed out after",
          timeoutMs,
          "ms for fen",
          fen,
        );
      }
      return null;
    }
    return parseBestMove(line);
  }

  /**
   * Get a centipawn evaluation of a position. Always returned from White's
   * perspective (positive = white winning). Returns 0 on timeout / parse fail.
   * Mate-in-N is mapped to ±100000 cp so it sorts correctly without polluting
   * the centipawn range.
   */
  async evaluate(fen: string, depth: number): Promise<number> {
    await this.init();
    this.send("stop");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    let lastScore = 0;
    let sawScore = false;
    const line = await this.waitForLine(
      (l) => {
        // Capture the most recent score from `info depth N ... score cp X` lines.
        // Stockfish reports score from the side-to-move's perspective.
        const cpMatch = l.match(/\bscore cp (-?\d+)/);
        const mateMatch = l.match(/\bscore mate (-?\d+)/);
        if (cpMatch) {
          lastScore = parseInt(cpMatch[1], 10);
          sawScore = true;
        } else if (mateMatch) {
          const n = parseInt(mateMatch[1], 10);
          lastScore = n > 0 ? 100_000 : -100_000;
          sawScore = true;
        }
        return l.startsWith("bestmove");
      },
      { timeoutMs: 30_000 },
    );
    if (!line || !sawScore) return 0;
    const sideToMove = fen.split(" ")[1];
    return sideToMove === "b" ? -lastScore : lastScore;
  }

  /** Tear down the Worker. Safe to call multiple times. */
  dispose(): void {
    if (this.worker) {
      try {
        this.send("stop");
        this.send("quit");
      } catch {
        // ignore
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners.clear();
    this.readyPromise = null;
  }

  private send(cmd: string): void {
    if (DEBUG) {
      console.debug("[stockfish →]", cmd);
    }
    this.worker?.postMessage(cmd);
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    opts: { timeoutMs?: number } = {},
  ): Promise<string | null> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const listener = (line: string) => {
        if (!predicate(line)) return;
        this.listeners.delete(listener);
        if (timer) clearTimeout(timer);
        resolve(line);
      };
      this.listeners.add(listener);
      if (opts.timeoutMs) {
        timer = setTimeout(() => {
          this.listeners.delete(listener);
          resolve(null);
        }, opts.timeoutMs);
      }
    });
  }
}

function parseBestMove(line: string): UciMove | null {
  // Format: "bestmove e2e4" or "bestmove e7e8q" or "bestmove (none)"
  const parts = line.split(/\s+/);
  const move = parts[1];
  if (!move || move === "(none)") return null;
  if (move.length < 4) return null;
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const promo = move.length >= 5 ? move[4] : undefined;
  if (promo && !["q", "r", "b", "n"].includes(promo)) return null;
  return {
    from,
    to,
    promotion: promo as UciMove["promotion"],
  };
}
