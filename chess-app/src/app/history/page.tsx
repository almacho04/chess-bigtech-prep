import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dedupeGames,
  listGames,
  type GameRow,
} from "@/lib/supabase/games";
import { listGameAnalyses } from "@/lib/supabase/game-analysis";
import { SiteHeader } from "@/components/site/header";
import { UnauthPanel } from "@/components/site/unauth-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Game history",
  description: "Every saved game, with replay and AI Coach analysis.",
};

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex flex-1 flex-col">
        <SiteHeader rightContent={<span>Game history</span>} />
        <UnauthPanel
          title="Your saved games live here"
          description="Sign in and every completed game (local or vs AI) auto-saves with PGN, result, and move count — replay any one move-by-move."
          benefits={[
            "Full game replay with keyboard navigation",
            "Click any move on the side panel to jump there",
            "Run AI Coach on each game to surface blunders",
          ]}
        />
      </main>
    );
  }

  const [rawGames, analyses] = await Promise.all([
    listGames(supabase, user.id, 100, { dedupe: false }),
    listGameAnalyses(supabase, user.id, 100),
  ]);
  const analyzedGameIds = new Set(analyses.map((a) => a.game_id));
  const games = dedupeGames(rawGames, analyzedGameIds);
  const hiddenDuplicateCount = Math.max(0, rawGames.length - games.length);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader rightContent={<span>Game history</span>} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <header className="mb-4 flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">Your games</h1>
          <div className="text-sm text-foreground/60">
            {games.length} saved
          </div>
        </header>
        {hiddenDuplicateCount > 0 ? (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Hidden {hiddenDuplicateCount} duplicate saved game
            {hiddenDuplicateCount === 1 ? "" : "s"}. Run migration 0005 to
            clean them from Supabase permanently.
          </div>
        ) : null}
        {games.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="overflow-hidden rounded-md border border-foreground/10">
            {games.map((g) => (
              <li
                key={g.id}
                className="border-b border-foreground/5 last:border-b-0"
              >
                <Link
                  href={`/history/${g.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-foreground/5 md:grid-cols-[1fr_auto_auto_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {labelFor(g)}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-foreground/50">
                      {new Date(g.completed_at).toLocaleString()}
                    </div>
                  </div>
                  {analyzedGameIds.has(g.id) ? (
                    <Badge tone="good">Analyzed</Badge>
                  ) : (
                    <Badge>Needs review</Badge>
                  )}
                  <Badge>{g.mode === "ai" ? "vs AI" : "Local"}</Badge>
                  <Badge>{g.move_count} moves</Badge>
                  <ResultBadge result={g.result} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center text-sm text-foreground/60">
      No games yet. Finish a game in{" "}
      <Link href="/play/ai" className="underline">
        Play vs AI
      </Link>{" "}
      or{" "}
      <Link href="/play/local" className="underline">
        Play locally
      </Link>{" "}
      and it&rsquo;ll appear here.
    </div>
  );
}

function labelFor(g: GameRow): string {
  if (g.mode === "ai") {
    const diff = g.opponent_difficulty ?? "?";
    const side = g.human_color === "b" ? "Black" : "White";
    return `vs Stockfish · ${diff} · you played ${side}`;
  }
  return "Local 2-player";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good";
}) {
  const palette =
    tone === "good"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-foreground/10 text-foreground/60";
  return (
    <span
      className={`hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs md:inline-block ${palette}`}
    >
      {children}
    </span>
  );
}

function ResultBadge({ result }: { result: GameRow["result"] }) {
  const label =
    result === "1-0"
      ? "1–0"
      : result === "0-1"
        ? "0–1"
        : result === "1/2-1/2"
          ? "½–½"
          : "*";
  const palette =
    result === "1-0"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : result === "0-1"
        ? "border-red-500/40 bg-red-500/10"
        : "border-foreground/15 bg-foreground/5";
  return (
    <span
      className={`whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-xs ${palette}`}
    >
      {label}
    </span>
  );
}
