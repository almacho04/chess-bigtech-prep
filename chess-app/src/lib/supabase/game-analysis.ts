import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClusterId } from "@/lib/training/clusters";
import type { Blunder, Severity } from "@/lib/coach/analyze";
import { recordThemeAttempt } from "./theme-stats";

export type GameAnalysisRow = {
  id: string;
  user_id: string;
  game_id: string;
  analysis_depth: number;
  inaccuracy_count: number;
  mistake_count: number;
  blunder_count: number;
  top_weaknesses: ClusterId[];
  summary: string;
  blunders: Blunder[];
  analyzed_at: string;
  updated_at: string;
};

export type SaveGameAnalysisInput = {
  game_id: string;
  analysis_depth: number;
  blunders: Blunder[];
};

export async function getGameAnalysis(
  supabase: SupabaseClient,
  gameId: string,
): Promise<GameAnalysisRow | null> {
  const { data, error } = await supabase
    .from("game_analyses")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    console.error("[getGameAnalysis] select failed", error);
    return null;
  }
  return data ? normalizeRow(data as GameAnalysisRow) : null;
}

export async function listGameAnalyses(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<GameAnalysisRow[]> {
  const { data, error } = await supabase
    .from("game_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listGameAnalyses] select failed", error);
    return [];
  }
  return ((data ?? []) as GameAnalysisRow[]).map(normalizeRow);
}

export async function saveGameAnalysis(
  supabase: SupabaseClient,
  input: SaveGameAnalysisInput,
): Promise<GameAnalysisRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const summary = buildAnalysisSummary(input.blunders);
  const topWeaknesses = topWeaknessesFrom(input.blunders);
  const counts = countBySeverity(input.blunders);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("game_analyses")
    .upsert(
      {
        user_id: userId,
        game_id: input.game_id,
        analysis_depth: input.analysis_depth,
        inaccuracy_count: counts.inaccuracy,
        mistake_count: counts.mistake,
        blunder_count: counts.blunder,
        top_weaknesses: topWeaknesses,
        summary,
        blunders: input.blunders,
        analyzed_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,game_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[saveGameAnalysis] upsert failed", error);
    return null;
  }
  return normalizeRow(data as GameAnalysisRow);
}

/**
 * Feed game-review weak spots back into the tutor profile. Call this only when
 * a game is analyzed for the first time; repeated re-analysis should update the
 * analysis row without double-counting profile weaknesses.
 */
export async function recordAnalysisWeaknesses(
  supabase: SupabaseClient,
  blunders: readonly Blunder[],
): Promise<void> {
  const themes = topWeaknessesFrom(blunders, 3);
  for (const theme of themes) {
    await recordThemeAttempt(supabase, theme, "fail");
  }
}

export function topWeaknessesFrom(
  blunders: readonly Pick<Blunder, "themes" | "severity">[],
  limit = 3,
): ClusterId[] {
  const scores = new Map<ClusterId, number>();
  for (const b of blunders) {
    const weight = severityWeight(b.severity);
    for (const theme of b.themes) {
      scores.set(theme, (scores.get(theme) ?? 0) + weight);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([theme]) => theme);
}

export function buildAnalysisSummary(blunders: readonly Blunder[]): string {
  if (blunders.length === 0) {
    return "No major mistakes were detected. The tutor did not add any new weak-spot tags from this game.";
  }

  const counts = countBySeverity(blunders);
  const themes = topWeaknessesFrom(blunders);
  const themeText =
    themes.length > 0
      ? themes.join(", ")
      : "general calculation and move safety";

  return [
    `Stockfish found ${counts.blunder} blunder${counts.blunder === 1 ? "" : "s"}, ${counts.mistake} mistake${counts.mistake === 1 ? "" : "s"}, and ${counts.inaccuracy} inaccuracy${counts.inaccuracy === 1 ? "" : "ies"}.`,
    `The main tutor focus from this game is: ${themeText}.`,
    "Those themes now feed your dashboard and training recommendations.",
  ].join(" ");
}

function countBySeverity(blunders: readonly Pick<Blunder, "severity">[]) {
  const counts: Record<Severity, number> = {
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  for (const b of blunders) counts[b.severity] += 1;
  return counts;
}

function severityWeight(severity: Severity): number {
  if (severity === "blunder") return 4;
  if (severity === "mistake") return 2;
  return 1;
}

function normalizeRow(row: GameAnalysisRow): GameAnalysisRow {
  return {
    ...row,
    top_weaknesses: (row.top_weaknesses ?? []) as ClusterId[],
    blunders: (row.blunders ?? []) as Blunder[],
  };
}
