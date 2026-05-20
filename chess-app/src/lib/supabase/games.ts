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
    console.warn("[saveGame] hash upsert failed; trying legacy save", error);
    return saveGameLegacy(supabase, userId, input);
  }
  return data as GameRow;
}

export async function listGames(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
  opts: { dedupe?: boolean } = {},
): Promise<GameRow[]> {
  const queryLimit =
    opts.dedupe === false ? limit : Math.min(Math.max(limit * 4, limit), 500);
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(queryLimit);
  if (error) {
    console.error("[listGames] select failed", error);
    return [];
  }
  const rows = (data ?? []) as GameRow[];
  return opts.dedupe === false ? rows : dedupeGames(rows).slice(0, limit);
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

async function saveGameLegacy(
  supabase: SupabaseClient,
  userId: string,
  input: SaveGameInput,
): Promise<GameRow | null> {
  let existingQuery = supabase
    .from("games")
    .select("*")
    .eq("user_id", userId)
    .eq("mode", input.mode)
    .eq("result", input.result)
    .eq("pgn", input.pgn);

  if (input.opponent_difficulty) {
    existingQuery = existingQuery.eq(
      "opponent_difficulty",
      input.opponent_difficulty,
    );
  } else {
    existingQuery = existingQuery.is("opponent_difficulty", null);
  }

  if (input.human_color) {
    existingQuery = existingQuery.eq("human_color", input.human_color);
  } else {
    existingQuery = existingQuery.is("human_color", null);
  }

  const { data: existing, error: existingError } = await existingQuery
    .order("completed_at", { ascending: false })
    .limit(1);

  if (existingError) {
    console.error("[saveGameLegacy] duplicate lookup failed", existingError);
    return null;
  }
  if (existing?.[0]) return existing[0] as GameRow;

  const { data, error } = await supabase
    .from("games")
    .insert({
      user_id: userId,
      mode: input.mode,
      pgn: input.pgn,
      result: input.result,
      move_count: input.move_count,
      opponent_difficulty: input.opponent_difficulty ?? null,
      human_color: input.human_color ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[saveGameLegacy] insert failed", error);
    return null;
  }

  return data as GameRow;
}
