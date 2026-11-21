/*
 * Supabase connection for VITALS accounts.
 *
 * The URL and publishable key come from .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).
 * Both are meant to be public: the database's Row Level Security decides what each signed-in
 * person can read or write (supabase/schema.sql). Without them, `supabase` is null and the site
 * runs in guest mode, keeping data on the device only.
 *
 * Sign-in uses the PKCE flow, so links coming back from Google, the sign-up email and the
 * password-reset email carry a ?code= in the query string, not tokens in the #hash, which the
 * site uses for its own pages.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "vitals-auth" },
      })
    : null;

/** Where Supabase sends people back to: this page, without the #route or old query. */
export function appUrl(params = ""): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${params}`;
}
