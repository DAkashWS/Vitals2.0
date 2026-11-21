/*
 * Crew Link (#/crew-link): link your crew card with your mission crew.
 *
 *   not in a crew   -> invitations to accept, or Create crew (name it, pick crew cards to invite)
 *                      or Join crew (its 10-digit code)
 *   in a crew       -> readiness, alerts, the live crew board, buddy pairs, check-ins and the crew log
 *   guest / preview -> the same board with a simulated demo crew made from the team's cards
 *
 * The data side, the rules and the demo crew are in src/lib/crewLink.ts; who may read what is enforced
 * by the database (supabase/schema.sql, "Crew Link").
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ShinyButton } from "@/components/ui/shiny-button";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronUp, Copy, LogOut, RefreshCw } from "lucide-react";
import { Shell } from "@/live/LivePage";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { useAuth } from "@/lib/auth";
import { HoloCard } from "@/components/ui/holo-card";
import { describe, levelOf, type CrewReadings } from "@/lib/crewDb";
import {
  ageOf,
  ago,
  alertsOf,
  buddiesOf,
  cabinOf,
  cachedBoard,
  acceptInvite,
  createCrew,
  declineInvite,
  demoBoard,
  flushLog,
  formatCrewCode,
  inviteToCrew,
  joinCrew,
  leaveCrew,
  loadBoard,
  loadInvites,
  LIVE_MS,
  pendingLog,
  postLog,
  readinessOf,
  searchCards,
  STALE_MS,
  subscribeBoard,
  type Board,
  type CardPick,
  type Invite,
  type LoadError,
  type LogKind,
  type Member,
} from "@/lib/crewLink";

const card = "rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6";
const field =
  "h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm text-white placeholder:text-white/35 focus:border-sky-300/70 focus:outline-none";

const STATUS = {
  green: { label: "Normal", dot: "bg-ok", text: "text-ok", ring: "ring-emerald-300/25" },
  yellow: { label: "Watch", dot: "bg-watch", text: "text-watch", ring: "ring-amber-300/35" },
  red: { label: "Act", dot: "bg-act", text: "text-act", ring: "ring-rose-400/45" },
  none: { label: "No data", dot: "bg-white/30", text: "text-white/50", ring: "ring-white/10" },
} as const;

const KIND: Record<LogKind, { label: string; glyph: GlyphName; tone: string }> = {
  ok: { label: "Checked in: all good", glyph: "check", tone: "text-ok" },
  watch: { label: "Checked in: feeling off", glyph: "warning", tone: "text-watch" },
  help: { label: "Needs help", glyph: "medKit", tone: "text-act" },
  buddy: { label: "Buddy check", glyph: "people", tone: "text-sky-300" },
  note: { label: "Note", glyph: "notepad", tone: "text-white/60" },
};


/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export default function CrewLinkPage() {
  const { enabled, session, profile } = useAuth();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [error, setError] = useState<LoadError | null>(null);
  const [offlineAt, setOfflineAt] = useState<number | null>(null);
  const [demo, setDemo] = useState(!enabled);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const uid = session?.user.id ?? "";

  const load = useCallback(async () => {
    if (demo) return;
    // known to be offline: the saved board straight away, instead of waiting for the server to time out
    const saved = cachedBoard();
    if (!navigator.onLine && saved) {
      setBoard(saved.board);
      setOfflineAt(saved.at);
      setError(null);
      return;
    }
    try {
      await flushLog(uid);
      const b = await loadBoard();
      setBoard(b);
      setError(null);
      setOfflineAt(null);
    } catch (e) {
      const err = e as LoadError;
      // no connection: the last board this device loaded
      if (err.kind === "offline" && saved) {
        setBoard(saved.board);
        setOfflineAt(saved.at);
        setError(null);
      } else {
        setError(err);
        setBoard(null);
      }
    }
  }, [demo, uid]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // load, then keep it live: pushed changes, a 30 s refresh, and when the connection comes back
  useEffect(() => {
    if (demo) return;
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    const online = () => void load();
    const offline = () => setOfflineAt((a) => a ?? Date.now());
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [demo, load]);

  const crewId = board?.crew.id;
  useEffect(() => {
    if (demo || !crewId) return;
    let timer = 0;
    // several changes often arrive together: reload once
    return subscribeBoard(crewId, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 400);
    });
  }, [demo, crewId, load]);

  // the clock for "synced 2 min ago", and the demo crew's drifting vitals
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (demo) setTick((n) => n + 1);
    }, demo ? 2500 : 20_000);
    return () => window.clearInterval(t);
  }, [demo]);

  const shown = useMemo(() => (demo ? demoBoard(tick, now) : board), [demo, tick, now, board]);
  const meId = demo ? "demo-0" : uid;

  const intro = "Link your crew card with your mission crew: one live board for everyone's vitals, buddy pairs, check-ins and a shared crew log.";

  return (
    <Shell
      eyebrow="Crew Link · group monitoring"
      title={shown ? shown.crew.name : "Crew Link."}
      intro={shown ? undefined : intro}
      back={{ label: "Back to VITALS" }}
      width={shown ? "max-w-[1720px]" : "max-w-6xl"}
    >
      {demo && (
        <Banner tone="sky">
          <span>
            <b>Demo crew.</b> Simulated readings from the team's crew cards, so you can see how Crew Link works.
          </span>
          {enabled && (
            <LiquidButton size="sm" type="button" onClick={() => setDemo(false)} className="h-8 px-3 text-xs text-white/80">
              Back to my crew
            </LiquidButton>
          )}
        </Banner>
      )}
      {!demo && offlineAt && (
        <Banner tone="amber">
          No connection: showing your crew as of {new Date(offlineAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Check-ins you
          post now are sent when the link is back.
        </Banner>
      )}

      {!demo && board === undefined && !error && <p className="text-white/60">Linking to your crew…</p>}
      {!demo && error && <SetupProblem error={error} onRetry={load} onDemo={() => setDemo(true)} />}
      {!demo && board === null && !error && profile && <FormCrew onDone={load} onDemo={() => setDemo(true)} />}
      {shown && (
        <CrewView
          board={{ ...shown, log: demo ? shown.log : [...pendingLog(uid), ...shown.log] }}
          meId={meId}
          now={now}
          demo={demo}
          onPost={async (kind, body) => {
            if (demo || !board || !profile) return;
            await postLog({ crew: board.crew.id, user_id: uid, display_name: profile.display_name, kind, body });
            // shown at once (as "waiting to send" when offline); the board refreshes in the background
            setTick((n) => n + 1);
            void load();
          }}
          onLeave={async () => {
            const err = await leaveCrew();
            if (err) return err;
            await load();
            return null;
          }}
          onRefresh={load}
        />
      )}
    </Shell>
  );
}

function Banner({ tone, children }: { tone: "sky" | "amber"; children: ReactNode }) {
  const c = tone === "sky" ? "border-sky-300/25 bg-sky-400/[0.07] text-sky-100/90" : "border-amber-300/30 bg-amber-400/[0.08] text-amber-100/90";
  return <div className={`mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

function SetupProblem({ error, onRetry, onDemo }: { error: LoadError; onRetry: () => void; onDemo: () => void }) {
  const text =
    error.kind === "setup"
      ? "Crew Link isn't switched on in the VITALS database yet. A mission administrator needs to run the Crew Link part of supabase/schema.sql."
      : error.kind === "offline"
        ? "No connection, and your crew hasn't been loaded on this device yet. Connect once and it will be kept for offline use."
        : `Couldn't load your crew: ${error.message}`;
  return (
    <div className={`${card} max-w-2xl`}>
      <p className="text-white/75">{text}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <LiquidButton size="sm" type="button" onClick={onRetry} className="h-9 gap-2 px-4 text-sm text-white/85">
          <RefreshCw className="h-4 w-4" /> Try again
        </LiquidButton>
        <RainbowButton onClick={onDemo} className="h-10 px-6 text-sm">
          Preview with the demo crew
        </RainbowButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Not in a crew yet: invitations, then create or join                */
/* ------------------------------------------------------------------ */

function FormCrew({ onDone, onDemo }: { onDone: () => void; onDemo: () => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [invites, setInvites] = useState<Invite[]>([]);
  const refreshInvites = useCallback(() => void loadInvites().then(setInvites), []);
  useEffect(() => {
    refreshInvites();
    const t = window.setInterval(refreshInvites, 30_000);
    return () => window.clearInterval(t);
  }, [refreshInvites]);

  return (
    <div className="space-y-8">
      {invites.length > 0 && <Invites invites={invites} onJoined={onDone} onChange={refreshInvites} />}

      <div className="flex flex-wrap gap-3" role="tablist" aria-label="Create or join a crew">
        {(["create", "join"] as const).map((m) => (
          <LiquidButton
            key={m}
            size="lg"
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-14 min-w-[11rem] gap-3 px-7 text-base font-semibold text-white transition-opacity ${mode === m ? (m === "create" ? "bg-sky-400/25" : "bg-violet-400/25") : "opacity-60 hover:opacity-100"}`}
          >
            <Glyph name={m === "create" ? "satellite" : "conjunction"} className="h-5 w-5" />
            {m === "create" ? "Create crew" : "Join crew"}
          </LiquidButton>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {mode === "create" ? <CreateCrew onDone={onDone} /> : <JoinCrew onDone={onDone} />}
        </motion.div>
      </AnimatePresence>

      <p className="max-w-[70ch] text-xs leading-relaxed text-white/45">
        Being in a crew shares your status, your latest readings and when you last synced with your crewmates, the same as commanders see. Your full history stays private. Nobody joins a crew without saying yes, and you can leave at any time.
      </p>
      <RainbowButton onClick={onDemo} className="h-10 px-6 text-sm">
        Preview with the demo crew
      </RainbowButton>
    </div>
  );
}

function Invites({ invites, onJoined, onChange }: { invites: Invite[]; onJoined: () => void; onChange: () => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const answer = async (crew: string, yes: boolean) => {
    setBusy(crew);
    setMsg("");
    const err = yes ? await acceptInvite(crew) : await declineInvite(crew);
    setBusy("");
    if (err) return setMsg(err);
    if (yes) onJoined();
    else onChange();
  };
  return (
    <div className={`${card} ring-1 ring-inset ring-sky-300/25`}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="envelope" size="sm" /> You've been invited
      </h2>
      <ul className="mt-4 divide-y divide-white/[0.07]">
        {invites.map((i) => (
          <li key={i.crew} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{i.crew_name}</p>
              <p className="text-sm text-white/55">
                {i.invited_by || "The crew lead"} invited you · Mission {i.mission} · {i.members} member{i.members === 1 ? "" : "s"}
              </p>
            </div>
            <ShinyButton tone="emerald" disabled={!!busy} onClick={() => answer(i.crew, true)} className="h-10 px-5 text-sm">
              {busy === i.crew ? "Joining…" : "Accept"}
            </ShinyButton>
            <LiquidButton size="sm" type="button" disabled={!!busy} onClick={() => answer(i.crew, false)} className="h-9 px-4 text-sm text-white/70">
              Decline
            </LiquidButton>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-sm text-rose-300">{msg}</p>}
    </div>
  );
}

function CreateCrew({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<CardPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true);
    setMsg("");
    const err = await createCrew(name, picked.map((p) => p.user_id));
    setBusy(false);
    if (err) return setMsg(err);
    onDone();
  };
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold">Create a crew</h2>
      <p className="mt-1 text-sm text-white/55">Name it, then add your crewmates' crew cards with the ^ button. You lead the crew, and each person you add gets an invitation.</p>
      <label className="mt-5 block text-sm text-white/70">
        Crew name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Mission 61:4 crew" className={`${field} mt-1.5`} />
      </label>
      <div className="mt-6">
        <CardPicker picked={picked} onChange={setPicked} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ShinyButton onClick={go} disabled={!name.trim() || busy} className="h-11 px-6 text-sm">
          <Glyph name="satellite" className="h-4 w-4" />
          {busy ? "Creating…" : picked.length ? `Create crew and invite ${picked.length}` : "Create crew"}
        </ShinyButton>
        <span className="text-xs text-white/45">You can invite more later, or share the crew's 10-digit code.</span>
      </div>
      {msg && <p className="mt-3 text-sm text-rose-300">{msg}</p>}
    </div>
  );
}

function JoinCrew({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ready = code.replace(/\D/g, "").length === 10;
  const go = async () => {
    setBusy(true);
    setMsg("");
    const err = await joinCrew(code);
    setBusy(false);
    if (err) return setMsg(err);
    onDone();
  };
  return (
    <form
      className={`${card} max-w-xl`}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void go();
      }}
    >
      <h2 className="text-lg font-semibold">Join a crew</h2>
      <p className="mt-1 text-sm text-white/55">Type the 10-digit crew code your crew lead shared with you.</p>
      <input
        value={code}
        onChange={(e) => setCode(formatCrewCode(e.target.value))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="48213-90375"
        aria-label="Crew code"
        className={`${field} mt-5 h-14 text-center font-mono text-2xl tracking-[0.3em]`}
      />
      <ShinyButton type="submit" tone="violet" disabled={!ready || busy} className="mt-4 h-11 w-full text-sm">
        <Glyph name="conjunction" className="h-4 w-4" />
        {busy ? "Joining…" : "Join crew"}
      </ShinyButton>
      {msg && <p className="mt-3 text-sm text-rose-300">{msg}</p>}
    </form>
  );
}

/**
 * Picking crew cards. Only the ones you've picked are shown; to add one, the ^ button opens a search
 * that pops up above it. Nothing is listed until you type a name or part of a crew number, so it stays
 * small however many crew cards there are. Tap a result to pick it.
 */
function CardPicker({ picked, onChange, exclude = [] }: { picked: CardPick[]; onChange: (p: CardPick[]) => void; exclude?: string[] }) {
  const [open, setOpen] = useState(false);
  const remove = (c: CardPick) => onChange(picked.filter((p) => p.user_id !== c.user_id));
  const full = picked.length >= 11;
  return (
    <div>
      <p className="text-sm text-white/70">Crew cards</p>
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <AnimatePresence initial={false}>
          {picked.map((p) => (
            <motion.span
              key={p.user_id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-sky-400/20 via-violet-400/10 to-transparent py-1.5 pl-1.5 pr-2 ring-1 ring-inset ring-sky-300/40"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.08] text-xs font-semibold text-white">{initials(p.display_name)}</span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-white">{p.display_name || "Crew member"}</span>
                <span className="block font-mono text-[10px] tracking-[0.12em] text-white/50">{p.crew_number}</span>
              </span>
              <button type="button" onClick={() => remove(p)} className="ml-1 grid h-6 w-6 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white" aria-label={`Remove ${p.display_name}`}>
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <div className="relative">
          <LiquidButton
            size="icon"
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={full}
            aria-expanded={open}
            aria-label={open ? "Close the crew card search" : "Add a crew card"}
            title={full ? "A crew has up to 12 members" : "Add a crew card"}
            className="h-12 w-12 text-white"
          >
            <ChevronUp className={`h-6 w-6 transition-transform duration-300 ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
          </LiquidButton>
          <AnimatePresence>
            {open && (
              <CardSearch
                exclude={[...exclude, ...picked.map((p) => p.user_id)]}
                onPick={(c) => {
                  onChange([...picked, c]);
                  setOpen(false);
                }}
                onClose={() => setOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
        {!picked.length && <span className="text-sm text-white/45">Tap ^ to find a crewmate by name or crew card number.</span>}
      </div>
    </div>
  );
}

/** The search that pops up above the ^ button: type, see a few small crew cards, tap one. */
function CardSearch({ exclude, onPick, onClose }: { exclude: string[]; onPick: (c: CardPick) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<CardPick[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skip = exclude.join();

  // nothing is fetched until something is typed; then only the best few matches
  useEffect(() => {
    if (!q.trim()) {
      setCards(null);
      setErr("");
      return;
    }
    let alive = true;
    setBusy(true);
    const t = window.setTimeout(async () => {
      const r = await searchCards(q.trim());
      if (!alive) return;
      setBusy(false);
      if (typeof r === "string") {
        setErr(r);
        setCards([]);
      } else {
        setErr("");
        setCards(r.filter((c) => !skip.split(",").includes(c.user_id)).slice(0, 6));
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [q, skip]);

  // Escape or a tap outside closes it
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const down = (e: PointerEvent) => {
      const btn = boxRef.current?.parentElement;
      if (btn && !btn.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={boxRef}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ transformOrigin: "bottom left" }}
      className="absolute bottom-full left-0 z-30 mb-3 w-[min(380px,calc(100vw-3rem))] rounded-3xl border border-white/15 bg-[#0d1018]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-xl"
      role="dialog"
      aria-label="Find a crew card"
    >
      {/* results sit above the search box, closest to it first */}
      <div className="flex max-h-[min(360px,50vh)] flex-col-reverse gap-2 overflow-y-auto">
        {err && <p className="px-2 py-1 text-sm text-amber-200/85">{err}</p>}
        {!q.trim() && <p className="px-2 py-1 text-sm text-white/45">Type a name or part of a crew card number.</p>}
        {q.trim() && busy && !cards?.length && <p className="px-2 py-1 text-sm text-white/45">Searching…</p>}
        {cards && !cards.length && !busy && !err && <p className="px-2 py-1 text-sm text-white/45">No crew card matches “{q.trim()}”.</p>}
        {cards?.map((c) => (
          <MiniCard key={c.user_id} card={c} picked={false} onToggle={() => onPick(c)} />
        ))}
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name or crew card number"
        aria-label="Search crew cards"
        autoComplete="off"
        className={`${field} mt-3`}
      />
    </motion.div>
  );
}

/** A small crew card: name, job and the full crew number, selectable. */
function MiniCard({ card: c, picked, onToggle }: { card: CardPick; picked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={c.in_crew}
      aria-pressed={picked}
      className={`group relative w-full overflow-hidden rounded-2xl p-3.5 text-left ring-1 ring-inset transition-all duration-200 ${
        c.in_crew
          ? "cursor-not-allowed bg-white/[0.02] opacity-50 ring-white/10"
          : picked
            ? "bg-gradient-to-br from-sky-400/25 via-violet-400/15 to-transparent ring-sky-300/60"
            : "bg-gradient-to-br from-white/[0.06] to-white/[0.01] ring-white/10 hover:ring-white/25"
      }`}
    >
      <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-sky-300/10 blur-xl" aria-hidden="true" />
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-sm font-semibold text-white ring-1 ring-inset ring-white/10">
          {initials(c.display_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{c.display_name || "Crew member"}</span>
          <span className="block truncate text-xs text-white/50">{c.in_crew ? "Already in a crew" : c.job || "Crew"}</span>
        </span>
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors ${picked ? "bg-sky-400 text-[#0b0d14] ring-sky-300" : "ring-white/25"}`}
          aria-hidden="true"
        >
          {picked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </span>
      <span className="mt-3 block font-mono text-[11px] tracking-[0.18em] text-white/55">{c.crew_number || "No crew number"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  The crew                                                           */
/* ------------------------------------------------------------------ */

function CrewView({
  board,
  meId,
  now,
  demo,
  onPost,
  onLeave,
  onRefresh,
}: {
  board: Board;
  meId: string;
  now: number;
  demo: boolean;
  onPost: (kind: LogKind, body: string) => Promise<void>;
  onLeave: () => Promise<string | null>;
  onRefresh: () => void;
}) {
  const buddies = useMemo(() => buddiesOf(board.members), [board.members]);
  const alerts = useMemo(() => alertsOf(board, now), [board, now]);
  const readiness = readinessOf(board.members, now);
  const cabin = cabinOf(board.members);
  const live = board.members.filter((m) => ageOf(m, now) <= LIVE_MS).length;
  const me = board.members.find((m) => m.user_id === meId);
  const myBuddies = buddies.get(meId) ?? [];

  return (
    <div className="space-y-6">
      <CrewHeader board={board} isLead={me?.role === "lead"} demo={demo} onRefresh={onRefresh} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Readiness pct={readiness.pct} ready={readiness.ready} total={readiness.total} />
        <Stat glyph="satellite" tone="sky" label="Linked live" value={`${live} / ${board.members.length}`} note="synced in the last 15 min" />
        <Stat
          glyph="warning"
          tone={alerts.some((a) => a.level === "red") ? "red" : alerts.length ? "amber" : "green"}
          label="Crew alerts"
          value={String(alerts.length)}
          note={alerts.length ? "see below" : "nothing needs attention"}
        />
        <Stat
          glyph="thermometer"
          tone="emerald"
          label="Cabin, crew average"
          value={cabin.temp ? `${cabin.temp.avg.toFixed(1)}°C` : "—"}
          note={cabin.humidity ? `${Math.round(cabin.humidity.avg)}% humidity · ${cabin.temp?.n ?? 0} sensor${cabin.temp?.n === 1 ? "" : "s"}` : "no room readings yet"}
        />
      </div>

      {alerts.length > 0 && (
        <div className={card}>
          <h2 className="flex items-center gap-3 text-lg font-semibold">
            <GlyphTile name="warning" size="sm" tone={alerts.some((a) => a.level === "red") ? "red" : "amber"} /> Needs attention
          </h2>
          <ul className="mt-4 space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS[a.level].dot}`} aria-label={STATUS[a.level].label} />
                <span className="text-white/80">
                  <b className="text-white">{a.who}</b> {a.text}
                </span>
              </li>
            ))}
          </ul>
          {cabin.temp && cabin.temp.max - cabin.temp.min >= 3 && (
            <p className="mt-3 text-xs text-white/50">
              Room temperatures across the crew differ by {(cabin.temp.max - cabin.temp.min).toFixed(1)}°C: one module may need its airflow checked.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Crew board">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold">Live crew board</h2>
            <p className="text-sm text-white/45">
              {demo ? "Simulated · updates every few seconds" : "Each crew member's own readings, from their account · updates live as they sync"}
            </p>
          </div>
          <div className="space-y-5">
            {board.members.map((m) => (
              <MemberPanel
                key={m.user_id}
                m={m}
                mission={board.crew.mission}
                me={m.user_id === meId}
                buddy={myBuddies.some((b) => b.user_id === m.user_id)}
                buddies={buddies.get(m.user_id) ?? []}
                now={now}
              />
            ))}
          </div>
        </section>
        <aside className="grid content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          <CheckIn demo={demo} buddies={myBuddies} onPost={onPost} />
          <CrewLog board={board} meId={meId} now={now} />
          {!demo && (me?.role === "lead" || (board.invited?.length ?? 0) > 0) && (
            <InvitePanel board={board} isLead={me?.role === "lead"} onInvited={onRefresh} />
          )}
        </aside>
      </div>

      {!demo && <LeaveCrew onLeave={onLeave} />}
    </div>
  );
}

function CrewHeader({ board, isLead, demo, onRefresh }: { board: Board; isLead: boolean; demo: boolean; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(board.crew.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* the code is on screen to read out */
    }
  };
  return (
    <div className="-mt-6 flex flex-wrap items-center gap-3 text-sm text-white/65">
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs tracking-wider">Mission {board.crew.mission}</span>
      <span>
        {board.members.length} crew member{board.members.length === 1 ? "" : "s"}
        {isLead && " · you lead this crew"}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="text-xs text-white/45">Crew code</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-sm tracking-[0.2em] text-white transition-colors hover:bg-white/[0.1]"
          aria-label={`Copy crew code ${board.crew.code}`}
        >
          {board.crew.code}
          {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4 text-white/50" />}
        </button>
        {!demo && (
          <LiquidButton size="icon" type="button" aria-label="Refresh the crew board" onClick={onRefresh} className="h-9 w-9 text-white">
            <RefreshCw className="h-4 w-4" />
          </LiquidButton>
        )}
      </span>
    </div>
  );
}

function Readiness({ pct, ready, total }: { pct: number; ready: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div className={`${card} flex items-center gap-4 p-5`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </svg>
      <div>
        <p className="text-xs uppercase tracking-wider text-white/45">Crew readiness</p>
        <p className="text-2xl font-semibold tabular-nums">{pct}%</p>
        <p className="text-xs text-white/50">
          {ready} of {total} green and live
        </p>
      </div>
    </div>
  );
}

function Stat({ glyph, tone, label, value, note }: { glyph: GlyphName; tone: "sky" | "red" | "green" | "amber" | "emerald"; label: string; value: string; note: string }) {
  return (
    <div className={`${card} flex items-center gap-4 p-5`}>
      <GlyphTile name={glyph} tone={tone} />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-white/50">{note}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One crew member on the board                                       */
/* ------------------------------------------------------------------ */

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** The readings shown for each crew member, in the order of the Live monitor. */
const READINGS: { key: keyof CrewReadings; label: string; unit: string; range: string; dec: number; get: (m: Member) => number | null }[] = [
  { key: "heart", label: "Heart rate", unit: "bpm", range: "60–100", dec: 0, get: (m) => m.heart },
  { key: "spo2", label: "Blood oxygen", unit: "%", range: "95–100", dec: 0, get: (m) => m.spo2 },
  { key: "ecg", label: "ECG heart rate", unit: "bpm", range: "60–100", dec: 0, get: (m) => m.ecg },
  { key: "room", label: "Room temp", unit: "°C", range: "18–33", dec: 1, get: (m) => m.room_temp },
  { key: "humidity", label: "Humidity", unit: "%", range: "30–60", dec: 0, get: (m) => m.humidity },
  { key: "air", label: "Air quality", unit: "% vs clean", range: "0–19", dec: 0, get: (m) => m.air },
  { key: "sleep", label: "Sleep", unit: "h", range: "7–9", dec: 1, get: (m) => m.sleep },
  { key: "water", label: "Water", unit: "L", range: "2.5–3.5", dec: 1, get: (m) => m.water },
  { key: "exercise", label: "Exercise", unit: "min", range: "30–180", dec: 0, get: (m) => m.exercise },
];

const LEVEL_TEXT = { green: "text-white", yellow: "text-watch", red: "text-act" } as const;

/** One crew member: their own crew card, and every reading from their account, large. */
function MemberPanel({ m, mission, me, buddy, buddies, now }: { m: Member; mission: string; me: boolean; buddy: boolean; buddies: Member[]; now: number }) {
  const calm = useReducedMotion();
  const age = ageOf(m, now);
  const s = STATUS[m.status ?? "none"];
  const liveNow = age <= LIVE_MS;
  const stale = age > STALE_MS;
  const beat = m.heart && liveNow && !calm ? `${(60 / m.heart).toFixed(2)}s` : undefined;
  // the crew card shows the same readings on its back
  const readings: CrewReadings = {};
  for (const r of READINGS) {
    const v = r.get(m);
    if (v != null) readings[r.key] = v;
  }
  const d = describe({ id: m.user_id, name: m.display_name, role: m.job, crewId: m.crew_number, readings, kind: "team", updatedAt: 0 });
  const status = m.status ?? d.status;
  return (
    <motion.article layout className={`${card} relative overflow-hidden p-5 ring-1 ring-inset sm:p-7 ${s.ring}`}>
      {m.status === "red" && <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-500/[0.06]" aria-hidden="true" />}
      <div className="grid items-center gap-7 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[340px]">
          <HoloCard
            name={m.display_name || "Crew member"}
            role={m.job || "Crew"}
            crewId={m.crew_number || "0000000000000000"}
            mission={mission}
            status={status}
            statusNote={age === Infinity ? "No readings shared yet." : d.statusNote}
            baselines={d.baselines}
            backTitle="Latest readings"
            maxTilt={9}
            motion={false}
            className="w-full"
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
                <span className="truncate">{m.display_name || "Crew member"}</span>
                {me && <Tag className="bg-sky-400/15 text-sky-200">You</Tag>}
                {m.role === "lead" && <Tag className="bg-violet-400/15 text-violet-200">Lead</Tag>}
                {buddy && <Tag className="bg-emerald-400/15 text-emerald-200">Your buddy</Tag>}
              </p>
              <p className="mt-0.5 text-sm text-white/55">
                {m.job || "Crew"}
                {m.crew_number && <span className="ml-3 font-mono text-xs tracking-[0.15em] text-white/35">{m.crew_number}</span>}
              </p>
            </div>
            <span className={`flex items-center gap-2 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold ${s.text}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
              {s.label}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {READINGS.map((r) => {
              const v = r.get(m);
              const level = v != null ? levelOf(r.key, v) : null;
              return (
                <div key={r.key} className="rounded-2xl bg-white/[0.035] px-4 py-3 ring-1 ring-inset ring-white/[0.05]">
                  <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
                    {r.key === "heart" && (
                      <span className="inline-block text-rose-300" style={beat ? { animation: `crew-beat ${beat} ease-in-out infinite` } : undefined}>
                        <Glyph name="heart" className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {level && level !== "green" && <span className={`h-1.5 w-1.5 rounded-full ${STATUS[level].dot}`} aria-label={STATUS[level].label} />}
                    {r.label}
                  </dt>
                  <dd className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="whitespace-nowrap">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={String(v)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className={`inline-block text-3xl font-semibold tabular-nums ${v == null ? "text-white/25" : LEVEL_TEXT[level ?? "green"]}`}
                        >
                          {v == null ? "—" : v.toFixed(r.dec)}
                        </motion.span>
                      </AnimatePresence>
                      {v != null && <span className="ml-1 text-xs text-white/45">{r.unit}</span>}
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-white/30">{r.range}</span>
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={`flex items-center gap-2 ${stale ? "text-watch" : "text-white/55"}`}>
              <span className="relative flex h-2 w-2">
                {liveNow && !calm && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${liveNow ? "bg-ok" : stale ? "bg-watch" : "bg-white/30"}`} />
              </span>
              {age === Infinity
                ? "No readings shared yet: they appear once this crew member uses the Live monitor"
                : liveNow
                  ? `Live · synced ${ago(age)}${ago(age) === "just now" ? "" : " ago"}`
                  : `Last synced ${ago(age)} ago`}
            </span>
            {buddies.length > 0 && <span className="text-white/40">Buddy: {buddies.map((b) => b.display_name.split(" ")[0]).join(" & ")}</span>}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/*  Check-ins, buddy checks and the crew log                           */
/* ------------------------------------------------------------------ */

function CheckIn({ demo, buddies, onPost }: { demo: boolean; buddies: Member[]; onPost: (kind: LogKind, body: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const send = async (kind: LogKind, body: string) => {
    if (demo) {
      setDone("Demo crew: check-ins are saved when you're in a real crew.");
      return;
    }
    setBusy(true);
    await onPost(kind, body.trim());
    setBusy(false);
    setNote("");
    setDone(kind === "help" ? "Your crew has been alerted. Contact the flight surgeon now if it's serious." : "Posted to the crew log.");
    window.setTimeout(() => setDone(""), 5000);
  };
  const btn = "h-10 flex-1 gap-2 px-3 text-sm font-semibold text-white";
  return (
    <div className={card}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="headset" size="sm" tone="emerald" /> Check in
      </h2>
      <p className="mt-2 text-sm text-white/55">Tell your crew how you are. It works offline and is sent when the link is back.</p>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Add a note (optional)" className={`${field} mt-4`} aria-label="Note for your crew" />
      <div className="mt-3 flex flex-wrap gap-2">
        <LiquidButton size="sm" type="button" disabled={busy} onClick={() => send("ok", note)} className={`${btn} bg-emerald-400/15`}>
          <Glyph name="check" className="h-4 w-4" /> I'm good
        </LiquidButton>
        <LiquidButton size="sm" type="button" disabled={busy} onClick={() => send("watch", note)} className={`${btn} bg-amber-400/15`}>
          <Glyph name="warning" className="h-4 w-4" /> Feeling off
        </LiquidButton>
        <LiquidButton size="sm" type="button" disabled={busy} onClick={() => send("help", note)} className={`${btn} bg-rose-500/20`}>
          <Glyph name="medKit" className="h-4 w-4" /> Need help
        </LiquidButton>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {note.trim() && (
          <LiquidButton size="sm" type="button" disabled={busy} onClick={() => send("note", note)} className="h-9 px-4 text-sm text-white/80">
            Post as a note
          </LiquidButton>
        )}
        {buddies.map((b) => (
          <LiquidButton
            key={b.user_id}
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => send("buddy", `Checked on ${b.display_name}${note.trim() ? `: ${note.trim()}` : "."}`)}
            className="h-9 gap-2 px-4 text-sm text-white/80"
          >
            <Glyph name="people" className="h-4 w-4" /> Buddy check on {b.display_name.split(" ")[0]}
          </LiquidButton>
        ))}
      </div>
      {done && (
        <p role="status" className="mt-3 text-sm text-white/70">
          {done}
        </p>
      )}
    </div>
  );
}

function CrewLog({ board, meId, now }: { board: Board; meId: string; now: number }) {
  return (
    <div className={card}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="report" size="sm" tone="violet" /> Crew log
      </h2>
      {!board.log.length && <p className="mt-4 text-sm text-white/50">Nothing yet. Check in to start the log.</p>}
      <ol className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {board.log.map((l) => {
            const k = KIND[l.kind];
            return (
              <motion.li key={l.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 text-sm">
                <span className={`mt-0.5 ${k.tone}`}>
                  <Glyph name={k.glyph} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-white/85">
                    <b className="text-white">{l.user_id === meId ? "You" : l.display_name || "Crew member"}</b> <span className={`text-xs ${k.tone}`}>{k.label}</span>
                  </p>
                  {l.body && <p className="break-words text-white/65">{l.body}</p>}
                  <p className="text-[11px] text-white/35">{l.pending ? "Waiting to send" : `${ago(now - Date.parse(l.created_at))}${ago(now - Date.parse(l.created_at)) === "just now" ? "" : " ago"}`}</p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/** Who's been invited and hasn't answered, and (for the lead) picking more crew cards. */
function InvitePanel({ board, isLead, onInvited }: { board: Board; isLead: boolean; onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CardPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const invited = board.invited ?? [];
  const send = async () => {
    setBusy(true);
    setMsg("");
    const err = await inviteToCrew(picked.map((p) => p.user_id));
    setBusy(false);
    if (err) return setMsg(err);
    setMsg(`Invited ${picked.length}. They'll see it on their Crew Link page.`);
    setPicked([]);
    setOpen(false);
    onInvited();
  };
  return (
    <div className={card}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="envelope" size="sm" /> Invitations
      </h2>
      {invited.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {invited.map((i) => (
            <li key={i.user_id} className="flex items-center justify-between gap-3">
              <span className="text-white/80">{i.display_name || "Crew member"}</span>
              <span className="font-mono text-[11px] text-white/40">waiting · ··{i.crew_number.slice(-4)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-white/50">No invitations waiting.</p>
      )}
      {isLead && !open && (
        <LiquidButton size="sm" type="button" onClick={() => setOpen(true)} className="mt-4 h-9 gap-2 px-4 text-sm text-white/85">
          <Glyph name="people" className="h-4 w-4" /> Invite crew cards
        </LiquidButton>
      )}
      {isLead && open && (
        <div className="mt-4">
          <CardPicker picked={picked} onChange={setPicked} exclude={[...board.members.map((m) => m.user_id), ...invited.map((i) => i.user_id)]} />
          <div className="mt-4 flex gap-2">
            <ShinyButton disabled={!picked.length || busy} onClick={send} className="h-10 px-5 text-sm">
              {busy ? "Inviting…" : `Invite ${picked.length || ""}`.trim()}
            </ShinyButton>
            <LiquidButton size="sm" type="button" onClick={() => setOpen(false)} className="h-9 px-4 text-sm text-white/70">
              Cancel
            </LiquidButton>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-white/70">{msg}</p>}
    </div>
  );
}

function LeaveCrew({ onLeave }: { onLeave: () => Promise<string | null> }) {
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-6 text-sm text-white/50">
      <p className="flex-1">Your crewmates see your status, your latest readings and when you last synced. Your full history stays private.</p>
      {sure ? (
        <>
          <span>Leave this crew?</span>
          <LiquidButton
            size="sm"
            type="button"
            onClick={async () => {
              const err = await onLeave();
              if (err) setMsg(err);
              setSure(false);
            }}
            className="h-9 bg-rose-500/20 px-4 text-sm font-semibold text-white"
          >
            Leave
          </LiquidButton>
          <LiquidButton size="sm" type="button" onClick={() => setSure(false)} className="h-9 px-4 text-sm text-white/75">
            Stay
          </LiquidButton>
        </>
      ) : (
        <LiquidButton size="sm" type="button" onClick={() => setSure(true)} className="h-9 gap-2 px-4 text-sm text-white/70">
          <LogOut className="h-4 w-4" /> Leave crew
        </LiquidButton>
      )}
      {msg && <p className="w-full text-rose-300">{msg}</p>}
    </div>
  );
}
