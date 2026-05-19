"use client";

type ControlsProps = {
  onUndo: () => void;
  onRedo: () => void;
  onNewGame: () => void;
  onFlip: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function Controls({
  onUndo,
  onRedo,
  onNewGame,
  onFlip,
  canUndo,
  canRedo,
}: ControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={onUndo} disabled={!canUndo}>
        ← Undo
      </Button>
      <Button onClick={onRedo} disabled={!canRedo}>
        Redo →
      </Button>
      <Button onClick={onFlip}>Flip board</Button>
      <Button onClick={onNewGame} tone="danger">
        New game
      </Button>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const palette =
    tone === "danger"
      ? "border-red-500/40 hover:bg-red-500/10"
      : "border-foreground/15 hover:bg-foreground/5";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${palette}`}
    >
      {children}
    </button>
  );
}
