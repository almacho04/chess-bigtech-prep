"use client";

import { useEffect } from "react";

export type PromotionPiece = "q" | "r" | "b" | "n";

const PIECES: readonly { piece: PromotionPiece; label: string }[] = [
  { piece: "q", label: "Queen" },
  { piece: "r", label: "Rook" },
  { piece: "b", label: "Bishop" },
  { piece: "n", label: "Knight" },
];

const PIECE_CHARS: Record<"w" | "b", Record<PromotionPiece, string>> = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

export function PromotionPicker({
  open,
  color,
  onPick,
  onCancel,
}: {
  open: boolean;
  color: "w" | "b";
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      const map: Record<string, PromotionPiece> = {
        q: "q",
        r: "r",
        b: "b",
        n: "n",
      };
      const k = e.key.toLowerCase();
      if (map[k]) onPick(map[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onPick]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Promote pawn"
      onClick={onCancel}
    >
      <div
        className="rounded-lg border border-foreground/15 bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-center text-sm font-semibold text-foreground/70">
          Promote pawn to
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {PIECES.map(({ piece, label }) => (
            <button
              key={piece}
              type="button"
              onClick={() => onPick(piece)}
              aria-label={label}
              title={`${label} (${piece.toUpperCase()})`}
              className="flex aspect-square w-16 flex-col items-center justify-center rounded-md border border-foreground/15 transition hover:border-foreground/30 hover:bg-foreground/5"
            >
              <div className="text-3xl leading-none">
                {PIECE_CHARS[color][piece]}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-foreground/50">
                {label}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-md border border-foreground/10 px-3 py-1.5 text-xs text-foreground/60 hover:bg-foreground/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
