import type { Metadata } from "next";
import Link from "next/link";
import { AiGameShell } from "@/components/chess/ai-game-shell";
import { SiteHeader } from "@/components/site/header";

export const metadata: Metadata = {
  title: "Play vs Stockfish",
  description:
    "Play chess against Stockfish in your browser — four difficulty levels from blundering beginner to full strength.",
};

export default function PlayAi() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> vs Stockfish ·{" "}
            <Link href="/play/local" className="underline hover:opacity-80">
              local 2-player
            </Link>
          </span>
        }
      />
      <AiGameShell />
    </main>
  );
}
