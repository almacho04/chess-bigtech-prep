import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({
  rightContent,
}: {
  rightContent?: React.ReactNode;
}) {
  return (
    <header className="border-b border-foreground/10 px-4 py-3 md:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight hover:opacity-80 md:text-xl"
        >
          chess<span className="text-foreground/40">·prep</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-xs text-foreground/60 sm:text-sm">
            {rightContent ?? (
              <span className="hidden sm:inline">
                Chess for BigTech interview prep
              </span>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
