import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGame } from "@/lib/supabase/games";
import { ReplayViewer } from "@/components/chess/replay-viewer";
import { SiteHeader } from "@/components/site/header";

export const dynamic = "force-dynamic";

export default async function GameReplayPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?auth_required=history`);
  }

  const game = await getGame(supabase, gameId);
  if (!game) {
    // RLS will mask other users' games as "not found", which is the right UX.
    notFound();
  }

  const resultLabel =
    game.result === "1-0"
      ? "White won"
      : game.result === "0-1"
        ? "Black won"
        : game.result === "1/2-1/2"
          ? "Draw"
          : "Unfinished";

  const orientation = game.human_color === "b" ? "black" : "white";

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader rightContent={<span>Replay</span>} />
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <Link
          href="/history"
          className="mb-3 inline-block text-xs text-foreground/60 hover:text-foreground"
        >
          ← Back to history
        </Link>
        <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">
            {game.mode === "ai"
              ? `vs Stockfish · ${game.opponent_difficulty}`
              : "Local 2-player"}
          </h1>
          <div className="text-sm text-foreground/60">
            {resultLabel} · {game.move_count} moves ·{" "}
            {new Date(game.completed_at).toLocaleString()}
          </div>
        </header>
        <ReplayViewer pgn={game.pgn} orientation={orientation} />
      </section>
    </main>
  );
}
