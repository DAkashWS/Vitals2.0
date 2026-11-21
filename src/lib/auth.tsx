/*
 * Who's signed in, and their profile. Wrap the app in <AuthProvider>; read it with useAuth().
 *
 * Coming back from an email link or Google, the URL carries markers this file sets itself:
 *   ?reset=1     the password-reset email      -> opens #/reset-password
 *   ?welcome=1   the sign-up confirmation email -> opens #/account
 *   ?oauth=1     back from Google              -> opens #/account
 * Supabase exchanges the ?code= for a session (PKCE); this file then tidies the URL.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAuthRetryableFetchError, type Session, type User } from "@supabase/supabase-js";
import { appUrl, supabase } from "@/lib/supabase";
import { addPendingProfile, pendingProfile, setSyncUser, startSync, withTimeout } from "@/lib/sync";

export type Role = "crew" | "commander" | "flight_surgeon";
export type Baselines = { hr?: number; sleep?: number; spo2?: number };
export type Profile = {
  id: string;
  display_name: string;
  role: Role;
  job: string;
  crew_id: string;
  mission: string;
  mission_end: string | null;
  baselines: Baselines;
  onboarded: boolean;
};

type Auth = {
  /** false when the site was built without Supabase settings (guest mode only) */
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** true while a password-reset link is being used (only then may the password be changed without the old one) */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (p: Partial<Omit<Profile, "id" | "role">>) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);
const RECOVERY_KEY = "vitals2-recovery";

/**
 * The sign-in saved on this device. Offline, Supabase can't renew an expired login and reports no session,
 * though it keeps the saved one; using it keeps a signed-in crew member in the app. It's renewed once the
 * network is back, and a login the server then rejects signs out as usual.
 */
function savedSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem("vitals2-auth") ?? "null") as Session | null;
  } catch {
    return null;
  }
}

const AUTH_ERROR_KEY = "vitals2-auth-error";

/** The error a sign-in link came back with (once), or "". */
export function takeAuthError(): string {
  try {
    const e = sessionStorage.getItem(AUTH_ERROR_KEY) ?? "";
    sessionStorage.removeItem(AUTH_ERROR_KEY);
    return e;
  } catch {
    return "";
  }
}

/** Reads our own markers from the URL once, before Supabase tidies it. */
function readMarkers() {
  const q = new URLSearchParams(window.location.search);
  const marker = q.has("reset") ? "reset" : q.has("welcome") ? "welcome" : q.has("oauth") ? "oauth" : null;
  const error = q.get("error_description");
  if (error) {
    // e.g. Cancel on Google's page: the sign-in card shows it (see takeAuthError)
    try {
      sessionStorage.setItem(AUTH_ERROR_KEY, error);
    } catch {
      /* private mode: no message, the sign-in page just opens */
    }
  }
  if (marker === "reset") {
    try {
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    } catch {
      /* private mode: the reset page then asks for a new link */
    }
  }
  return { marker, error };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [recovering, setRecovering] = useState(() => {
    try {
      const t = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
      return Date.now() - t < 60 * 60 * 1000;
    } catch {
      return false;
    }
  });
  const [markers] = useState(readMarkers);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!supabase || !uid) return setProfile(null);
    let { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    // VITALS 2.0 has its own Supabase project: the first sign-in creates the student profile (and student ID).
    if (!error && !data) ({ data, error } = await supabase.rpc("ensure_profile").maybeSingle());
    // edits made offline and not yet sent stay on top of what the account has
    const pending = pendingProfile(uid);
    const withPending = (p: Profile | null) => (p && pending ? ({ ...p, ...pending } as Profile) : p);
    // no network: keep the profile from the last visit, so the sign-in gate doesn't lock out someone already signed in
    try {
      if (error) return setProfile(withPending(JSON.parse(localStorage.getItem("vitals2-profile") ?? "null")));
      localStorage.setItem("vitals2-profile", JSON.stringify(withPending((data as Profile | null) ?? null)));
    } catch {
      /* storage blocked: offline visits start at the sign-in page */
    }
    setProfile(withPending((data as Profile | null) ?? null));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    // Offline, Supabase spends about 30 s retrying the renewal before answering. Meanwhile let a crew member
    // already signed in on this device straight in with the saved sign-in and profile (after 3 s if the
    // browser thinks it's online, at once if it knows it isn't); the answer below then confirms or signs out.
    const early = setTimeout(
      () => {
        const s = savedSession();
        let p: Profile | null = null;
        try {
          p = JSON.parse(localStorage.getItem("vitals2-profile") ?? "null") as Profile | null;
        } catch {
          /* no saved profile */
        }
        if (!alive || !s || p?.id !== s.user?.id) return;
        setSession(s);
        setProfile(p);
        setLoading(false);
      },
      navigator.onLine ? 3000 : 0,
    );
    supabase.auth.getSession().then(async ({ data, error }) => {
      clearTimeout(early);
      if (!alive) return;
      const s = data.session ?? (error && (!navigator.onLine || isAuthRetryableFetchError(error)) ? savedSession() : null);
      setSession(s);
      await loadProfile(s?.user.id);
      setLoading(false);
      // tidy the URL and open the right page for where the person came from
      if (markers.marker || markers.error) {
        const route = markers.error ? "#/account" : markers.marker === "reset" ? "#/reset-password" : "#/account";
        window.history.replaceState(null, "", appUrl() + route);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        if (markers.marker === "reset") setRecovering(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // the first session is set above: an offline start must not replace the saved sign-in with none
      if (event === "INITIAL_SESSION") return;
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        localStorage.removeItem("vitals2-profile");
        localStorage.removeItem("vitals2-crew-board"); // other crew's vitals, cached for a commander
        localStorage.removeItem("vitals2-crew-link"); // your crew's board and log, cached for offline
        setRecovering(false);
      }
      // load the profile outside the auth callback (Supabase advises against awaiting inside it)
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => {
      alive = false;
      clearTimeout(early);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, markers]);

  // tell the sync engine whose readings to upload
  useEffect(() => {
    startSync();
    setSyncUser(session?.user.id ?? null, profile);
  }, [session?.user.id, profile]);

  const value = useMemo<Auth>(
    () => ({
      enabled: !!supabase,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      recovering,
      refreshProfile: () => loadProfile(session?.user.id),
      saveProfile: async (p) => {
        if (!supabase || !session) return "You're not signed in.";
        const uid = session.user.id;
        // keep the edit on this device and show it now; it reaches the account when the link is back
        const keep = () => {
          if (!addPendingProfile(uid, p)) return "Couldn't save on this device.";
          const next = profile ? ({ ...profile, ...p } as Profile) : null;
          setProfile(next);
          try {
            localStorage.setItem("vitals2-profile", JSON.stringify(next));
          } catch {
            /* shown now, kept in the waiting edits */
          }
          return null;
        };
        // offline, or older offline edits still waiting (they must arrive first, in order)
        if (!navigator.onLine || pendingProfile(uid)) return keep();
        const res = await withTimeout(supabase.from("profiles").update(p).eq("id", uid));
        if (res === "timeout") return keep();
        // no error code: the request never reached the server (no connection)
        if (res.error) return res.error.code ? res.error.message : keep();
        await loadProfile(uid);
        return null;
      },
      signOut: async () => {
        // Supabase only clears the saved login after its server call works, and returns an error if it
        // can't (slow link, a refresh holding its lock): the button then did nothing. Revoke this
        // device's login on the server if we can, but always sign out here.
        // "local" ends only this device's session, not the person's other devices.
        await withTimeout(supabase!.auth.signOut({ scope: "local" }), 4000).catch(() => undefined);
        try {
          for (const k of ["vitals2-auth", "vitals2-auth-code-verifier", "vitals2-profile", "vitals2-crew-board"]) localStorage.removeItem(k);
          sessionStorage.removeItem(RECOVERY_KEY);
        } catch {
          /* nothing to clear */
        }
        setSession(null);
        setProfile(null);
        setRecovering(false);
      },
    }),
    [loading, session, profile, recovering, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth needs <AuthProvider>");
  return v;
}

export function endRecovery() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Plain-language versions of Supabase's auth errors. */
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them, or use Forgot password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first: open the link we sent you.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There's already an account with this email. Sign in instead, or use Forgot password.";
  if (m.includes("password should be") || m.includes("weak")) return "Please choose a stronger password: at least 8 characters, mixing letters and numbers.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a minute and try again.";
  if (m.includes("same password") || m.includes("different from the old")) return "Your new password must be different from your old one.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "Google sign-in isn't switched on yet. Use email and password for now.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the VITALS server right now. Check your connection; your data stays saved on this device.";
  return message;
}
