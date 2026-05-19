const KEY = "chess.local-game.v1";

export type PersistedGame = {
  pgn: string;
  redoStack: string[];
  orientation: "white" | "black";
};

export function loadGame(): PersistedGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as PersistedGame).pgn !== "string" ||
      !Array.isArray((parsed as PersistedGame).redoStack)
    ) {
      return null;
    }
    const p = parsed as PersistedGame;
    return {
      pgn: p.pgn,
      redoStack: p.redoStack.filter((s) => typeof s === "string"),
      orientation: p.orientation === "black" ? "black" : "white",
    };
  } catch {
    return null;
  }
}

export function saveGame(game: PersistedGame): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // ignore quota / serialization errors
  }
}

export function clearGame(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
