import Link from "next/link";
import { SiteHeader } from "@/components/site/header";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader rightContent={<span>404</span>} />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div
          aria-hidden
          className="font-mono text-7xl font-bold text-foreground/15"
        >
          404
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          This square is empty.
        </h1>
        <p className="max-w-md text-sm text-foreground/65 md:text-base">
          The page you&rsquo;re looking for slipped off the board. Try one of
          the routes below.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Back to home
          </Link>
          <Link
            href="/training"
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm transition hover:bg-foreground/5"
          >
            Try training
          </Link>
          <Link
            href="/play/ai"
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm transition hover:bg-foreground/5"
          >
            Play vs AI
          </Link>
        </div>
      </section>
    </main>
  );
}
