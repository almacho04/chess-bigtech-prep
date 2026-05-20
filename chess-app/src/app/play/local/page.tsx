import type { Metadata } from "next";
import Link from "next/link";
import { GameShell } from "@/components/chess/game-shell";
import { SiteHeader } from "@/components/site/header";

export const metadata: Metadata = {
  title: "Local 2-player",
  description:
    "Pass-and-play chess for two people on one device, with full rules, undo, and move history.",
};

export default function PlayLocal() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> local 2-player ·{" "}
            <Link href="/play/ai" className="underline hover:opacity-80">
              vs AI
            </Link>
          </span>
        }
      />
      <GameShell />
    </main>
  );
}
