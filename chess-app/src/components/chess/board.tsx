"use client";

import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

export type BoardArrow = {
  startSquare: string;
  endSquare: string;
  color: string;
};

type BoardProps = {
  id?: string;
  fen: string;
  orientation: "white" | "black";
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onSquareClick?: (square: string) => void;
  highlightedSquares?: Record<string, React.CSSProperties>;
  arrows?: BoardArrow[];
  disabled?: boolean;
};

export function Board({
  id = "chess-board",
  fen,
  orientation,
  onPieceDrop,
  onSquareClick,
  highlightedSquares,
  arrows,
  disabled,
}: BoardProps) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[min(80vh,560px)]">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          onPieceDrop,
          onSquareClick: onSquareClick
            ? ({ square }) => onSquareClick(square)
            : undefined,
          squareStyles: highlightedSquares,
          arrows,
          allowDrawingArrows: false,
          allowDragging: !disabled,
          showNotation: true,
          animationDurationInMs: 180,
        }}
      />
    </div>
  );
}
