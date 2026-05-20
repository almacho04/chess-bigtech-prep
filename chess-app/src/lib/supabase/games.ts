import type { SupabaseClient } from "@supabase/supabase-js";

export type GameMode = "local" | "ai";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type OpponentDifficulty = "easy" | "medium" | "hard" | "master";
export type HumanColor = "w" | "b";

export type GameRow = {
  id: string;
  user_id: string;
  mode: GameMode;
  opponent_difficulty: OpponentDifficulty | null;
  human_color: HumanColor | null;
  game_hash?: string | null;
  pgn: string;
  result: GameResult;
  move_count: number;
  completed_at: string;
};

export type SaveGameInput = {
  mode: GameMode;
  pgn: string;
  result: GameResult;
  move_count: number;
  opponent_difficulty?: OpponentDifficulty | null;
  human_color?: HumanColor | null;
};

export async function saveGame(
  supabase: SupabaseClient,
  input: SaveGameInput,
): Promise<GameRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("games")
    .upsert(
      {
        user_id: userId,
        mode: input.mode,
        pgn: input.pgn,
        result: input.result,
        move_count: input.move_count,
        opponent_difficulty: input.opponent_difficulty ?? null,
        human_color: input.human_color ?? null,
      },
      { onConflict: "user_id,game_hash" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[saveGame] upsert failed", error);
    return null;
  }
  return data as GameRow;
}

export async function listGames(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
  opts: { dedupe?: boolean } = {},
): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listGames] select failed", error);
    return [];
  }
  const rows = (data ?? []) as GameRow[];
  return opts.dedupe === false ? rows : dedupeGames(rows);
}

export async function getGame(
  supabase: SupabaseClient,
  id: string,
): Promise<GameRow | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    return null;
  }
  return data as GameRow;
}

export function dedupeGames(
  games: readonly GameRow[],
  preferredIds: ReadonlySet<string> = new Set(),
): GameRow[] {
  const byKey = new Map<string, GameRow>();
  for (const game of games) {
    const key =
      game.game_hash ??
      [
        game.mode,
        game.opponent_difficulty ?? "",
        game.human_color ?? "",
        game.result,
        game.pgn,
      ].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, game);
      continue;
    }
    if (preferredIds.has(game.id) && !preferredIds.has(existing.id)) {
      byKey.set(key, game);
    }
  }
  return [...byKey.values()];
}
