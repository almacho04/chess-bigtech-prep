import Link from "next/link";
import { SiteHeader } from "@/components/site/header";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader />
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center md:py-20">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          An AI chess tutor for{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            real
          </span>{" "}
          improvement.
        </h1>
        <p className="max-w-xl text-base text-foreground/70 md:text-xl">
          Play, solve puzzles, and let your tutor remember weak spots. Training
          adapts around the themes you miss, while the BigTech-prep framing
          keeps calculation sharp and purposeful.
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/40">
          Same audience as LeetCode Premium — sharper at the calculation pieces.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/coach"
            className="rounded-md bg-foreground px-6 py-3 text-center text-base font-medium text-background transition hover:opacity-90"
          >
            Open AI tutor →
          </Link>
          <Link
            href="/training"
            className="rounded-md border border-foreground/20 px-6 py-3 text-center text-base font-medium transition hover:bg-foreground/5"
          >
            Start training
          </Link>
          <Link
            href="/play/ai"
            className="rounded-md border border-foreground/20 px-6 py-3 text-center text-base font-medium transition hover:bg-foreground/5"
          >
            Play vs AI
          </Link>
        </div>
        <div className="mt-8 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          <Feature
            title="Tutor memory"
            body="Signed-in users get tracked strengths, weak spots, XP, and a daily focus theme."
          />
          <Feature
            title="Adaptive training"
            body="Puzzle clusters rotate around missed themes, due reviews, and starter diagnostics."
          />
          <Feature
            title="Game review"
            body="Save games, replay them move-by-move, and run Stockfish-backed coach notes."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-foreground/10 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-foreground/60">{body}</div>
    </div>
  );
}
