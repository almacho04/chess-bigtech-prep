import assert from "node:assert/strict";
import test from "node:test";

import { scoreWeaknessesFrom } from "../src/lib/coach/weakness-scoring.ts";
import { dedupeGames } from "../src/lib/supabase/games.ts";
import { summarizeThemeStat } from "../src/lib/supabase/theme-stats.ts";

const baseGame = {
  id: "game-a",
  user_id: "user-a",
  mode: "ai",
  opponent_difficulty: "easy",
  human_color: "w",
  game_hash: "same-hash",
  pgn: "1. e4 e5",
  result: "1-0",
  move_count: 2,
  completed_at: "2026-05-20T00:00:00.000Z",
};

test("dedupeGames keeps one row per game hash and prefers analyzed ids", () => {
  const rows = [
    baseGame,
    {
      ...baseGame,
      id: "game-b",
      completed_at: "2026-05-20T00:01:00.000Z",
    },
  ];

  assert.deepEqual(
    dedupeGames(rows, new Set(["game-b"])).map((game) => game.id),
    ["game-b"],
  );
});

test("dedupeGames falls back to stable PGN fingerprint when game_hash is absent", () => {
  const rows = [
    { ...baseGame, id: "game-a", game_hash: null },
    { ...baseGame, id: "game-b", game_hash: null },
    { ...baseGame, id: "game-c", game_hash: null, pgn: "1. d4 d5" },
  ];

  assert.deepEqual(
    dedupeGames(rows).map((game) => game.id),
    ["game-a", "game-c"],
  );
});

test("summarizeThemeStat keeps puzzle accuracy separate from game signals", () => {
  const summary = summarizeThemeStat({
    user_id: "user-a",
    theme: "fork",
    attempts: 99,
    successes: 10,
    failures: 89,
    xp: 250,
    current_streak: 1,
    best_streak: 4,
    last_outcome: "fail",
    last_attempted_at: "2026-05-20T00:00:00.000Z",
    puzzle_attempts: 4,
    puzzle_successes: 3,
    puzzle_failures: 1,
    game_mistake_signals: 2,
    game_weakness_score: 9,
    last_signal_source: "game",
    updated_at: "2026-05-20T00:00:00.000Z",
  });

  assert.equal(summary.accuracy, 0.75);
  assert.equal(summary.puzzleWeaknessScore, 4);
  assert.equal(summary.gameWeaknessScore, 9);
  assert.equal(summary.weaknessScore, 13);
});

test("scoreWeaknessesFrom weights blunders above mistakes and inaccuracies", () => {
  const scores = scoreWeaknessesFrom([
    { themes: ["fork"], severity: "blunder" },
    { themes: ["pin"], severity: "mistake" },
    { themes: ["pin"], severity: "inaccuracy" },
    { themes: ["hangingPiece"], severity: "inaccuracy" },
  ]);

  assert.deepEqual(scores, [
    { theme: "fork", score: 4 },
    { theme: "pin", score: 3 },
    { theme: "hangingPiece", score: 1 },
  ]);
});
