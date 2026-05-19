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
    this.send(`setoption name Skill Level value ${skillLevel}`);
    this.send("ucinewgame");
    this.send("isready");
    await this.waitForLine((l) => l === "readyok");
  }

  /** Ask for the best move from the given FEN. */
  async bestMove(fen: string, difficulty: Difficulty): Promise<UciMove | null> {
    await this.init();
    this.send(`position fen ${fen}`);
    this.send(`go depth ${difficulty.depth}`);
    const line = await this.waitForLine((l) => l.startsWith("bestmove"));
    return parseBestMove(line);
  }

  /** Tear down the Worker. Safe to call multiple times. */
  dispose(): void {
    if (this.worker) {
      try {
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
    this.worker?.postMessage(cmd);
  }

  private waitForLine(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (predicate(line)) {
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
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
