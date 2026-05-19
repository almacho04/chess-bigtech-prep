import Link from "next/link";
import { SiteHeader } from "@/components/site/header";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader />
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center md:py-20">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Chess for{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            BigTech
          </span>{" "}
          interview prep.
        </h1>
        <p className="max-w-xl text-base text-foreground/70 md:text-xl">
          Sharpen pattern recognition and calculation under pressure — the same
          skills that show up in algorithmic interviews. Play, train, and get
          coached.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/play/ai"
            className="rounded-md bg-foreground px-6 py-3 text-center text-base font-medium text-background transition hover:opacity-90"
          >
            Play vs AI
          </Link>
          <Link
            href="/play/local"
            className="rounded-md border border-foreground/20 px-6 py-3 text-center text-base font-medium transition hover:bg-foreground/5"
          >
            Play locally
          </Link>
        </div>
        <div className="mt-8 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          <Feature
            title="Full rules"
            body="Castling, en passant, mate / stalemate / draw — powered by chess.js."
          />
          <Feature
            title="Stockfish AI"
            body="Four difficulties from blundering beginner to full strength."
          />
          <Feature
            title="Resume anytime"
            body="Your game persists in the browser — close and come back."
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
