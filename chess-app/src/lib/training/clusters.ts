/**
 * Themed clusters for the training mode. Each cluster is a curated tactical
 * category; the BigTech-interview-prep framing maps the chess pattern onto a
 * familiar coding pattern so the audience immediately gets the parallel.
 */

export type ClusterId =
  | "mateIn1"
  | "mateIn2"
  | "fork"
  | "pin"
  | "hangingPiece";

export type Cluster = {
  id: ClusterId;
  label: string;
  description: string;
  prepAnalogy: string;
  icon: string;
};

export const CLUSTERS: readonly Cluster[] = [
  {
    id: "mateIn1",
    label: "Mate in 1",
    description: "Find the move that mates immediately.",
    prepAnalogy:
      "Single-step calculation. Like spotting the base case of a recursion before writing the recursion.",
    icon: "♛",
  },
  {
    id: "mateIn2",
    label: "Mate in 2",
    description: "Two-move forced sequence ending in mate.",
    prepAnalogy:
      "Two-move lookahead. Like reading a recursive call before it returns — what does the opponent do? Now mate.",
    icon: "⚔",
  },
  {
    id: "fork",
    label: "Forks",
    description: "One move that attacks two pieces at once.",
    prepAnalogy:
      "One move, two side effects. Like a clever bit trick that updates state in one shot.",
    icon: "⑂",
  },
  {
    id: "pin",
    label: "Pins",
    description: "Tie down a piece by attacking the one behind it.",
    prepAnalogy:
      "Constraint propagation. Fix one variable so the opponent can't move the other without losing more.",
    icon: "📍",
  },
  {
    id: "hangingPiece",
    label: "Hanging pieces",
    description: "Capture material the opponent left undefended.",
    prepAnalogy:
      "Free material on the board — like an unused variable still allocated. Notice and take it.",
    icon: "✦",
  },
] as const;

export function getCluster(id: ClusterId): Cluster {
  return CLUSTERS.find((c) => c.id === id) ?? CLUSTERS[0];
}
