import type { GameStatus } from "@/lib/chess/game";

const drawReasonLabel: Record<
  Exclude<GameStatus, { kind: "ongoing" | "checkmate" | "stalemate" }>["reason"],
  string
> = {
  "fifty-move": "fifty-move rule",
  "threefold-repetition": "threefold repetition",
  "insufficient-material": "insufficient material",
  other: "draw",
};

export function StatusBanner({ status }: { status: GameStatus }) {
  if (status.kind === "checkmate") {
    return (
      <Banner tone="finished">
        <strong className="capitalize">{status.winner}</strong> wins by
        checkmate.
      </Banner>
    );
  }
  if (status.kind === "stalemate") {
    return <Banner tone="finished">Stalemate — game drawn.</Banner>;
  }
  if (status.kind === "draw") {
    return (
      <Banner tone="finished">Draw by {drawReasonLabel[status.reason]}.</Banner>
    );
  }
  return (
    <Banner tone={status.inCheck ? "warning" : "ongoing"}>
      <span className="capitalize">{status.turn}</span> to move
      {status.inCheck ? " — in check" : ""}.
    </Banner>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ongoing" | "warning" | "finished";
  children: React.ReactNode;
}) {
  const palette =
    tone === "finished"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
        : "border-foreground/15 bg-foreground/5";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-md border px-3 py-2 text-sm ${palette}`}
    >
      {children}
    </div>
  );
}
