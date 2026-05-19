import type { MoveRecord } from "@/lib/chess/game";

export function MoveHistory({ moves }: { moves: MoveRecord[] }) {
  const pairs: Array<{ no: number; white?: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      no: i / 2 + 1,
      white: moves[i]?.san,
      black: moves[i + 1]?.san,
    });
  }

  return (
    <div className="flex max-h-72 flex-col overflow-hidden rounded-md border border-foreground/15">
      <div className="border-b border-foreground/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
        Moves
      </div>
      {pairs.length === 0 ? (
        <div className="px-3 py-3 text-sm text-foreground/50">
          No moves yet.
        </div>
      ) : (
        <ol className="overflow-y-auto font-mono text-sm">
          {pairs.map((p) => (
            <li
              key={p.no}
              className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 border-b border-foreground/5 px-3 py-1.5 last:border-b-0"
            >
              <span className="text-foreground/40">{p.no}.</span>
              <span>{p.white ?? ""}</span>
              <span>{p.black ?? ""}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
