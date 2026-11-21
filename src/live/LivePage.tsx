import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ShinyButton } from "@/components/ui/shiny-button";
import { RainbowButton } from "@/components/ui/rainbow-button";
import type { Check as ScanCheck } from "./BodyScan";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { HoloCard, type CrewStatus, type HoloCardHandle } from "@/components/ui/holo-card";
import { Glyph, GlyphTile, StatusDot, type GlyphName } from "@/components/ui/glyph";
import { readings } from "@/content";
import { putCard, saveMyReadings, type CrewReadings } from "@/lib/crewDb";
import { useAuth } from "@/lib/auth";
import {
  demoCandidate,
  pairedBluetooth,
  pairedUsb,
  pickBluetooth,
  pickUsb,
  support,
  wifiBlockedReason,
  wifiCandidate,
  type Candidate,
  type DeviceData,
  type Link,
  type LinkKind,
} from "@/live/connections";

/* ------------------------------------------------------------------ */
/*  Ranges and status                                                  */
/* ------------------------------------------------------------------ */

type Status = "NORMAL" | "WATCH" | "ACT";
type Range = { green: [number, number]; yellow: [number, number] };
const RANK: Record<Status, number> = { NORMAL: 0, WATCH: 1, ACT: 2 };

/** Green / yellow ranges from the Readings section (src/content.ts), e.g. "60–100" -> [60, 100]. */
function range(key: string): Range | null {
  const r = readings.find((x) => x.key === key);
  if (!r) return null;
  const parse = (s: string) => s.split(/[–-]/).map(Number) as [number, number];
  return { green: parse(r.green), yellow: parse(r.yellow) };
}
const RANGES = {
  heartRate: range("heartRate"),
  spo2: range("spo2"),
  roomTemp: range("roomTemp"),
  humidity: range("humidity"),
  sleep: range("sleep"),
  water: range("waterIntake"),
  exercise: range("exercise"),
  airQuality: { green: [0, 19], yellow: [0, 50] } as Range,
};

/** ECG intervals in ms (normal resting adult). QTc: up to 440 (men) or 460 (women). */
const ECG_INTERVALS = [
  { key: "ecgPR", label: "PR interval", range: { green: [120, 200], yellow: [120, 200] } as Range, normal: "120–200 ms", what: "Upper to lower chambers" },
  { key: "ecgQRS", label: "QRS duration", range: { green: [60, 100], yellow: [60, 110] } as Range, normal: "60–100 ms (up to 110)", what: "Lower chambers contract" },
  { key: "ecgQT", label: "QT", range: null, normal: "varies with heart rate", what: "Contract and recharge" },
  { key: "ecgQTc", label: "QTc", range: { green: [0, 440], yellow: [0, 460] } as Range, normal: "≤ 440 men · ≤ 460 women", what: "QT adjusted for heart rate" },
] as const;

function statusOf(r: Range | null, v: number | null | undefined): Status | null {
  if (v == null || !r) return null;
  if (v >= r.green[0] && v <= r.green[1]) return "NORMAL";
  if (v >= r.yellow[0] && v <= r.yellow[1]) return "WATCH";
  return "ACT";
}
const worse = (a: Status | null, b: Status | null): Status | null => (!a ? b : !b ? a : RANK[b] > RANK[a] ? b : a);

/* ------------------------------------------------------------------ */
/*  Demo-only simulated values (never used for real hardware)          */
/* ------------------------------------------------------------------ */

// Nothing is simulated in the page any more: room temperature and humidity come from the sensor
// (or the demo device). Kept as an empty table so a future simulated value is one line to add.
type Sim = Record<string, number>;
const SIM_LIMITS: Record<string, [number, number, number]> = {};

/* ------------------------------------------------------------------ */
/*  Daily log: sleep, water and exercise, logged by hand with + and -  */
/* ------------------------------------------------------------------ */

type LogKey = "sleep" | "water" | "exercise";
type DailyLog = Record<LogKey, number | null>;
const EMPTY_LOG: DailyLog = { sleep: null, water: null, exercise: null };
/** Step per tap, the top of the scale, and decimals shown. */
const LOG_SCALE: Record<LogKey, { step: number; max: number; dec: number }> = {
  sleep: { step: 0.5, max: 12, dec: 1 },
  water: { step: 0.25, max: 5, dec: 2 },
  exercise: { step: 5, max: 240, dec: 0 },
};
const today = () => new Date().toISOString().slice(0, 10);

/** Today's log, kept on this device only. A new day starts empty. */
function loadLog(): DailyLog {
  try {
    const raw = JSON.parse(localStorage.getItem("vitals-daily-log") ?? "null");
    if (raw && raw.day === today()) return { ...EMPTY_LOG, ...raw.log };
  } catch {
    /* storage blocked or unreadable: start empty */
  }
  return EMPTY_LOG;
}
function saveLog(log: DailyLog) {
  try {
    localStorage.setItem("vitals-daily-log", JSON.stringify({ day: today(), log }));
  } catch {
    /* storage blocked: the log still works until the page closes */
  }
}
const stepSim = (s: Sim): Sim => {
  const n = { ...s };
  for (const [k, [lo, hi, step]] of Object.entries(SIM_LIMITS) as [keyof Sim, [number, number, number]][]) {
    n[k] = Math.min(hi, Math.max(lo, n[k] + (Math.random() * 2 - 1) * step));
  }
  return n;
};

/* ------------------------------------------------------------------ */
/*  Shared bits                                                        */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string } & Record<string, unknown>;
const glyphIcon = (name: GlyphName) => (p: IconProps) => <Glyph name={name} className={p.className} />;
const KIND_ICON: Record<LinkKind, (p: IconProps) => ReactNode> = {
  usb: glyphIcon("usb"),
  bluetooth: glyphIcon("bluetooth"),
  wifi: glyphIcon("wifi"),
  demo: glyphIcon("play"),
};
const KIND_LABEL: Record<LinkKind, string> = { usb: "USB cable", bluetooth: "Bluetooth", wifi: "Wi-Fi", demo: "Demo" };

const STATUS_WORD: Record<Status, string> = { NORMAL: "Normal", WATCH: "Watch", ACT: "Act now" };
const STATUS_TEXT: Record<Status, string> = { NORMAL: "text-ok", WATCH: "text-watch", ACT: "text-act" };
const STATUS_RING: Record<Status, string> = { NORMAL: "border-ok/40", WATCH: "border-watch/50", ACT: "border-act/60" };
const STATUS_BG: Record<Status, string> = { NORMAL: "bg-ok/10", WATCH: "bg-watch/10", ACT: "bg-act/10" };
const CARD_STATUS: Record<Status, CrewStatus> = { NORMAL: "green", WATCH: "yellow", ACT: "red" };

type Source = "LIVE" | "DEMO" | "TYPED" | "OFF";
const TAG_STYLE: Record<Source, string> = {
  LIVE: "bg-ok/15 text-ok",
  DEMO: "bg-sky-400/15 text-sky-300",
  TYPED: "bg-primary/15 text-primary",
  OFF: "bg-white/[0.06] text-white/40",
};
const TAG_WORD: Record<Source, string> = { LIVE: "Live", DEMO: "Demo", TYPED: "Typed in", OFF: "No reading" };

const inputCls =
  "h-9 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-white/35 focus:border-primary/70 focus:outline-none";

function loadName(): string {
  try {
    return localStorage.getItem("vitals-name") ?? "";
  } catch {
    return "";
  }
}
function saveName(n: string) {
  try {
    localStorage.setItem("vitals-name", n);
  } catch {
    /* storage blocked: the name just isn't remembered */
  }
}
/** A stable 16-digit crew ID made from the name, in the team's 2026 1114 0061 xxxx style. */
function crewIdFor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `2026 1114 0061 ${String(h % 10000).padStart(4, "0")}`;
}

/** Page shell: back link, eyebrow, title, intro. Each step looks like its own page. Also used by the Hygiene page. */
export function Shell({
  eyebrow,
  title,
  intro,
  back,
  children,
  className = "",
  width = "max-w-6xl",
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  back: { label: string; onClick?: () => void };
  children: ReactNode;
  className?: string;
  /** max width of the page; Crew Link's board uses a wider one */
  width?: string;
}) {
  return (
    <main className={`relative min-h-svh px-6 pb-24 pt-8 sm:px-12 ${className}`}>
      <div className={`mx-auto ${width}`}>
        <header className="mb-14 flex items-center justify-between gap-4">
          {back.onClick ? (
            <LiquidButton size="sm" type="button" onClick={back.onClick} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {back.label}
            </LiquidButton>
          ) : (
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-white/45">
              <a href="#" className="rounded text-white/70 transition-colors hover:text-white" aria-label={back.label}>
                VITALS
              </a>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-sky-300/90">
                {eyebrow.split(" · ")[0]}
              </span>
            </nav>
          )}
          <span className="text-lg font-bold tracking-tight">
            VITALS<span className="text-primary">.</span>
          </span>
        </header>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-sky-300">{eyebrow}</p>
        <h1 className="mb-4 max-w-[20ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mb-12 max-w-[62ch] text-white/65">{intro}</p>}
        {children}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: pairing                                                    */
/* ------------------------------------------------------------------ */

function PairStep({ onPick, notice }: { onPick: (c: Candidate) => void; notice: string }) {
  const [busy, setBusy] = useState<LinkKind | null>(null);
  const [error, setError] = useState("");
  const [address, setAddress] = useState("vitals.local");
  const [paired, setPaired] = useState<Candidate[]>([]);
  const wifiBlocked = wifiBlockedReason();

  const refresh = useCallback(async () => setPaired([...(await pairedUsb()), ...(await pairedBluetooth())]), []);

  useEffect(() => {
    void refresh();
    // Plug in a device this site already knows: it's recognised and offered straight away.
    const nav = navigator as unknown as { serial?: EventTarget };
    const onConnect = async () => {
      const list = await pairedUsb();
      await refresh();
      if (list.length) onPick(list[list.length - 1]);
    };
    nav.serial?.addEventListener("connect", onConnect);
    return () => nav.serial?.removeEventListener("connect", onConnect);
  }, [refresh, onPick]);

  const scan = async (kind: LinkKind, pick: () => Promise<Candidate | null>, none: string) => {
    setError("");
    setBusy(kind);
    const c = await pick();
    setBusy(null);
    if (c) onPick(c);
    else setError(none);
  };

  const btn = "h-10 w-full rounded-full bg-primary/25 text-sm font-semibold text-white disabled:opacity-40";
  const methods: { kind: LinkKind; title: string; body: string; ok: boolean; why: string; action: ReactNode }[] = [
    {
      kind: "bluetooth",
      title: "Bluetooth",
      body: "Scan for VITALS sensors nearby. Your browser shows the devices it finds.",
      ok: support.bluetooth,
      why: "This browser can't use Bluetooth. Use Chrome or Edge on a computer or Android.",
      action: (
        <LiquidButton size="sm" type="button" disabled={!support.bluetooth || busy !== null} onClick={() => scan("bluetooth", pickBluetooth, "No Bluetooth device was chosen.")} className={btn}>
          {busy === "bluetooth" ? "Scanning…" : "Scan for devices"}
        </LiquidButton>
      ),
    },
    {
      kind: "wifi",
      title: "Wi-Fi",
      body: "Connect to a VITALS sensor on the same network, by its name or address.",
      ok: !wifiBlocked,
      why: wifiBlocked ?? "",
      action: (
        <form
          className="flex gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (address.trim()) onPick(wifiCandidate(address));
          }}
        >
          <label htmlFor="wifi-address" className="sr-only">
            Device address
          </label>
          <input id="wifi-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!!wifiBlocked} placeholder="vitals.local or 192.168.1.50" className={`${inputCls} h-10 disabled:opacity-40`} />
          <LiquidButton size="sm" type="submit" disabled={!!wifiBlocked || !address.trim()} className="h-10 shrink-0 rounded-full bg-primary/25 px-4 text-sm font-semibold text-white disabled:opacity-40">
            Find
          </LiquidButton>
        </form>
      ),
    },
    {
      kind: "usb",
      title: "USB cable",
      body: "Plug the sensor into this device with a USB cable, then pick it from the list.",
      ok: support.usb,
      why: "This browser can't use USB devices. Use Chrome or Edge on a computer.",
      action: (
        <div className="space-y-2">
          <LiquidButton size="sm" type="button" disabled={!support.usb || busy !== null} onClick={() => scan("usb", () => pickUsb(), "No USB sensor was chosen. If yours isn't in the list, try \"Show all ports\".")} className={btn}>
            {busy === "usb" ? "Waiting…" : "Choose USB sensor"}
          </LiquidButton>
          {support.usb && (
            <LiquidButton size="sm" type="button" disabled={busy !== null} onClick={() => scan("usb", () => pickUsb(true), "No port was chosen.")} className="w-full text-center text-xs text-sky-300 hover:underline disabled:opacity-40">
              Not listed? Show all ports
            </LiquidButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {notice && <p className="rounded-xl border border-watch/30 bg-watch/[0.07] px-4 py-3 text-sm text-watch">{notice}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {methods.map((m) => {
          const Icon = KIND_ICON[m.kind];
          return (
            <div key={m.kind} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0d14]/95 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">{m.title}</h3>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-white/60">{m.ok ? m.body : m.why}</p>
              {m.action}
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-watch">{error}</p>}

      <div>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-sky-300">Devices ready to pair</h3>
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14]/95">
          {[...paired, demoCandidate].map((c, i) => {
            const Icon = KIND_ICON[c.kind];
            return (
              <li key={`${c.kind}-${i}`} className="flex items-center gap-4 px-5 py-4">
                <Icon className="h-5 w-5 shrink-0 text-sky-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-white/50">
                    {KIND_LABEL[c.kind]} · {c.detail}
                  </p>
                </div>
                <LiquidButton size="sm" type="button" onClick={() => onPick(c)} className="h-9 shrink-0 rounded-full border border-white/15 px-4 text-sm font-medium text-white/85 hover:border-primary/60">
                  Pair
                </LiquidButton>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-white/45">
          The sensor must be plugged into, or near, the device you're using right now. A USB sensor you've used before
          is recognised as soon as you plug it in. New devices are found with the buttons above: for your security, the
          browser asks you to pick them yourself the first time. No hardware? Pair with the demo device.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: confirm                                                    */
/* ------------------------------------------------------------------ */

function ConfirmStep({ device, connecting, onConfirm, onCancel }: { device: Candidate; connecting: boolean; onConfirm: () => void; onCancel: () => void }) {
  const Icon = KIND_ICON[device.kind];
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0b0d14]/95 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-5 text-sm text-white/55">Pair with this device?</p>
      <h3 className="mt-1 text-2xl font-semibold">{device.name}</h3>
      <p className="mt-1 text-sm text-white/50">
        {KIND_LABEL[device.kind]} · {device.detail}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <LiquidButton size="sm" type="button" onClick={onCancel} disabled={connecting} className="h-11 flex-1 rounded-full border border-white/15 text-sm font-medium text-white/80 disabled:opacity-40">
          Choose another
        </LiquidButton>
        <ShinyButton onClick={onConfirm} disabled={connecting} className="h-11 flex-1 px-4 text-sm">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          {connecting ? "Pairing…" : "Confirm pairing"}
        </ShinyButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: your name                                                  */
/* ------------------------------------------------------------------ */

function NameStep({ deviceName, onDone }: { deviceName: string; onDone: (name: string) => void }) {
  const [draft, setDraft] = useState(loadName);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = draft.trim().slice(0, 28);
        if (!n) return;
        saveName(n);
        onDone(n);
      }}
      className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-8 text-center sm:p-10"
    >
      <GlyphTile name="helmet" size="lg" className="mx-auto" />
      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-ok">
        <Check className="h-4 w-4" aria-hidden="true" /> Paired with {deviceName}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">What's your name?</h2>
      <p className="mt-2 text-sm text-white/55">It goes on your vital card, and it never leaves this device.</p>
      <label htmlFor="vital-name" className="sr-only">
        Your name
      </label>
      <input
        id="vital-name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={28}
        autoComplete="given-name"
        autoFocus
        placeholder="Your name"
        className="mt-7 h-12 w-full rounded-full border border-white/15 bg-white/[0.04] px-5 text-center text-lg text-white placeholder:text-white/35 focus:border-primary/70 focus:outline-none"
      />
      <ShinyButton type="submit" disabled={!draft.trim()} className="mt-4 h-12 w-full">
        Show my vital card <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </ShinyButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4: your vital card + readings                                 */
/* ------------------------------------------------------------------ */

function Reading({
  icon,
  label,
  value,
  unit,
  status,
  source,
  note,
  children,
}: {
  icon: GlyphName;
  label: string;
  value: string;
  unit: string;
  status: Status | null;
  source?: Source;
  note: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-3xl border bg-[#0b0d14]/95 p-6 ${status ? STATUS_RING[status] : "border-white/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <GlyphTile name={icon} tone={status === "ACT" ? "red" : status === "WATCH" ? "amber" : "sky"} />
        {source && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TAG_STYLE[source]}`}>{TAG_WORD[source]}</span>}
      </div>
      <p className="mt-5 text-sm font-medium text-white/60">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={`text-5xl font-bold tabular-nums tracking-tight ${value === "—" ? "text-white/25" : "text-white"}`}>{value}</span>
        <span className="text-base font-medium text-white/45">{unit}</span>
      </p>
      <p className="mt-3 text-[13px] text-white/50">
        {status && (
          <span className={`mr-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[status]} ${STATUS_TEXT[status]}`}>
            <StatusDot status={status} className="!h-1.5 !w-1.5 !shadow-none" /> {STATUS_WORD[status]}
          </span>
        )}
        {note}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** A small "type it in" form for values the sensor can't measure. */
function TypeIn({ id, placeholder, onSave, pattern, clear }: { id: string; placeholder: string; onSave: (s: string) => boolean; pattern?: string; clear?: () => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSave(v.trim())) setV("");
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} inputMode="decimal" pattern={pattern} className={inputCls} />
      <LiquidButton size="sm" type="submit" className="h-9 shrink-0 rounded-full border border-white/15 px-3.5 text-xs font-medium text-white/80 hover:border-primary/60">
        Save
      </LiquidButton>
      {clear && (
        <LiquidButton size="sm" type="button" onClick={clear} className="h-9 shrink-0 px-1 text-xs text-sky-300 hover:underline">
          Clear
        </LiquidButton>
      )}
    </form>
  );
}

/** Liquid glass - and + buttons, with a scale showing the value against its normal band. */
function LogStepper({ id, label, value, unit, range: r, onChange }: { id: LogKey; label: string; value: number | null; unit: string; range: Range | null; onChange: (v: number | null) => void }) {
  const { step, max } = LOG_SCALE[id];
  const v = value ?? 0;
  const set = (n: number) => onChange(Math.round(Math.min(max, Math.max(0, n)) * 100) / 100);
  const pct = (x: number) => `${(Math.min(max, Math.max(0, x)) / max) * 100}%`;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-white/[0.07]" role="meter" aria-label={`${label}, scale 0 to ${max} ${unit}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={v}>
        {r && <div className="absolute inset-y-0 rounded-full bg-ok/25" style={{ left: pct(r.green[0]), width: `calc(${pct(r.green[1])} - ${pct(r.green[0])})` }} />}
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400/70 to-primary transition-[width] duration-200" style={{ width: pct(v) }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/35">
        <span>0</span>
        {r && (
          <span className="text-ok/70">
            Normal {r.green[0]}–{r.green[1]}
          </span>
        )}
        <span>
          {max} {unit}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <LiquidButton size="icon" type="button" aria-label={`${label}: minus ${step} ${unit}`} disabled={value == null || value <= 0} onClick={() => set(v - step)} className="h-11 w-11 shrink-0 text-xl font-semibold text-white disabled:opacity-35">
          −
        </LiquidButton>
        <span className="flex-1 text-center text-xs text-white/45">
          {step} {unit} per tap
        </span>
        <LiquidButton size="icon" type="button" aria-label={`${label}: plus ${step} ${unit}`} disabled={v >= max} onClick={() => set(v + step)} className="h-11 w-11 shrink-0 bg-primary/25 text-xl font-semibold text-white disabled:opacity-35">
          +
        </LiquidButton>
      </div>
    </div>
  );
}

function EcgStrip({ samples, message }: { samples: number[]; message: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const g = c.getContext("2d");
    if (!g) return;
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "#1b1e2c";
    g.lineWidth = 1;
    for (let i = 0; i <= 20; i++) {
      const x = Math.round((i * W) / 20) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = Math.round((i * H) / 6) + 0.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    if (samples.length < 2) {
      g.fillStyle = "#8b90a5";
      g.font = `${14 * dpr}px Inter, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(message, W / 2, H / 2);
      return;
    }
    const keep = 1000;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of samples) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = Math.max(hi - lo, 50);
    const pad = H * 0.1;
    g.strokeStyle = "#34d399";
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    samples.forEach((v, i) => {
      const x = (i / (keep - 1)) * W + (W * (keep - samples.length)) / keep;
      const y = H - pad - ((v - lo) / span) * (H - 2 * pad);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }, [samples, message]);
  return <canvas ref={ref} className="block h-44 w-full" aria-label="ECG trace, last 4 seconds" />;
}

function Heading({ icon, children }: { icon: GlyphName; children: ReactNode }) {
  return (
    <h2 className="mb-5 flex items-center gap-3 text-2xl font-semibold tracking-tight">
      <GlyphTile name={icon} size="sm" />
      {children}
    </h2>
  );
}

type Typed = Record<string, number | undefined>;

const BodyScan = lazy(() => import("./BodyScan")); // three.js loads only when a checkup starts

/** One line of the body checkup: value with its unit, status, and the green range from src/content.ts. */
function check(label: string, key: string, v: number | null | undefined, st: Status | null, dec = 0): ScanCheck {
  const r = readings.find((x) => x.key === key)!;
  return { label, value: v == null ? null : `${v.toFixed(dec)} ${r.unit}`, status: v == null ? null : st, normal: `${r.green} ${r.unit}` };
}

function VitalsStep({ link, name, crewId, data, lastAt, onDisconnect, onRename }: { link: Link; name: string; crewId: string; data: DeviceData | null; lastAt: number; onDisconnect: () => void; onRename: () => void }) {
  const demo = link.kind === "demo";
  const [sim, setSim] = useState<Sim>({});
  const [typed, setTyped] = useState<Typed>({});
  const [log, setLog] = useState<DailyLog>(loadLog);
  const logRef = useRef(log);
  logRef.current = log;
  const setLogValue = (k: LogKey) => (v: number | null) =>
    setLog((l) => {
      const n = { ...l, [k]: v };
      saveLog(n);
      return n;
    });
  const [now, setNow] = useState(Date.now());
  const [ecg, setEcg] = useState<number[]>([]);
  const [openedAt] = useState(Date.now());
  const lastData = useRef<DeviceData | null>(null);
  const card = useRef<HoloCardHandle>(null);
  const [scanFrom, setScanFrom] = useState<{ x: number; y: number } | null>(null);
  const closeScan = useCallback(() => setScanFrom(null), []);
  const typedRef = useRef(typed);
  typedRef.current = typed;

  // Once a second: tick the clock, move the demo values, and send the daily log to the device's third screen.
  useEffect(() => {
    let tick = 0;
    const t = setInterval(() => {
      setNow(Date.now());
      if (demo) setSim((s) => stepSim(s));
      if (++tick % 2 === 0) {
        const lg = logRef.current;
        link.send({ sim: { sleep: lg.sleep, water: lg.water, exercise: lg.exercise } });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [link, demo]);

  // Keep the last 4 seconds of ECG samples, only while the electrodes are on.
  // Also remember the latest cabin readings (every 5 s) so the Hygiene page can scale its score.
  const savedCabinAt = useRef(0);
  // last real values since pairing, so the checkup still has them after the finger lifts or without electrodes
  const seen = useRef<{ hr?: number; spo2?: number; ecg?: number; ecgSim?: boolean }>({});
  useEffect(() => {
    if (!data || data === lastData.current) return;
    if (data.heartRate != null) seen.current.hr = data.heartRate;
    if (data.spo2 != null) seen.current.spo2 = data.spo2;
    if (data.ecgHeartRate != null) seen.current = { ...seen.current, ecg: data.ecgHeartRate, ecgSim: !!data.ecgSimulated && !data.leadsOn };
    lastData.current = data;
    if ((data.cabinHumidity != null || data.airQuality != null) && Date.now() - savedCabinAt.current > 5000) {
      savedCabinAt.current = Date.now();
      try {
        localStorage.setItem(
          "vitals-cabin-live",
          JSON.stringify({ humidity: data.cabinHumidity ?? null, airQuality: data.airQuality ?? null, cabinTemp: data.cabinTemp ?? null, at: Date.now(), device: link.name, demo }),
        );
      } catch {
        /* storage blocked: the Hygiene page uses the values typed in there instead */
      }
    }
    if ((data.leadsOn || data.ecgSimulated) && Array.isArray(data.ecg) && data.ecg.length) setEcg((e) => e.concat(data.ecg!.filter(Number.isFinite)).slice(-1000));
    else setEcg([]);
  }, [data]);

  const fresh = !!data && now - lastAt < 5000;
  const d = fresh ? data! : null;
  const devTag: Source = demo ? "DEMO" : "LIVE";
  const noDataYet = !data && now - openedAt > 6000;

  /** A value: from the device, else typed in, else (demo only) simulated. */
  const pick = (dev: number | null | undefined, ty: number | undefined, simV: number | undefined): { v: number | null; src: Source } =>
    dev != null ? { v: dev, src: devTag } : ty != null ? { v: ty, src: "TYPED" } : demo && simV != null ? { v: simV, src: "DEMO" } : { v: null, src: "OFF" };

  // room temperature and humidity: the sensor's DHT11 (cabinTemp / cabinHumidity)
  const room = { v: d?.cabinTemp ?? null, src: (d?.cabinTemp != null ? devTag : "OFF") as Source };
  const humidity = { v: d?.cabinHumidity ?? null, src: (d?.cabinHumidity != null ? devTag : "OFF") as Source };
  const sleep = { v: log.sleep };
  const water = { v: log.water };
  const exercise = { v: log.exercise };

  // A simulated ECG is shown, but it's not a measurement: it never counts towards your status.
  const ecgSim = !!d?.ecgSimulated && !d?.leadsOn;
  const stHr = statusOf(RANGES.heartRate, d?.heartRate);
  const stSpo2 = statusOf(RANGES.spo2, d?.spo2);
  const stEcg = ecgSim ? null : statusOf(RANGES.heartRate, d?.ecgHeartRate);
  const stRoom = statusOf(RANGES.roomTemp, room.v);
  const stHum = statusOf(RANGES.humidity, humidity.v);
  const stAir = statusOf(RANGES.airQuality, d?.airQuality);
  const stSleep = statusOf(RANGES.sleep, sleep.v);
  const stWater = statusOf(RANGES.water, water.v);
  const stEx = statusOf(RANGES.exercise, exercise.v);
  const overall: Status = [stHr, stSpo2, stEcg, stRoom, stHum, stAir, stSleep, stWater, stEx].reduce<Status | null>(worse, null) ?? "NORMAL";
  const measuredCount = [d?.heartRate, d?.spo2, ecgSim ? null : d?.ecgHeartRate, room.v, humidity.v, d?.airQuality].filter((x) => x != null).length;

  const fmt = (v: number | null | undefined, dec = 0) => (v == null ? "—" : v.toFixed(dec));
  const fingerNote = !d ? "Waiting for the sensor" : d.finger ? "Hold your finger still…" : "Place a finger on the sensor";

  const baselines = useMemo(
    () => [
      { label: "Heart", value: d?.heartRate != null ? `${d.heartRate}` : "—" },
      { label: "SpO2", value: d?.spo2 != null ? `${d.spo2}%` : "—" },
      { label: "ECG", value: d?.ecgHeartRate != null ? `${d.ecgHeartRate}` : "—" },
      { label: "Room", value: room.v != null ? `${room.v.toFixed(1)}°` : "—" },
      { label: "Humidity", value: humidity.v != null ? `${Math.round(humidity.v)}%` : "—" },
      { label: "Sleep", value: sleep.v != null ? `${sleep.v.toFixed(1)}h` : "—" },
    ],
    [d, room.v, humidity.v, sleep.v],
  );

  // Your latest real readings, saved to the browser database every 5 s so the Crew section can
  // build your card from them. A simulated ECG trace is not a reading, so it's left out.
  const myReadings = useMemo(() => {
    const r: CrewReadings = {};
    if (d?.heartRate != null) r.heart = d.heartRate;
    if (d?.spo2 != null) r.spo2 = d.spo2;
    if (d?.ecgHeartRate != null && !ecgSim) r.ecg = d.ecgHeartRate;
    if (room.v != null) r.room = +room.v.toFixed(1);
    if (humidity.v != null) r.humidity = Math.round(humidity.v);
    if (sleep.v != null) r.sleep = sleep.v;
    if (water.v != null) r.water = water.v;
    if (exercise.v != null) r.exercise = exercise.v;
    if (d?.airQuality != null) r.air = d.airQuality;
    return r;
  }, [d, ecgSim, room.v, humidity.v, sleep.v, water.v, exercise.v]);
  const hasReadings = Object.keys(myReadings).length > 0;
  const savedAt = useRef(0);
  useEffect(() => {
    if (!hasReadings || Date.now() - savedAt.current < 5000) return;
    savedAt.current = Date.now();
    saveMyReadings({ name, source: link.name, readings: myReadings, at: Date.now() }).catch(() => {});
  }, [myReadings, hasReadings, name, link.name]);
  const addToCrew = async () => {
    const at = Date.now();
    try {
      await saveMyReadings({ name, source: link.name, readings: myReadings, at });
      await putCard({ id: "self", name, role: "Crew member", crewId, readings: myReadings, kind: "self", source: link.name, updatedAt: at });
    } catch {
      /* storage blocked: the Crew section explains it */
    }
    window.location.hash = "#crew";
  };

  const Icon = KIND_ICON[link.kind];
  const num =(s: string, lo: number, hi: number) => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  const save = (key: keyof Typed, lo: number, hi: number) => (s: string) => {
    const n = num(s, lo, hi);
    if (n == null) return false;
    setTyped((t) => ({ ...t, [key]: n }));
    return true;
  };
  const clear = (key: keyof Typed) => () => setTyped((t) => ({ ...t, [key]: undefined }));
  const offNote = demo ? "" : "This sensor doesn't measure it. Type it in:";

  return (
    <div className="space-y-16">
      {/* ---------- your vital card, at the top ---------- */}
      <section className="grid items-center gap-10 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[400px]">
            <HoloCard
              ref={card}
              name={name}
              role="Crew member"
              crewId={crewId}
              mission="61:4"
              status={CARD_STATUS[overall]}
              statusNote={measuredCount ? `Live from ${link.name}.` : `Paired with ${link.name}. Waiting for readings.`}
              baselines={baselines}
              backTitle="Live readings"
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <LiquidButton size="sm" type="button" onClick={() => card.current?.flip()} className="h-9 rounded-full bg-primary/25 px-4 text-[13px] font-semibold text-white">
              Flip card
            </LiquidButton>
            <LiquidButton size="sm" type="button" onClick={onRename} className="h-9 rounded-full border border-white/15 px-4 text-[13px] font-medium text-white/80">
              Change name
            </LiquidButton>
            <RainbowButton disabled={!hasReadings} onClick={addToCrew} className="h-9 px-5 text-[13px]">
              Add to crew
            </RainbowButton>
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">Hi, {name}.</p>
          <LiquidButton
            type="button"
            onClick={(e) => setScanFrom({ x: e.clientX, y: e.clientY })}
            aria-label="Run a full-body checkup"
            className={`block h-auto w-full whitespace-normal rounded-3xl border p-6 text-left ${measuredCount ? `${STATUS_RING[overall]} ${STATUS_BG[overall]}` : "border-white/10 bg-white/[0.03]"}`}
          >
            <p className={`text-2xl font-bold ${measuredCount ? STATUS_TEXT[overall] : "text-white/70"}`}>
              {measuredCount ? (
                <span className="inline-flex items-center gap-2.5">
                  <StatusDot status={overall} /> {STATUS_WORD[overall]}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2.5">
                  <Glyph name="hourglass" className="h-6 w-6" /> Waiting for readings
                </span>
              )}
            </p>
            <p className="mt-1.5 text-white/70">
              {measuredCount === 0
                ? "No readings yet. Once the sensor sends data, your status shows here."
                : overall === "NORMAL"
                  ? "Everything we can measure is in the normal range."
                  : overall === "WATCH"
                    ? "At least one reading is in the watch range. Keep an eye on it."
                    : "At least one reading is outside both ranges. Act now and contact the flight surgeon."}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Glyph name="stethoscope" className="h-5 w-5" /> Tap for a full-body checkup
            </p>
          </LiquidButton>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[#0b0d14]/95 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{link.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/55">
                <i className={`h-1.5 w-1.5 rounded-full ${fresh ? "bg-ok" : "bg-watch"}`} />
                {!fresh ? "Paired · waiting for data…" : demo ? "Demo device · no hardware needed" : `Paired over ${KIND_LABEL[link.kind]} · receiving data`}
              </p>
            </div>
            <LiquidButton size="sm" type="button" onClick={onDisconnect} className="h-9 rounded-full border border-white/15 px-4 text-sm text-white/80 hover:border-act/60">
              Disconnect
            </LiquidButton>
          </div>
          {noDataYet && (
            <div className="rounded-2xl border border-watch/30 bg-watch/[0.07] px-5 py-4 text-sm leading-relaxed text-white/80">
              <p className="mb-1 flex items-center gap-2 font-semibold text-watch">
                <Glyph name="warning" className="h-5 w-5" /> No data from this {link.kind === "usb" ? "port" : "device"} yet
              </p>
              {link.kind === "usb" ? (
                <p>
                  Is it really the VITALS sensor? Ports like "COM1" or "Communications Port" are built into the computer and
                  never send readings. The sensor shows up as something like "USB-SERIAL CH340", "CP210x" or "USB JTAG". Also
                  close the Arduino Serial Monitor or Plotter (only one app can use the port at a time), check the firmware is
                  uploaded, and use a data USB cable, not a charge-only one. Then disconnect and pair again.
                </p>
              ) : (
                <p>Check the sensor is switched on, running the VITALS firmware, and close by. Then disconnect and pair again.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {scanFrom && (
        <Suspense fallback={null}>
          <BodyScan
            origin={scanFrom}
            onClose={closeScan}
            checks={[
              check("Heart rate", "heartRate", d?.heartRate ?? seen.current.hr, statusOf(RANGES.heartRate, d?.heartRate ?? seen.current.hr)),
              check("Blood oxygen (SpO2)", "spo2", d?.spo2 ?? seen.current.spo2, statusOf(RANGES.spo2, d?.spo2 ?? seen.current.spo2)),
              check(
                seen.current.ecgSim ? "ECG heart rate (simulated)" : "ECG heart rate",
                "heartRate",
                d?.ecgHeartRate ?? seen.current.ecg,
                statusOf(RANGES.heartRate, d?.ecgHeartRate ?? seen.current.ecg),
              ),
              check("Water", "waterIntake", water.v, stWater, 1),
              check("Sleep", "sleep", sleep.v, stSleep, 1),
              check("Exercise", "exercise", exercise.v, stEx),
              check("Room temperature", "roomTemp", room.v, stRoom, 1),
              check("Humidity", "humidity", humidity.v, stHum),
            ]}
          />
        </Suspense>
      )}

      {/* ---------- readings ---------- */}
      <section>
        <Heading icon="heartPulse">Your vitals</Heading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Reading icon="heart" label="Heart rate" value={fmt(d?.heartRate)} unit="bpm" status={stHr} source={d?.heartRate != null ? devTag : "OFF"} note={d?.heartRate != null ? "Normal is 60–100" : fingerNote} />
          <Reading icon="lungs" label="Blood oxygen (SpO2)" value={fmt(d?.spo2)} unit="%" status={stSpo2} source={d?.spo2 != null ? devTag : "OFF"} note={d?.spo2 != null ? "Normal is 95–100" : fingerNote} />
          <Reading
            icon="ecg"
            label="ECG heart rate"
            value={fmt(d?.ecgHeartRate)}
            unit="bpm"
            status={stEcg}
            source={d?.ecgHeartRate == null ? "OFF" : devTag}
            note={
              !d
                ? "Waiting for the sensor"
                : d.ecgHeartRate == null
                    ? d.leadsOn
                      ? "Finding beats…"
                      : "Electrodes off"
                    : "Normal is 60–100"
            }
          />
        </div>
      </section>

      <section>
        <Heading icon="ecg">
          ECG · last 4 seconds
          {(d?.leadsOn || ecgSim) && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[devTag]}`}>{TAG_WORD[devTag]}</span>}
        </Heading>
        <div className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-5">
          <EcgStrip
            samples={ecg}
            message={
              !d
                ? "Waiting for data from the sensor…"
                : d.leadsOn
                  ? "Electrodes attached · waiting for signal…"
                  : "Starting the ECG…"
            }
          />
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ECG_INTERVALS.map((iv) => {
              const v = d?.[iv.key] ?? null;
              const st = iv.range ? statusOf(iv.range, v) : null;
              return (
                <div key={iv.key} className="rounded-2xl border border-white/10 px-4 py-3">
                  <dt className="flex items-center justify-between gap-2 text-xs text-white/55">
                    {iv.label}
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 font-mono text-xl tabular-nums">
                    {st && <StatusDot status={st} className="!h-2 !w-2 !shadow-none" />}
                    {v != null ? v : "—"}
                    <span className="text-xs text-white/45">ms</span>
                  </dd>
                  <p className="mt-1 text-[11px] leading-snug text-white/45">Normal {iv.normal} · {iv.what}</p>
                </div>
              );
            })}
            <div className="rounded-2xl border border-white/10 px-4 py-3">
              <dt className="text-xs text-white/55">QRS axis</dt>
              <dd className="mt-1 font-mono text-xl text-white/45">—</dd>
              <p className="mt-1 text-[11px] leading-snug text-white/45">Normal −30° to +90° · needs a 12-lead ECG, can't be measured with one lead</p>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <Heading icon="satellite">Cabin air</Heading>
        <div className="grid gap-5 sm:grid-cols-3">
          <Reading
            icon="thermometer"
            label="Room temperature"
            value={fmt(room.v, 1)}
            unit="°C"
            status={stRoom}
            source={room.src}
            note={room.v != null ? "Normal is 18–33" : d ? "Room sensor (DHT11) not reporting yet" : "Waiting for the sensor"}
          />
          <Reading
            icon="drop"
            label="Humidity"
            value={fmt(humidity.v)}
            unit="%"
            status={stHum}
            source={humidity.src}
            note={humidity.v != null ? "Normal is 30–60" : d ? "Room sensor (DHT11) not reporting yet" : "Waiting for the sensor"}
          />
          <Reading
            icon="fog"
            label="Air quality"
            value={d?.airQuality != null ? `+${d.airQuality}` : "—"}
            unit="% vs clean"
            status={stAir}
            source={d?.airQuality != null ? devTag : "OFF"}
            note={!d ? "Waiting for the sensor" : d.airQuality == null ? "Sensor warming up (2 min)" : "Normal is below 20"}
          />
        </div>
      </section>

      <section>
        <Heading icon="notepad">Daily log</Heading>
        <div className="grid gap-5 sm:grid-cols-3">
          <Reading icon="moon" label="Sleep last night" value={fmt(sleep.v, 1)} unit="hrs" status={stSleep} note={sleep.v != null ? "Normal is 7–9" : "Tap + to log your sleep."}>
            <LogStepper id="sleep" label="Sleep" value={sleep.v} unit="h" range={RANGES.sleep} onChange={setLogValue("sleep")} />
          </Reading>
          <Reading icon="tap" label="Water today" value={fmt(water.v, 2)} unit="L" status={stWater} note={water.v != null ? "Normal is 2.5–3.5" : "Tap + for each glass (250 ml)."}>
            <LogStepper id="water" label="Water" value={water.v} unit="L" range={RANGES.water} onChange={setLogValue("water")} />
          </Reading>
          <Reading icon="dumbbell" label="Exercise today" value={fmt(exercise.v)} unit="min" status={stEx} note={exercise.v != null ? "Normal is 30–180" : "Tap + for every 5 minutes."}>
            <LogStepper id="exercise" label="Exercise" value={exercise.v} unit="min" range={RANGES.exercise} onChange={setLogValue("exercise")} />
          </Reading>
        </div>
      </section>

      <p className="border-t border-white/10 pt-6 text-xs leading-relaxed text-white/45">
        Prototype with hobby-grade sensors, not a medical device. "Live" values come from the paired sensor, "Demo" from
        the demo device, "Typed in" from what you entered, and the daily log is what you tap in with + and −. The ECG counts towards your
        status only with the electrodes attached. Readings the sensor doesn't measure stay empty. Room temperature and
        humidity come from the DHT11 sensor. Air quality is an MQ-135 estimate (percent
        worse than clean air), not CO2 in ppm.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export default function LivePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [typedName, setName] = useState("");
  // signed in: your account's name and crew number; otherwise the name typed in on this device
  const { profile } = useAuth();
  const name = profile?.display_name || typedName;
  const crewId = profile?.crew_id || crewIdFor(name);
  const [data, setData] = useState<DeviceData | null>(null);
  const [lastAt, setLastAt] = useState(0);
  const [notice, setNotice] = useState("");
  const linkRef = useRef<Link | null>(null);

  useEffect(() => {
    return () => {
      void linkRef.current?.close();
    };
  }, []);

  // Each step starts at the top, like a new page.
  const step = link ? (name ? "vitals" : "name") : candidate ? "confirm" : "pair";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const reset = (message = "") => {
    linkRef.current = null;
    setLink(null);
    setData(null);
    setCandidate(null);
    setName("");
    setNotice(message);
  };

  const confirm = async () => {
    if (!candidate) return;
    setConnecting(true);
    setNotice("");
    try {
      const l = await candidate.open({
        onData: (d) => {
          setData(d);
          setLastAt(Date.now());
        },
        onClose: (reason) => {
          if (linkRef.current) reset(reason === "Disconnected" ? "" : `${reason}. Pair again to continue.`);
        },
      });
      linkRef.current = l;
      setLink(l);
    } catch (e) {
      setCandidate(null);
      setNotice(`Couldn't pair: ${e instanceof Error ? e.message : "the device didn't respond"}. Check it's switched on and try again.`);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    const l = linkRef.current;
    reset();
    await l?.close();
  };

  const pick = useCallback((c: Candidate) => {
    setNotice("");
    setCandidate(c);
  }, []);

  if (link && !name) {
    return (
      <Shell eyebrow="Live monitor · step 2 of 2" title="Nice to meet you." back={{ label: "Disconnect", onClick: disconnect }}>
        <NameStep deviceName={link.name} onDone={setName} />
      </Shell>
    );
  }
  if (link) {
    return (
      <Shell eyebrow="Live monitor" title="Your vital card." back={{ label: "Back to VITALS" }}>
        <VitalsStep link={link} name={name} crewId={crewId} data={data} lastAt={lastAt} onDisconnect={disconnect} onRename={() => (profile ? (window.location.hash = "#/account") : setName(""))} />
      </Shell>
    );
  }
  if (candidate) {
    return (
      <Shell eyebrow="Live monitor · step 1 of 2" title="Confirm pairing." back={{ label: "Choose another", onClick: () => setCandidate(null) }}>
        <ConfirmStep device={candidate} connecting={connecting} onConfirm={confirm} onCancel={() => setCandidate(null)} />
      </Shell>
    );
  }
  return (
    <Shell
      eyebrow="Live monitor · step 1 of 2"
      title="Pair a VITALS device."
      intro="Bluetooth, Wi-Fi or USB cable, or the demo device. Your readings never leave this screen."
      back={{ label: "Back to VITALS" }}
    >
      <PairStep onPick={pick} notice={notice} />
    </Shell>
  );
}
