import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/header";
import { TrainingShell } from "@/components/training/training-shell";

export const metadata: Metadata = {
  title: "Training",
  description:
    "Themed tactical puzzles — forks, pins, hanging pieces, mates — with spaced repetition and daily streaks.",
};

export default function TrainingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> training ·{" "}
            <Link href="/coach" className="underline hover:opacity-80">
              tutor
            </Link>{" "}
            ·{" "}
            <Link href="/play/ai" className="underline hover:opacity-80">
              vs AI
            </Link>
          </span>
        }
      />
      <TrainingShell />
    </main>
  );
}
