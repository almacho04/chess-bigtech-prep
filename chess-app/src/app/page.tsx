import { GameShell } from "@/components/chess/game-shell";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10 px-4 py-3 md:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            chess<span className="text-foreground/40">·prep</span>
          </h1>
          <p className="hidden text-xs text-foreground/60 sm:block">
            Chess for BigTech interview prep
          </p>
        </div>
      </header>
      <GameShell />
    </main>
  );
}
