import Link from "next/link";
import { SiteHeader } from "@/components/site/header";
import { TrainingShell } from "@/components/training/training-shell";

export default function TrainingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> training ·{" "}
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
