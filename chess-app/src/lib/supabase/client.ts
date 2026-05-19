import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to call multiple times — each call
 * returns a new client, but the session is shared via cookies / localStorage.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
