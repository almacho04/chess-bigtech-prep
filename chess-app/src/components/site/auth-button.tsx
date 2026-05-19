"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function AuthButton() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Initial fetch + subscribe to auth state changes
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setMounted(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const signIn = useCallback(
    async (e: { preventDefault: () => void }) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
      setStatus({ kind: "sending" });
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setOpen(false);
  }, [supabase]);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="h-7 w-20 animate-pulse rounded-md bg-foreground/5"
      />
    );
  }

  if (user) {
    return (
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex max-w-[8rem] items-center gap-1.5 truncate rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium hover:bg-foreground/5 sm:max-w-[12rem]"
          title={user.email ?? "Signed in"}
        >
          <span className="truncate">{user.email ?? "Account"}</span>
          <span aria-hidden className="text-foreground/40">
            ▾
          </span>
        </button>
        {open ? (
          <div className="absolute right-0 z-40 mt-2 w-44 rounded-md border border-foreground/15 bg-background p-1 shadow-xl">
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-1.5 text-sm hover:bg-foreground/5"
            >
              Game history
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-foreground/5"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setStatus({ kind: "idle" });
        }}
        className="inline-flex items-center rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium hover:bg-foreground/5"
      >
        Sign in
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-md border border-foreground/15 bg-background p-3 shadow-xl">
          {status.kind === "sent" ? (
            <div className="text-sm">
              <div className="font-medium">Check your inbox</div>
              <div className="mt-1 text-foreground/60">
                We sent a magic link to <strong>{status.email}</strong>. Open
                it on this device to finish signing in.
              </div>
            </div>
          ) : (
            <form onSubmit={signIn} className="flex flex-col gap-2">
              <label htmlFor="signin-email" className="text-xs text-foreground/60">
                Email — we&rsquo;ll send a one-tap sign-in link.
              </label>
              <input
                id="signin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-md border border-foreground/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40"
              />
              <button
                type="submit"
                disabled={status.kind === "sending" || !email.trim()}
                className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition disabled:opacity-50"
              >
                {status.kind === "sending" ? "Sending…" : "Send magic link"}
              </button>
              {status.kind === "error" ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {status.message}
                </div>
              ) : null}
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
