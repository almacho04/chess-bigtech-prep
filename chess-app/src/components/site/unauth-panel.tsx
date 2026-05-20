"use client";

import { useCallback, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

/**
 * Inline "sign in to unlock" panel shown on protected pages when the user is
 * signed out — used instead of silently redirecting to /. Keeps the user on
 * the page they wanted and explains what they'll see after signing in.
 *
 * Reuses the same Supabase magic-link flow as the header AuthButton.
 */
export function UnauthPanel({
  title,
  description,
  benefits,
}: {
  title: string;
  description: string;
  benefits: string[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const signIn = useCallback(
    async (e: { preventDefault: () => void }) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
      setStatus({ kind: "sending" });
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              window.location.pathname,
            )}`
          : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setStatus({ kind: "error", message: error.message });
      } else {
        setStatus({ kind: "sent", email: trimmed });
      }
    },
    [email, supabase],
  );

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Sign in to unlock
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-foreground/70 md:text-base">
          {description}
        </p>
        {benefits.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1.5 text-sm text-foreground/70">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-emerald-600">
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 rounded-md border border-foreground/15 bg-background p-4">
          {status.kind === "sent" ? (
            <div className="text-sm">
              <div className="font-medium">Check your inbox</div>
              <div className="mt-1 text-foreground/60">
                We sent a magic link to <strong>{status.email}</strong>. Open
                it on this device and you&rsquo;ll come right back here.
              </div>
            </div>
          ) : (
            <form onSubmit={signIn} className="flex flex-col gap-2">
              <label
                htmlFor="unauth-email"
                className="text-xs text-foreground/60"
              >
                Email — we&rsquo;ll send a one-tap sign-in link.
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="unauth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
                />
                <button
                  type="submit"
                  disabled={status.kind === "sending" || !email.trim()}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition disabled:opacity-50"
                >
                  {status.kind === "sending" ? "Sending…" : "Send magic link"}
                </button>
              </div>
              {status.kind === "error" ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {status.message}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
