import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/header";
import { UnauthPanel } from "@/components/site/unauth-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/supabase/games";
import {
  listGameAnalyses,
  type GameAnalysisRow,
} from "@/lib/supabase/game-analysis";
import {
  listThemeStats,
  summarizeThemeStat,
  totalTutorXp,
  type ThemeStatSummary,
} from "@/lib/supabase/theme-stats";
import { getCluster, type ClusterId } from "@/lib/training/clusters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI tutor",
  description:
    "Your personal chess tutor profile — XP, weak spots, strong spots, and today's focus mission.",
};

const STARTER_FOCUS: readonly ClusterId[] = ["fork", "hangingPiece", "mateIn2"];

export default async function CoachPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex flex-1 flex-col">
        <SiteHeader
          rightContent={
            <span>
              <span className="text-foreground/40">mode:</span> AI tutor
            </span>
          }
        />
        <UnauthPanel
          title="Open your tutor profile"
          description="Sign in and the tutor will remember every puzzle you solve, surface your weakest themes, and pick today's focus for you."
          benefits={[
            "XP, level, and accuracy per tactical theme",
            "Weak spots ranked by frequency and severity",
            "Real-game memory from your analyzed Stockfish reviews",
            "A daily mission that adapts as you improve",
          ]}
        />
      </main>
    );
  }

  const [themeRows, games, gameAnalyses] = await Promise.all([
    listThemeStats(supabase),
    listGames(supabase, user.id, 100),
    listGameAnalyses(supabase, user.id, 20),
  ]);

  const stats = themeRows.map(summarizeThemeStat);
  const puzzleXp = totalTutorXp(themeRows);
  const gameXp = games.length * 15 + gameAnalyses.length * 30;
  const totalXp = puzzleXp + gameXp;
  const level = Math.floor(totalXp / 100) + 1;
  const levelProgress = totalXp % 100;
  const totalAttempts = stats.reduce((sum, s) => sum + s.puzzleAttempts, 0);
  const totalSuccesses = stats.reduce((sum, s) => sum + s.puzzleSuccesses, 0);
  const overallAccuracy =
    totalAttempts === 0 ? null : Math.round((totalSuccesses / totalAttempts) * 100);

  const weakSpots = [...stats]
    .filter(
      (s) =>
        s.puzzleAttempts > 0 && (s.puzzleFailures > 0 || s.accuracy < 0.65),
    )
    .sort(
      (a, b) =>
        b.puzzleWeaknessScore - a.puzzleWeaknessScore ||
        a.accuracy - b.accuracy ||
        b.puzzleAttempts - a.puzzleAttempts,
    )
    .slice(0, 3);

  const weakThemes = new Set(weakSpots.map((s) => s.theme));
  const strongSpots = [...stats]
    .filter(
      (s) =>
        s.puzzleAttempts >= 2 &&
        s.accuracy >= 0.7 &&
        s.puzzleSuccesses > s.puzzleFailures &&
        !weakThemes.has(s.theme),
    )
    .sort(
      (a, b) =>
        b.accuracy - a.accuracy ||
        b.best_streak - a.best_streak ||
        b.puzzleAttempts - a.puzzleAttempts,
    )
    .slice(0, 3);

  const gameWeakSpots = aggregateGameWeaknesses(gameAnalyses);
  const focusTheme = chooseFocusTheme(weakSpots, stats, gameWeakSpots);
  const focusCluster = getCluster(focusTheme);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> AI tutor
          </span>
        }
      />
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Personal tutor v2
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Your chess profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/70 md:text-base">
              The tutor remembers puzzle results and saved game reviews, finds
              weak themes, and turns them into a short training mission.
            </p>
          </div>
          <Link
            href="/training"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Start today&apos;s mission
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard
            label="Tutor level"
            value={`Level ${level}`}
            detail={`${levelProgress}/100 XP to next`}
          />
          <MetricCard
            label="Puzzle accuracy"
            value={overallAccuracy === null ? "New" : `${overallAccuracy}%`}
            detail={`${totalAttempts} puzzle attempts`}
          />
          <MetricCard
            label="Saved games"
            value={`${games.length}`}
            detail={`${gameAnalyses.length} analyzed`}
          />
          <MetricCard
            label="Focus now"
            value={focusCluster.label}
            detail={focusCluster.description}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <ThemePanel
            title="Puzzle weak spots"
            emptyTitle="No weak spots yet"
            emptyBody="Solve a few puzzles and the tutor will start ranking the themes that need attention."
            stats={weakSpots}
            tone="weak"
          />
          <ThemePanel
            title="Puzzle strong spots"
            emptyTitle="Strengths loading"
            emptyBody="Pass at least two puzzles in a theme and it can appear here as a strength."
            stats={strongSpots}
            tone="strong"
          />
        </div>

        <section className="mt-6 rounded-lg border border-foreground/10 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/55">
              Real-game memory
            </h2>
            <Link
              href="/history"
              className="text-xs text-foreground/55 hover:text-foreground"
            >
              Review saved games →
            </Link>
          </div>
          {gameAnalyses.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-foreground/15 p-4">
              <div className="text-sm font-medium">
                No analyzed games yet
              </div>
              <p className="mt-1 text-sm text-foreground/60">
                Open a saved game, run AI Coach, and the tutor will persist the
                mistake themes here.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.04] p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Most common from games
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {gameWeakSpots.map((item) => {
                    const cluster = getCluster(item.theme);
                    return (
                      <li
                        key={item.theme}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <span aria-hidden>{cluster.icon}</span>{" "}
                          {cluster.label}
                        </span>
                        <span
                          className="text-xs text-foreground/55"
                          title={`Internal weakness score: ${item.score}`}
                        >
                          {gameSignalLabel(item.score)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-md border border-foreground/10 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  Latest review
                </div>
                <p className="mt-2 text-sm text-foreground/70">
                  {gameAnalyses[0]?.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-sky-500/25 bg-sky-500/[0.04] p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Today&apos;s mission
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Train {focusCluster.label.toLowerCase()}
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              Do one focused cluster, then review one saved game. That gives
              the tutor fresh puzzle data plus a real-game mistake sample.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/training"
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Open training
              </Link>
              <Link
                href="/play/ai"
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm transition hover:bg-foreground/5"
              >
                Play vs AI
              </Link>
              <Link
                href="/history"
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm transition hover:bg-foreground/5"
              >
                Review games
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-foreground/10 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              How tutor memory works
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
              <li>Pass a puzzle: theme XP and streak go up.</li>
              <li>Miss a puzzle: that theme gets higher priority.</li>
              <li>Analyze a game: mistakes are tagged as separate real-game memory.</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}

function chooseFocusTheme(
  weakSpots: readonly ThemeStatSummary[],
  stats: readonly ThemeStatSummary[],
  gameWeakSpots: readonly GameWeakSpot[],
): ClusterId {
  if (weakSpots[0]) return weakSpots[0].theme;
  if (gameWeakSpots[0]) return gameWeakSpots[0].theme;
  const seen = new Set(stats.map((s) => s.theme));
  return STARTER_FOCUS.find((id) => !seen.has(id)) ?? STARTER_FOCUS[0];
}

type GameWeakSpot = {
  theme: ClusterId;
  score: number;
};

function aggregateGameWeaknesses(
  analyses: readonly GameAnalysisRow[],
): GameWeakSpot[] {
  const scores = new Map<ClusterId, number>();
  for (const analysis of analyses) {
    for (const theme of analysis.top_weaknesses) {
      scores.set(theme, (scores.get(theme) ?? 0) + 3);
    }
    for (const blunder of analysis.blunders) {
      const weight =
        blunder.severity === "blunder"
          ? 4
          : blunder.severity === "mistake"
            ? 2
            : 1;
      for (const theme of blunder.themes) {
        scores.set(theme, (scores.get(theme) ?? 0) + weight);
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme, score]) => ({ theme, score }));
}

function gameSignalLabel(score: number): string {
  if (score >= 20) return "very frequent";
  if (score >= 8) return "repeated";
  return "occasional";
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-foreground/55">{detail}</div>
    </div>
  );
}

function ThemePanel({
  title,
  emptyTitle,
  emptyBody,
  stats,
  tone,
}: {
  title: string;
  emptyTitle: string;
  emptyBody: string;
  stats: readonly ThemeStatSummary[];
  tone: "weak" | "strong";
}) {
  return (
    <section className="rounded-lg border border-foreground/10 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/55">
        {title}
      </h2>
      {stats.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-foreground/15 p-4">
          <div className="text-sm font-medium">{emptyTitle}</div>
          <p className="mt-1 text-sm text-foreground/60">{emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {stats.map((stat) => (
            <ThemeRow key={stat.theme} stat={stat} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ThemeRow({
  stat,
  tone,
}: {
  stat: ThemeStatSummary;
  tone: "weak" | "strong";
}) {
  const cluster = getCluster(stat.theme);
  const pct = Math.round(stat.accuracy * 100);
  const palette =
    tone === "weak"
      ? "border-amber-500/30 bg-amber-500/[0.05]"
      : "border-emerald-500/30 bg-emerald-500/[0.05]";

  return (
    <li className={`rounded-md border p-3 ${palette}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">
          <span aria-hidden>{cluster.icon}</span> {cluster.label}
        </div>
        <div className="font-mono text-sm">{pct}%</div>
      </div>
      <div className="mt-1 text-xs text-foreground/60">
        {stat.puzzleSuccesses}/{stat.puzzleAttempts} passed · best streak{" "}
        {stat.best_streak}
      </div>
    </li>
  );
}
