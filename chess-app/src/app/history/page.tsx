import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGames, type GameRow } from "@/lib/supabase/games";
import { SiteHeader } from "@/components/site/header";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/?auth_required=history");
  }

  const games = await listGames(supabase, user.id);

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
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-foreground/5 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {labelFor(g)}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-foreground/50">
                      {new Date(g.completed_at).toLocaleString()}
                    </div>
                  </div>
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden whitespace-nowrap rounded-md border border-foreground/10 px-2 py-0.5 text-xs text-foreground/60 md:inline-block">
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
