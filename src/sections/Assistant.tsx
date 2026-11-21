import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { AlertTriangle, ArrowUp, Square, Volume2, VolumeX } from "lucide-react";
import { getTts, speakText, stopSpeaking, subscribeTts } from "@/lib/tts";
import { Glyph, GlyphTile, type GlyphName, type GlyphTone } from "@/components/ui/glyph";
import {
  answer,
  FOLLOW_UPS,
  isExplainQuestion,
  isGeneralQuestion,
  SUGGESTIONS,
  TOPIC_FACT,
  TOPIC_TALK,
  type AskOption,
  type Reply,
} from "@/lib/firstAid";
import { PASSAGES, searchKnowledge, STRONG_SCORE, type Hit, type Passage } from "@/lib/knowledge";
import { aiModel, askAI, askCloud, cloudAvailable, type Turn } from "@/lib/ai";

/**
 * What a chat panel covers. The main assistant covers everything; the hygiene assistant
 * only answers from hygiene passages and hygiene-related first-aid topics. Red flags
 * (chest pain, trouble breathing…) are always answered, whatever the scope.
 */
export type ChatScope = {
  name: string;
  inputId: string;
  placeholder: string;
  hello: ReactNode;
  suggestions: string[];
  followUps: string[];
  unknownText: string;
  /** Which knowledge passages this chat may use. All when left out. */
  library?: (p: Passage) => boolean;
  /** Which first-aid topics (by id) this chat may use. All when left out. */
  topics?: string[];
  /** This assistant's reply to "hi" / "hello", so it introduces itself rather than the main assistant. */
  greet?: string;
  /** Colour theme and avatar glyph of the chat panel. */
  tone?: GlyphTone;
  avatar?: GlyphName;
};

export const MAIN_SCOPE: ChatScope = {
  name: "VITALS assistant",
  tone: "sky",
  avatar: "bot",
  inputId: "assistant-input",
  placeholder: "Describe an injury or ask a question…",
  hello: (
    <>
      Hi, I'm the VITALS assistant. Tell me what happened or where it hurts, for example "I cut my finger", or ask me
      about health in space, like "why is my face puffy?" or "why do I see flashes of light?". I give general first aid
      and information, not a diagnosis.
    </>
  ),
  suggestions: SUGGESTIONS,
  followUps: FOLLOW_UPS,
  unknownText:
    "I'm not sure I understood, and I don't have that in my library yet. Where does it hurt, or how do you feel? Pick one below or tell me in a few words. If it's serious or you're unsure, tell the commander and contact the flight surgeon.",
};

type Msg =
  | { id: number; from: "you"; text: string }
  /** `cloud`: the online model's reply ("" while it's writing) */
  | { id: number; from: "bot"; reply?: Reply; library?: Hit[]; ai?: string; thinking?: boolean; cloud?: string };

const HELLO: Msg = { id: 0, from: "bot" };

/** What the latest bot message lets you do next. Only the latest message's buttons are live. */
type Actions = {
  ask: (text: string) => void;
  choose: (topicTitle: string, option: AskOption) => void;
};

function Chips({ items, onPick, tone = "primary" }: { items: string[]; onPick: (s: string) => void; tone?: "primary" | "muted" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((f) => (
        <LiquidButton size="sm"
          key={f}
          type="button"
          onClick={() => onPick(f)}
          className={`h-auto min-h-8 whitespace-normal rounded-full border px-3 py-1.5 text-left text-xs transition-colors ${
            tone === "primary"
              ? "border-primary/40 bg-primary/10 text-white/85 hover:border-primary hover:text-white"
              : "border-white/15 bg-white/[0.03] text-white/75 hover:border-primary/60 hover:text-white"
          }`}
        >
          {f}
        </LiquidButton>
      ))}
    </div>
  );
}

/** Other questions the library can answer that relate to this one: the next hits, then more from the same file. */
function relatedQuestions(hits: Hit[], scope: ChatScope): string[] {
  const shown = hits[0];
  const out = hits.slice(1, 3).map((h) => h.heading);
  for (const p of PASSAGES) {
    if (out.length >= 3) break;
    if (scope.library && !scope.library(p)) continue;
    if (p.title === shown.title && p.id !== shown.id && !out.includes(p.heading)) out.push(p.heading);
  }
  return out;
}

function LibraryAnswer({ hits, actions, scope, ai, thinking }: { hits: Hit[]; actions?: Actions; scope: ChatScope; ai?: string; thinking?: boolean }) {
  const h = hits[0];
  const related = relatedQuestions(hits, scope);
  return (
    <div className="space-y-3">
      {ai ? (
        <>
          <p className="whitespace-pre-line">{ai}</p>
          <p data-no-say className="flex items-center gap-1.5 text-[11px] text-white/40">
            <Glyph name="bot" className="h-3.5 w-3.5" /> Onboard AI, from the library: {h.heading}
          </p>
          <details data-no-say className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/70">
            <summary className="cursor-pointer select-none text-xs text-white/55">Read the library passage</summary>
            <p className="mt-2">{h.text}</p>
            <p className="mt-1.5 text-[11px] text-white/40">
              Source: {h.title} · {h.source}
            </p>
          </details>
        </>
      ) : (
        <>
          <p className="font-semibold text-white">{h.heading}</p>
          <p>{h.text}</p>
          <p data-no-say className="text-[11px] text-white/40">
            Source: {h.title} · {h.source}
          </p>
          {thinking && (
            <p data-no-say className="flex items-center gap-1.5 text-[11px] text-sky-300/80" aria-live="polite">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" /> Onboard AI is writing a reply…
            </p>
          )}
        </>
      )}
      {actions && related.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/90">You might also want to know</p>
          <Chips items={related} onPick={actions.ask} tone="muted" />
        </div>
      )}
    </div>
  );
}

/** Light Markdown from the online model: paragraphs, "- " bullet lists and **bold**. Built as elements, never as HTML. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong> : p));
  const BULLET = /^\s*([-*•]|\d+[.)])\s+/;
  // consecutive lines of the same kind form one block: a paragraph, or a list (a paragraph can lead into a list)
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const l = raw.trim();
    if (!l) {
      groups.push({ list: false, lines: [] });
      continue;
    }
    const list = BULLET.test(l);
    const g = groups[groups.length - 1];
    if (g && g.list === list && g.lines.length) g.lines.push(l);
    else groups.push({ list, lines: [l] });
  }
  return (
    <div className="space-y-2.5">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.list ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {g.lines.map((l, j) => <li key={j}>{inline(l.replace(BULLET, ""))}</li>)}
            </ul>
          ) : (
            <p key={i}>{inline(g.lines.join(" ").replace(/^#+\s*/, ""))}</p>
          ),
        )}
    </div>
  );
}

/** The online model's answer, with the library passages it drew on one click away. */
function CloudAnswer({ text, hits }: { text: string; hits: Hit[] }) {
  if (!text)
    return (
      <p className="flex items-center gap-1.5 text-white/60" aria-live="polite">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:300ms]" />
        <span className="sr-only">Writing a reply…</span>
      </p>
    );
  return (
    <div className="space-y-3">
      <Rich text={text} />
      {hits.length > 0 && (
        <details data-no-say className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/70">
          <summary className="cursor-pointer select-none text-xs text-white/55">From the library</summary>
          <ul className="mt-2 space-y-1.5">
            {hits.map((h) => (
              <li key={h.id}>
                <span className="font-semibold text-white/80">{h.heading}</span>
                <span className="block text-[11px] text-white/40">
                  {h.title} · {h.source}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BotReply({ reply, library = [], actions, scope, ai, thinking, cloud }: { reply?: Reply; library?: Hit[]; actions?: Actions; scope: ChatScope; ai?: string; thinking?: boolean; cloud?: string }) {
  if (cloud !== undefined) return <CloudAnswer text={cloud} hits={library} />;
  if (!reply) return <p>{scope.hello}</p>;
  if (reply.kind === "chat") return <p>{reply.text}</p>;
  if (reply.kind === "followup") {
    return (
      <div className="space-y-2">
        {reply.urgent && (
          <p className="flex items-center gap-2 font-semibold text-act">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Get help now
          </p>
        )}
        <p>{reply.text}</p>
      </div>
    );
  }
  if (reply.kind === "unknown") {
    if (library.length) return <LibraryAnswer hits={library} actions={actions} scope={scope} ai={ai} thinking={thinking} />;
    return (
      <div className="space-y-3">
        <p>{scope.unknownText}</p>
        {actions && <Chips items={scope.followUps} onPick={actions.ask} />}
      </div>
    );
  }
  if (reply.kind === "urgent") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-act">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {reply.title}
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          {reply.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    );
  }

  // First-aid advice: opener, steps, when to get help, a follow-up question, and a related fact.
  const talk = TOPIC_TALK[reply.topics[0].id];
  return (
    <div className="space-y-5">
      {talk && <p>{talk.intro}</p>}
      {reply.topics.map((t) => (
        <div key={t.id} className="space-y-3">
          <p className="font-semibold text-white">{t.title}</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            {t.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {t.spaceNote && <p className="text-sky-200/80">In space: {t.spaceNote}</p>}
          <div className="rounded-lg border border-watch/25 bg-watch/[0.06] px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-watch">
              Contact the flight surgeon if
            </p>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
              {t.getHelp.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {library.length > 0 && (
        <div className="space-y-1.5 border-t border-white/10 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/90">Did you know?</p>
          <p className="font-semibold text-white">{library[0].heading}</p>
          <p>{library[0].text}</p>
          <p className="text-[11px] text-white/40">
            Source: {library[0].title} · {library[0].source}
          </p>
        </div>
      )}
      {talk?.ask && actions && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="font-medium text-white">{talk.ask.q}</p>
          <div className="flex flex-wrap gap-2">
            {talk.ask.options.map((o) => (
              <LiquidButton size="sm"
                key={o.label}
                type="button"
                onClick={() => actions.choose(reply.topics[0].title, o)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  o.urgent
                    ? "border-act/40 bg-act/10 text-white/90 hover:border-act"
                    : "border-primary/40 bg-primary/10 text-white/85 hover:border-primary hover:text-white"
                }`}
              >
                {o.label}
              </LiquidButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The chat box itself: messages, suggestions and input, answering within its scope. */
const ABOUT_ME = /\b(am i (ok|okay|healthy|fine|well|alright)|how am i( doing)?|my (vitals|readings|status|results|health|check ?up|heart rate|pulse|spo2|oxygen( level)?|sleep|water|exercise|room temp\w*|humidity)|check ?up|verdict)\b/i;
const READING_WORDS: Record<string, RegExp> = {
  "Heart rate": /heart|pulse|bpm/i,
  "Blood oxygen (SpO2)": /spo2|oxygen/i,
  Water: /water|drink|hydrat/i,
  Sleep: /sleep/i,
  Exercise: /exercis|workout/i,
  "Room temperature": /room|temp/i,
  Humidity: /humid/i,
};
type SavedCheckup = { at: number; verdict: "NORMAL" | "WATCH" | "ACT" | null; checks: { label: string; value: string | null; status: "NORMAL" | "WATCH" | "ACT" | null; normal: string }[] };

/** "Am I healthy?", "what's my heart rate?": answered from the last full-body checkup on the Live page (no AI, no made-up numbers). */
export function checkupAnswer(t: string, saved: SavedCheckup | null): string | null {
  if (!ABOUT_ME.test(t)) return null;
  if (!saved) return "I don't have your readings yet. Open the Live monitor, tap your status for a full-body checkup, then ask me again.";
  const mins = Math.round((Date.now() - saved.at) / 60000);
  const when = mins < 1 ? "just now" : mins < 120 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  const word = { NORMAL: "normal", WATCH: "in the watch range", ACT: "outside the safe range" };
  const line = (c: SavedCheckup["checks"][number]) => (c.value && c.status ? `${c.label} ${c.value}, ${word[c.status]} (target ${c.normal})` : `${c.label} not measured`);
  const asked = saved.checks.filter((c) => READING_WORDS[c.label]?.test(t));
  if (asked.length) return `From your checkup ${when}: ${asked.map(line).join("; ")}.`;
  const verdict = { NORMAL: "you look healthy", WATCH: "keep an eye on a few things", ACT: "act now and contact the flight surgeon" };
  const flagged = saved.checks.filter((c) => c.status && c.status !== "NORMAL");
  if (!saved.verdict) return `Your checkup ${when} had no readings. Connect the sensor or fill in the daily log, then check again.`;
  return `From your checkup ${when}: ${verdict[saved.verdict]}.${flagged.length ? ` ${flagged.map(line).join("; ")}.` : " Everything measured is in the normal range."}`;
}

function loadCheckup(): SavedCheckup | null {
  try {
    return JSON.parse(localStorage.getItem("vitals-checkup") ?? "null");
  } catch {
    return null;
  }
}

/** What an answer bubble says: its text without buttons or screen-only notes (marked data-no-say). */
const bubbleText = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>("button, [data-no-say]")].reduce((t, b) => t.replace(b.innerText, ""), el.innerText);

const READ_ALOUD_KEY = "vitals-read-aloud";
function loadReadAloud() {
  try {
    return localStorage.getItem(READ_ALOUD_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reads one answer aloud (offline voices, src/lib/tts.ts); press again to stop. */
function SpeakButton({ id, bot }: { id: string; bot: string }) {
  const tts = useSyncExternalStore(subscribeTts, getTts);
  const mine = tts.id === id;
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <LiquidButton
      distort={false}
      size="sm"
      type="button"
      aria-pressed={mine}
      onClick={(e) => {
        if (mine) return stopSpeaking();
        const bubble = e.currentTarget.closest("[data-bot]")?.querySelector<HTMLElement>("[data-say]");
        if (bubble) void speakText(id, bubbleText(bubble), bot);
      }}
      className={`mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors ${mine ? "text-sky-200" : "text-white/55 hover:text-white"}`}
      >
        {mine ? <Square className="h-3 w-3" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {mine ? "Stop" : "Text To Speech"}
      </LiquidButton>
    </span>
  );
}

export function ChatPanel({ scope }: { scope: ChatScope }) {
  useEffect(() => {
    return stopSpeaking; // leaving the page stops any answer being read
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const [aiOn, setAiOn] = useState(false);
  const aiHistory = useRef<{ q: string; a: string }[]>([]);
  useEffect(() => {
    aiModel().then((m) => setAiOn(!!m));
  }, []);
  // online conversation (src/lib/ai.ts askCloud): used whenever it's reachable, remembering the last turns
  const [cloudOn, setCloudOn] = useState(false);
  const conversation = useRef<Turn[]>([]);
  useEffect(() => {
    void cloudAvailable().then(setCloudOn);
  }, []);

  // Read aloud: when on, every new answer is spoken as soon as it shows; if the onboard AI then replaces it
  // with its own reply, that reply is read too. Off stops it at once. Remembered for all chatbots on this device.
  const [readAloud, setReadAloud] = useState(loadReadAloud);
  const spokenKey = useRef<string | null>(null);
  const answerKey = (m: Msg) => `${m.id}:${m.from === "bot" && m.cloud ? "cloud" : m.from === "bot" && m.ai ? "ai" : "lib"}`;
  const toggleReadAloud = () => {
    const on = !readAloud;
    setReadAloud(on);
    try {
      localStorage.setItem(READ_ALOUD_KEY, on ? "1" : "0");
    } catch {
      /* storage blocked: the switch lasts for this visit only */
    }
    if (on) spokenKey.current = answerKey(msgs[msgs.length - 1]); // read answers from now on, not the one already shown
    else stopSpeaking();
  };
  useEffect(() => {
    const last = msgs[msgs.length - 1];
    if (!readAloud || last.from !== "bot" || last.cloud === "" || spokenKey.current === answerKey(last)) return;
    spokenKey.current = answerKey(last);
    const bubbles = listRef.current?.querySelectorAll<HTMLElement>("[data-say]");
    const el = bubbles?.[bubbles.length - 1];
    if (el) void speakText(`${scope.inputId}-${last.id}`, bubbleText(el), scope.inputId);
  }, [msgs, readAloud, scope.inputId]);

  // Bring your latest message to the top of the chat, so the start of the answer is in view.
  const lastYou = msgs.filter((m) => m.from === "you").length;
  useEffect(() => {
    const el = listRef.current;
    if (!el || lastYou === 0) return;
    const mine = el.querySelectorAll<HTMLElement>("[data-you]");
    const last = mine[mine.length - 1];
    if (last) el.scrollTo({ top: last.offsetTop - 12, behavior: "smooth" });
  }, [lastYou]);

  const push = (you: string, reply: Reply, library: Hit[] = []) =>
    setMsgs((m) => [
      ...m,
      { id: nextId.current++, from: "you", text: you },
      { id: nextId.current++, from: "bot", reply, library },
    ]);

  /** Shows the library answer at once, then asks the onboard AI to answer from it. */
  const pushLibrary = (you: string, hits: Hit[]) => {
    const botId = nextId.current + 1;
    setMsgs((m) => [
      ...m,
      { id: nextId.current++, from: "you", text: you },
      { id: nextId.current++, from: "bot", reply: { kind: "unknown" }, library: hits, thinking: aiOn },
    ]);
    // ask even if the first check missed it: Ollama may have started since (askAI re-checks)
    askAI(you, hits, scope.name, aiHistory.current).then((a) => {
      if (a) aiHistory.current = [...aiHistory.current, { q: `Facts: ${hits[0].heading} ${hits[0].text}
Question: ${you}`, a }].slice(-2);
      setMsgs((m) => m.map((x) => (x.id === botId && x.from === "bot" ? { ...x, ai: a ?? undefined, thinking: false } : x)));
      aiModel().then((found) => setAiOn(!!found));
    });
  };

  /** If the last message asked a follow-up question, see whether the typed text answers it ("yes", "no", "first few days"). */
  const typedAnswer = (t: string): { title: string; option: AskOption } | null => {
    const last = msgs[msgs.length - 1];
    if (last.from !== "bot" || last.reply?.kind !== "advice") return null;
    const topic = last.reply.topics[0];
    const ask = TOPIC_TALK[topic.id]?.ask;
    if (!ask) return null;
    const s = t.toLowerCase().replace(/[^a-z0-9 °]+/g, " ").trim();
    const yes = /^(yes|yeah|yep|yup|y|it is|i did|correct)\b/.test(s);
    const no = /^(no|nope|nah|n|not really|i didn t|it isn t)\b/.test(s);
    const option =
      (yes && ask.options.find((o) => /^yes/i.test(o.label))) ||
      (no && ask.options.find((o) => /^no/i.test(o.label))) ||
      ask.options.find((o) => {
        const label = o.label.toLowerCase().replace(/[^a-z0-9 °]+/g, " ").trim();
        return s === label || (s.length > 3 && label.includes(s)) || (label.length > 3 && s.includes(label));
      });
    return option ? { title: topic.title, option } : null;
  };

  /** The last checkup, in a line the online model can use for "how are my readings?" questions. */
  const checkupLine = () => {
    const c = loadCheckup();
    if (!c) return "";
    const ago = Math.round((Date.now() - c.at) / 60000);
    return `Overall ${c.verdict ?? "unknown"}, ${ago < 120 ? `${ago} minutes` : `${Math.round(ago / 60)} hours`} ago. ` + c.checks.map((x) => `${x.label}: ${x.value ?? "no reading"} (${x.status ?? "not checked"}, normal ${x.normal})`).join("; ");
  };

  /** Online: a real conversation with the model, grounded in this chatbot's library. Falls back offline if it fails. */
  const sendCloud = async (t: string) => {
    const hits = searchKnowledge(t, 3, scope.library);
    const youId = nextId.current++;
    const botId = nextId.current++;
    setMsgs((m) => [...m, { id: youId, from: "you", text: t }, { id: botId, from: "bot", cloud: "" }]);
    const turns: Turn[] = [...conversation.current, { role: "user", content: t }];
    const reply = await askCloud(scope.inputId, turns, hits, checkupLine());
    if (!reply) {
      setCloudOn(false);
      setMsgs((m) => m.filter((x) => x.id !== youId && x.id !== botId));
      sendLocal(t);
      return;
    }
    conversation.current = [...turns, { role: "assistant" as const, content: reply }].slice(-12);
    setMsgs((m) => m.map((x) => (x.id === botId && x.from === "bot" ? { ...x, cloud: reply, library: hits } : x)));
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setDraft("");
    // emergencies always get the fixed first-aid steps at once, never model text
    if (cloudOn && answer(t).kind !== "urgent") void sendCloud(t);
    else sendLocal(t);
  };

  /** Offline: the library, first-aid rules and (on this PC) the onboard AI. */
  const sendLocal = (t: string) => {
    const picked = typedAnswer(t);
    if (picked) {
      push(t, { kind: "followup", title: picked.title, text: picked.option.say, urgent: picked.option.urgent });
      return;
    }
    let reply = answer(t);
    // Questions about your own readings use your last checkup. Symptoms and emergencies keep the first-aid path.
    if (reply.kind !== "urgent" && reply.kind !== "advice") {
      const mine = checkupAnswer(t, loadCheckup());
      if (mine) {
        push(t, { kind: "chat", text: mine });
        return;
      }
    }
    if (reply.kind === "chat" && scope.greet && /^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening))\b/i.test(t)) {
      reply = { kind: "chat", text: scope.greet };
    }
    // A scoped chat only uses its own first-aid topics (red flags always pass through).
    if (scope.topics && reply.kind === "advice") {
      const allowed = reply.topics.filter((x) => scope.topics!.includes(x.id));
      reply = allowed.length ? { kind: "advice", topics: allowed } : { kind: "unknown" };
    }
    const found = reply.kind === "chat" ? [] : searchKnowledge(t, 3, scope.library);
    // A general question ("why do astronauts faint after landing?") with a strong library
    // answer gets that answer. Anything about "I" or "my" stays on the first-aid path.
    if (isGeneralQuestion(t) && found[0]?.score >= STRONG_SCORE && (reply.kind === "urgent" || reply.kind === "advice")) {
      pushLibrary(t, found);
      return;
    }
    if (reply.kind === "urgent") {
      push(t, reply);
      return;
    }
    // "Why do I see flashes of light when I close my eyes?": an explanation question with a
    // very strong library answer gets the explanation rather than first-aid steps.
    if (reply.kind === "advice" && isExplainQuestion(t) && found[0]?.score >= STRONG_SCORE * 1.5) {
      pushLibrary(t, found);
      return;
    }
    if (reply.kind === "advice") {
      // Under first-aid steps, show the topic's hand-picked "Did you know?" fact.
      const heading = TOPIC_FACT[reply.topics[0].id];
      const fact = PASSAGES.find((p) => p.heading === heading);
      push(t, reply, fact ? [{ ...fact, score: 0 }] : []);
      return;
    }
    if (reply.kind === "unknown" && found.length) {
      pushLibrary(t, found);
      return;
    }
    push(t, reply, found);
  };

  const actions: Actions = {
    ask: send,
    choose: (title, o) => push(o.label, { kind: "followup", title, text: o.say, urgent: o.urgent }),
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const th = THEME[scope.tone ?? "sky"];
  const avatar = scope.avatar ?? "bot";

  return (
    <div className={`relative flex h-[640px] min-w-0 max-h-[82svh] flex-col overflow-hidden rounded-3xl border bg-[#ffffff]/95 shadow-2xl shadow-black/60 ${th.border}`}>
      {/* soft glow behind the header */}
      <div className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-[80%] -translate-x-1/2 rounded-full blur-3xl ${th.glow}`} aria-hidden="true" />

      <div className={`relative flex items-center gap-3 border-b border-white/10 bg-gradient-to-b to-transparent px-5 py-4 ${th.header}`}>
        <GlyphTile name={avatar} tone={scope.tone ?? "sky"} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{scope.name}</p>
        </div>
        <LiquidButton
          distort={false}
          size="sm"
          type="button"
          role="switch"
          aria-checked={readAloud}
          onClick={toggleReadAloud}
          title={readAloud ? "Answers are read aloud. Click to turn off." : "Click to have every answer read aloud."}
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${readAloud ? "bg-sky-400/20 text-sky-100" : "text-white/55 hover:text-white"}`}
        >
          {readAloud ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
          Read aloud: {readAloud ? "On" : "Off"}
        </LiquidButton>
      </div>

      <div ref={listRef} className="relative flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5" role="log" aria-live="polite">
        {msgs.map((m, i) =>
          m.from === "you" ? (
            <div key={m.id} data-you className="flex justify-end">
              <p className={`max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium shadow-lg ${th.you}`}>{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2.5">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ring-inset ${th.mini}`} aria-hidden="true">
                <Glyph name={avatar} className="h-4 w-4" />
              </span>
              <div data-bot className="min-w-0 max-w-[88%]">
                <div
                  data-say
                  className={`rounded-2xl rounded-tl-md border px-4 py-3.5 text-sm leading-relaxed text-white/85 ${
                    m.reply?.kind === "urgent" || (m.reply?.kind === "followup" && m.reply.urgent)
                      ? "border-act/40 bg-act/[0.08]"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <BotReply reply={m.reply} library={m.library} ai={m.ai} thinking={m.thinking} cloud={m.cloud} actions={i === msgs.length - 1 ? actions : undefined} scope={scope} />
                </div>
                <SpeakButton id={`${scope.inputId}-${m.id}`} bot={scope.inputId} />
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-white/10 bg-black/20 px-4 pb-4 pt-3">
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {scope.suggestions.map((s) => (
            <LiquidButton size="sm"
              key={s}
              type="button"
              onClick={() => send(s)}
              className={`shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition-colors hover:text-white ${th.chip}`}
            >
              {s}
            </LiquidButton>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor={scope.inputId} className="sr-only">
            {scope.placeholder}
          </label>
          <input
            id={scope.inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={scope.placeholder}
            autoComplete="off"
            className={`h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/40 focus:outline-none ${th.focus}`}
          />
          <LiquidButton size="sm"
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full p-0 transition-[opacity,transform] active:scale-95 disabled:opacity-40 ${th.send}`}
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </LiquidButton>
        </form>
      </div>
    </div>
  );
}

/* Colour themes for the chat panels, one per assistant. */
const THEME: Record<GlyphTone, { border: string; glow: string; header: string; you: string; mini: string; chip: string; focus: string; send: string }> = {
  sky: { border: "border-sky-300/15", glow: "bg-sky-500/15", header: "from-sky-400/[0.08]", you: "bg-sky-400 text-[#ffffff]", mini: "bg-sky-400/10 text-sky-300 ring-sky-300/25", chip: "hover:border-sky-300/60", focus: "focus:border-sky-300/70", send: "bg-sky-400/30 text-white" },
  violet: { border: "border-violet-300/15", glow: "bg-violet-500/15", header: "from-violet-400/[0.08]", you: "bg-violet-400 text-[#ffffff]", mini: "bg-violet-400/10 text-violet-300 ring-violet-300/25", chip: "hover:border-violet-300/60", focus: "focus:border-violet-300/70", send: "bg-violet-400/30 text-white" },
  emerald: { border: "border-teal-300/15", glow: "bg-teal-500/15", header: "from-teal-400/[0.08]", you: "bg-teal-400 text-[#ffffff]", mini: "bg-teal-400/10 text-teal-300 ring-teal-300/25", chip: "hover:border-teal-300/60", focus: "focus:border-teal-300/70", send: "bg-teal-400/30 text-white" },
  amber: { border: "border-amber-300/15", glow: "bg-amber-500/15", header: "from-amber-400/[0.08]", you: "bg-amber-400 text-[#ffffff]", mini: "bg-amber-400/10 text-amber-300 ring-amber-300/25", chip: "hover:border-amber-300/60", focus: "focus:border-amber-300/70", send: "bg-amber-400/30 text-white" },
  red: { border: "border-rose-300/15", glow: "bg-rose-500/15", header: "from-rose-400/[0.08]", you: "bg-rose-400 text-[#ffffff]", mini: "bg-rose-400/10 text-rose-300 ring-rose-300/25", chip: "hover:border-rose-300/60", focus: "focus:border-rose-300/70", send: "bg-rose-400/30 text-white" },
  green: { border: "border-emerald-300/15", glow: "bg-emerald-500/15", header: "from-emerald-400/[0.08]", you: "bg-emerald-400 text-[#ffffff]", mini: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25", chip: "hover:border-emerald-300/60", focus: "focus:border-emerald-300/70", send: "bg-emerald-400/30 text-white" },
};

export default function Assistant() {
  return (
    <section id="assistant" className="relative scroll-mt-6 px-6 py-28 sm:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-sky-300">Health intelligence</p>
          <h2 className="mb-5 max-w-[16ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Hurt? Tell the assistant.
          </h2>
          <p className="mb-8 max-w-[46ch] leading-relaxed text-white/65">
            Say what happened. Get first-aid steps, a follow-up question, and when to call the flight surgeon.
          </p>
        </div>
        <ChatPanel scope={MAIN_SCOPE} />
      </div>
    </section>
  );
}
