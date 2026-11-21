/*
 * Account (#/account): sign in or create an account, build your crew card, then your account page.
 *
 *   signed out          -> sign-in card (email + password, Google, forgot password, create account)
 *   new account         -> crew card builder (name, job, crew ID, mission, mission end)
 *   set up              -> your card, sync status, your baselines, password / sign-in methods,
 *                          and for commanders and flight surgeons, the crew status board
 *
 * Supabase does the sign-in and keeps the passwords; this page never stores one. What each person
 * can read is enforced by the database (supabase/schema.sql), not by this page.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Shell } from "@/live/LivePage";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SignIn1, type SignInMode } from "@/components/ui/modern-stunning-sign-in";
import { CrewCardForm, type CrewCardState } from "@/components/ui/credit-card-form";
import { HoloCard, type HoloCardHandle } from "@/components/ui/holo-card";
import { Glyph, GlyphTile } from "@/components/ui/glyph";
import { appUrl, supabase } from "@/lib/supabase";
import { friendlyError, takeAuthError, useAuth, type Baselines, type Profile } from "@/lib/auth";
import { crewIdFor, randomCrewId, describe, getMyReadings, type MyReadings } from "@/lib/crewDb";
import { syncLabel, syncNow, useSyncState, withTimeout } from "@/lib/sync";
import { ShinyButton } from "@/components/ui/shiny-button";

const field =
  "h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm text-white placeholder:text-white/35 focus:border-sky-300/70 focus:outline-none";
const card = "rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6";

/* ------------------------------------------------------------------ */
/*  Signed out: sign in, create account, forgot password               */
/* ------------------------------------------------------------------ */

/** Asks Supabase whether Google sign-in is switched on (public settings, no sign-in needed). */
async function googleEnabled(): Promise<boolean> {
  try {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      signal: AbortSignal.timeout(5000),
    });
    const j = (await r.json()) as { external?: { google?: boolean } };
    return !!j.external?.google;
  } catch {
    return true; // can't tell (offline?): let Supabase answer
  }
}

function SignedOut() {
  const [mode, setMode] = useState<SignInMode>("signin");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [crewId] = useState(randomCrewId); // shown on the card now, and saved with the new account
  const card = useRef<HoloCardHandle>(null);
  useEffect(() => {
    card.current?.reveal(true); // show the whole number, 2026 first
  }, []);
  useEffect(() => {
    setNotice("");
  }, [mode]);
  // coming back from Google (or an email link) with an error, e.g. after pressing Cancel: say so
  useEffect(() => {
    const e = takeAuthError();
    if (e) setNotice(friendlyError(e));
  }, []);
  // the Google button only shows once Google sign-in is switched on in Supabase
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    googleEnabled().then(setGoogle);
  }, []);
  const sb = supabase!;

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <SignIn1
      mode={mode}
      onModeChange={setMode}
      onNameChange={setName}
      notice={notice}
      onSignIn={async (email, password) => {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return error ? friendlyError(error.message) : null;
      }}
      onSignUp={async (name, email, password) => {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, crew_id: crewId }, emailRedirectTo: appUrl("?welcome=1") },
        });
        if (error) return friendlyError(error.message);
        // Supabase answers a sign-up for an existing email with a user that has no identities
        if (data.user && (data.user.identities?.length ?? 0) === 0) return friendlyError("already registered");
        if (!data.session) setNotice(`Almost there: we've sent a confirmation link to ${email}. Open it to finish creating your account.`);
        return null;
      }}
      onForgot={async (email) => {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl("?reset=1") });
        if (error) return friendlyError(error.message);
        setNotice(`If ${email} has a VITALS account, a reset link is on its way. It opens in this browser.`);
        return null;
      }}
      onGoogle={
        google
          ? async () => {
              // offline the redirect would land on a browser error page
              if (!navigator.onLine) return "Google sign-in needs the internet. Use email and password, or try again when you're online.";
              // select_account: on a shared computer everyone picks their own Google account
              const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl("?oauth=1"), queryParams: { prompt: "select_account" } } });
              return error ? friendlyError(error.message) : null;
            }
          : undefined
      }
    />
      <div className="mx-auto w-full max-w-[400px]">
        <HoloCard
          ref={card}
          name={mode === "signup" && name.trim() ? name.trim() : "Your name"}
          role="Student"
          crewId={crewId}
          mission="8B"
          statusNote={mode === "signup" ? "Your card builds itself as you type." : "Sign in to see your own card."}
          className="w-full"
        />
        <p className="mt-3 text-center text-xs text-white/50">{mode === "signup" ? `Your student number: ${crewId}` : "Every account gets its own student number."}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New account: build your crew card                                  */
/* ------------------------------------------------------------------ */

function BuildCard({ profile, onDone }: { profile: Profile; onDone?: () => void }) {
  const { saveProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [end] = useState(() => (profile.mission_end ? profile.mission_end.split("-") : []));

  const save = async (s: CrewCardState) => {
    setBusy(true);
    setError("");
    const err = await saveProfile({
      display_name: s.name,
      job: s.job,
      mission: s.mission,
      mission_end: `${s.year}-${s.month}-01`,
      onboarded: true,
    });
    setBusy(false);
    if (err) setError(friendlyError(err));
    else onDone?.();
  };

  return (
    <div>
      <p className="mb-8 max-w-[60ch] text-white/70">
        Your student card goes on your account and on the student view. It builds itself as you type. Nothing here is a payment card.
      </p>
      <CrewCardForm
        lockCrewId={!!profile.crew_id}
        defaults={{
          name: profile.display_name,
          job: profile.job,
          crewId: (profile.crew_id || crewIdFor(profile.display_name || profile.id)).replace(/\D/g, ""),
          mission: profile.mission || "8B",
          year: end[0],
          month: end[1],
        }}
        busy={busy}
        error={error}
        submitLabel={profile.onboarded ? "Save changes" : "Create my student card"}
        onSubmit={save}
      />
      {onDone && profile.onboarded && (
        <div className="mt-6 text-center">
          <LiquidButton size="sm" type="button" onClick={onDone} className="h-9 px-4 text-sm text-white/75">
            Cancel
          </LiquidButton>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Set up: your account                                               */
/* ------------------------------------------------------------------ */

function BaselinesForm({ profile }: { profile: Profile }) {
  const { saveProfile } = useAuth();
  const [b, setB] = useState<Record<keyof Baselines, string>>({
    hr: String(profile.baselines.hr ?? ""),
    sleep: String(profile.baselines.sleep ?? ""),
    spo2: String(profile.baselines.spo2 ?? ""),
  });
  const [msg, setMsg] = useState("");
  const rows: [keyof Baselines, string, string, number, number][] = [
    ["hr", "Resting heart rate", "bpm", 30, 130],
    ["spo2", "Usual SpO2", "%", 80, 100],
    ["sleep", "Usual sleep", "hours", 3, 12],
  ];
  const save = async () => {
    const out: Baselines = {};
    for (const [k, label, , lo, hi] of rows) {
      if (!b[k].trim()) continue;
      const n = Number(b[k].replace(",", "."));
      if (!Number.isFinite(n) || n < lo || n > hi) return setMsg(`${label} should be between ${lo} and ${hi}.`);
      out[k] = n;
    }
    const err = await saveProfile({ baselines: out });
    setMsg(err ? friendlyError(err) : "Saved. VITALS now compares you with your own normal.");
  };
  return (
    <div className={card}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="heartPulse" size="sm" /> Your normal
      </h2>
      <p className="mt-2 text-sm text-white/60">Only you can see these. They let VITALS spot changes against your own baseline, not a textbook average.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map(([k, label, unit]) => (
          <label key={k} className="block text-sm text-white/70">
            {label} <span className="text-white/40">({unit})</span>
            <input inputMode="decimal" value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} className={`${field} mt-1.5`} />
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <LiquidButton size="sm" type="button" onClick={save} className="h-9 bg-sky-400/20 px-5 text-sm font-semibold text-white">
          Save my normal
        </LiquidButton>
        {msg && (
          <p role="status" className="text-sm text-white/70">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

function SignInMethods() {
  const { user } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const providers = useMemo(() => new Set((user?.identities ?? []).map((i) => i.provider)), [user]);
  const hasPassword = providers.has("email");
  const save = async () => {
    if (pw.length < 8) return setMsg("Use at least 8 characters.");
    if (pw !== pw2) return setMsg("The two passwords don't match.");
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setMsg(error ? friendlyError(error.message) : hasPassword ? "Password changed." : "Password set. You can now sign in with your email and password too.");
    if (!error) {
      setPw("");
      setPw2("");
    }
  };
  return (
    <div className={card}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="lockDoor" size="sm" /> Sign-in methods
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5">
          Email and password <span className={hasPassword ? "text-emerald-300" : "text-white/40"}>{hasPassword ? "On" : "Not set up"}</span>
        </li>
        <li className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5">
          Google <span className={providers.has("google") ? "text-emerald-300" : "text-white/40"}>{providers.has("google") ? "On" : "Not linked"}</span>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-white/45">
        Signing in with Google using the same email as this account keeps it one account, with the same data.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-white/70">
          {hasPassword ? "New password" : "Set a password"}
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${field} mt-1.5`} />
        </label>
        <label className="block text-sm text-white/70">
          Confirm it
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${field} mt-1.5`} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LiquidButton size="sm" type="button" onClick={save} className="h-9 bg-sky-400/20 px-5 text-sm font-semibold text-white">
          {hasPassword ? "Change password" : "Set password"}
        </LiquidButton>
        {msg && (
          <p role="status" className="text-sm text-white/70">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

type StatusRow = { user_id: string; display_name: string; job: string; crew_id: string; status: "green" | "yellow" | "red"; heart: number | null; spo2: number | null; room_temp: number | null; humidity: number | null; updated_at: string };
const DOT = { green: "bg-emerald-400", yellow: "bg-amber-400", red: "bg-rose-500" };
const BOARD_KEY = "vitals2-crew-board";

/** Commanders and flight surgeons: everyone's status. The database decides who may read it. */
function CrewBoard() {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const load = async () => {
    const res = navigator.onLine ? await withTimeout(supabase!.from("crew_status").select("*").order("display_name")) : "timeout";
    const { data, error } = res === "timeout" ? { data: null, error: { message: "No connection." } } : res;
    if (!error) {
      setRows(data as StatusRow[]);
      setErr("");
      setNote("");
      try {
        localStorage.setItem(BOARD_KEY, JSON.stringify({ at: Date.now(), rows: data }));
      } catch {
        /* just not kept for offline */
      }
      return;
    }
    // no connection: the last board this device loaded
    let saved: { at: number; rows: StatusRow[] } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(BOARD_KEY) ?? "null");
    } catch {
      /* nothing kept */
    }
    if (saved && (!navigator.onLine || !("code" in error) || !error.code)) {
      setRows(saved.rows);
      setNote(`No connection: showing the student status from ${new Date(saved.at).toLocaleString()}.`);
    } else setErr(navigator.onLine ? friendlyError(error.message) : "No connection, and the student status hasn't been loaded on this device yet.");
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <GlyphTile name="people" size="sm" tone="violet" /> Student status
        </h2>
        <LiquidButton size="icon" type="button" aria-label="Refresh student status" onClick={load} className="h-9 w-9 text-white">
          <RefreshCw className="h-4 w-4" />
        </LiquidButton>
      </div>
      <p className="mt-2 text-sm text-white/60">What each student shares with commanders: status, key vitals and their room's temperature and humidity. Their full history stays private.</p>
      {err && <p className="mt-4 text-sm text-rose-300">{err}</p>}
      {note && <p className="mt-4 text-sm text-amber-200/80">{note}</p>}
      {rows && !rows.length && <p className="mt-4 text-sm text-white/50">No student data synced yet.</p>}
      <ul className="mt-4 divide-y divide-white/10">
        {rows?.map((r) => (
          <li key={r.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[r.status]}`} aria-label={r.status} />
            <span className="min-w-[8rem] font-semibold">{r.display_name || "Unnamed"}</span>
            <span className="text-white/50">{r.job}</span>
            <span className="ml-auto font-mono text-white/75">
              {r.heart ?? "—"} bpm · {r.spo2 ?? "—"}% · room {r.room_temp ?? "—"}°C · {r.humidity ?? "—"}% RH
            </span>
            <span className="w-full text-xs text-white/40 sm:w-auto">synced {new Date(r.updated_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountHome({ profile }: { profile: Profile }) {
  const { user, signOut } = useAuth();
  const sync = useSyncState();
  const [editing, setEditing] = useState(false);
  const [mine, setMine] = useState<MyReadings | null>(null);
  useEffect(() => {
    getMyReadings()
      .then((m) => setMine(m ?? null))
      .catch(() => setMine(null));
  }, []);

  if (editing) return <BuildCard profile={profile} onDone={() => setEditing(false)} />;

  const d = mine ? describe({ id: "self", name: profile.display_name, role: profile.job, crewId: profile.crew_id, readings: mine.readings, kind: "self", source: mine.source, updatedAt: mine.at }) : null;
  const commander = profile.role === "commander" || profile.role === "flight_surgeon";
  const roleLabel = { crew: "Student", commander: "Commander", flight_surgeon: "Flight surgeon" }[profile.role];

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="flex flex-col items-center gap-4">
          <HoloCard
            name={profile.display_name}
            role={profile.job || roleLabel}
            crewId={profile.crew_id}
            mission={profile.mission}
            status={d?.status ?? "green"}
            statusNote={d ? d.statusNote : "No readings yet. Pair a sensor on the Live monitor."}
            baselines={d?.baselines ?? []}
            backTitle="Your latest readings"
            className="w-full"
          />
          <LiquidButton size="sm" type="button" onClick={() => setEditing(true)} className="h-9 px-4 text-sm text-white/80">
            Edit my student card
          </LiquidButton>
        </div>
        <div className={card}>
          <p className="text-sm text-white/55">Signed in as</p>
          <p className="mt-1 text-xl font-semibold">{profile.display_name}</p>
          <p className="text-sm text-white/60">
            {user?.email} · {roleLabel}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${sync.mode === "online" ? "bg-emerald-400" : sync.mode === "syncing" ? "animate-pulse bg-sky-300" : "bg-amber-400"}`} />
            <span className="flex-1">{syncLabel(sync)}</span>
            <LiquidButton size="sm" type="button" onClick={() => void syncNow()} className="h-8 px-3 text-xs text-white/80">
              Sync now
            </LiquidButton>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            Readings are saved on this device first and sent when there's a connection, so VITALS keeps working far from Earth. Your history is private;
            commanders see only your status and three key vitals.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ShinyButton onClick={() => (window.location.hash = "#/live")} className="h-10 px-5 text-sm">
              <Glyph name="heartPulse" className="h-4 w-4" /> Open the Live monitor
            </ShinyButton>
            <ShinyButton tone="violet" onClick={() => (window.location.hash = "#/crew-link")} className="h-10 px-5 text-sm">
              <Glyph name="people" className="h-4 w-4" /> Open Student Link
            </ShinyButton>
            <LiquidButton size="sm" type="button" onClick={() => void signOut()} className="h-9 px-4 text-sm text-white/75">
              Sign out
            </LiquidButton>
          </div>
        </div>
      </div>
      {commander && <CrewBoard />}
      <div className="grid gap-6 lg:grid-cols-2">
        <BaselinesForm profile={profile} />
        <SignInMethods />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export default function AccountPage() {
  const { enabled, loading, session, profile, refreshProfile } = useAuth();
  const [tries, setTries] = useState(0);

  // a brand-new account's profile is made by a database trigger a moment after sign-up
  useEffect(() => {
    if (session && !profile && tries < 4) {
      const t = setTimeout(() => {
        void refreshProfile();
        setTries((n) => n + 1);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [session, profile, tries, refreshProfile]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const title = !session ? "Your VITALS account." : profile && !profile.onboarded ? "Build your student card." : "Your account.";
  const intro = !session
    ? "Sign in to use VITALS. Your readings, your baselines and your student card are saved to your account and follow you to any device."
    : undefined;

  return (
    <Shell eyebrow="Account" title={title} intro={intro} back={{ label: "Back to VITALS" }}>
      {!enabled ? (
        <p className="text-white/70">Accounts aren't set up on this copy of the site, so VITALS runs in guest mode: everything stays on this device.</p>
      ) : loading ? (
        <p className="text-white/60">Checking your sign-in…</p>
      ) : !session ? (
        <SignedOut />
      ) : !profile ? (
        tries < 4 ? (
          <p className="text-white/60">Setting up your account…</p>
        ) : (
          <p className="text-white/70">
            You're signed in, but your account record couldn't be loaded. The VITALS database may not be set up yet (supabase/schema.sql).
          </p>
        )
      ) : !profile.onboarded ? (
        <BuildCard profile={profile} />
      ) : (
        <AccountHome profile={profile} />
      )}
    </Shell>
  );
}
