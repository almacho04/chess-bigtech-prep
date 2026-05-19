"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  type ThemePreference,
} from "@/lib/theme/theme";

const ORDER: readonly ThemePreference[] = ["system", "light", "dark"] as const;

const LABELS: Record<ThemePreference, { short: string; full: string }> = {
  system: { short: "Sys", full: "System" },
  light: { short: "Lt", full: "Light" },
  dark: { short: "Dk", full: "Dark" },
};

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // The boot script already set data-theme; sync our local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(readStoredPreference());
    setMounted(true);
  }, []);

  // Re-apply when system preference changes while on "system".
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (pref === "system") applyTheme(resolveTheme("system"));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref, mounted]);

  const cycle = useCallback(() => {
    setPref((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      writeStoredPreference(next);
      applyTheme(resolveTheme(next));
      return next;
    });
  }, []);

  // Render the same fallback markup on the server and on the initial client
  // paint to avoid a hydration mismatch — the label fills in after mount.
  const label = mounted ? LABELS[pref] : LABELS.system;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label.full}. Click to cycle.`}
      title={`Theme: ${label.full} (click to cycle)`}
      className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium transition hover:bg-foreground/5"
    >
      <ThemeIcon pref={mounted ? pref : "system"} />
      <span className="hidden sm:inline">{label.full}</span>
      <span className="sm:hidden">{label.short}</span>
    </button>
  );
}

function ThemeIcon({ pref }: { pref: ThemePreference }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (pref === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (pref === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 22h8M12 18v4" />
    </svg>
  );
}
