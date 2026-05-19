"use client";

import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

type BoardProps = {
  fen: string;
  orientation: "white" | "black";
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onSquareClick?: (square: string) => void;
  highlightedSquares?: Record<string, React.CSSProperties>;
  disabled?: boolean;
};

export function Board({
  fen,
  orientation,
  onPieceDrop,
  onSquareClick,
  highlightedSquares,
  disabled,
}: BoardProps) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[min(80vh,560px)]">
      <Chessboard
        options={{
          id: "local-game",
          position: fen,
          boardOrientation: orientation,
          onPieceDrop,
          onSquareClick: onSquareClick
            ? ({ square }) => onSquareClick(square)
            : undefined,
          squareStyles: highlightedSquares,
          allowDragging: !disabled,
          showNotation: true,
          animationDurationInMs: 180,
        }}
      />
    </div>
  );
}
