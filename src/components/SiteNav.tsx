/*
 * The floating navigation on every page: a liquid-glass dynamic action bar at the bottom of the screen.
 * Explore (every section), Health (live monitor, checkup, assistant) and You (crew card, account).
 */
import { createPortal } from "react-dom";
import { Compass, HeartPulse, UserRound } from "lucide-react";
import DynamicActionBar, { type ActionItem } from "@/components/ui/dynamic-action";
import { GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useAuth } from "@/lib/auth";
import { syncLabel, useSyncState } from "@/lib/sync";

const EXPLORE: { title: string; href: string; icon: GlyphName }[] = [
  { title: "Home", href: "#", icon: "globe" },
  { title: "Student health", href: "#crew", icon: "people" },
  { title: "Student Link", href: "#/crew-link", icon: "conjunction" },
  { title: "Classroom environment", href: "#/environment", icon: "fan" },
  { title: "Simulator", href: "#/simulator", icon: "simulator" },
  { title: "Offline support", href: "#/offline", icon: "noSignal" },
  { title: "Bones and posture", href: "#/bone", icon: "bone" },
  { title: "Isolation", href: "#/isolation", icon: "cupola" },
  { title: "Hydration", href: "#/fluid", icon: "cup" },
  { title: "School medicines", href: "#/medicine", icon: "pill" },
  { title: "Hygiene", href: "#/hygiene", icon: "soap" },
];

const HEALTH: { title: string; text: string; href: string; icon: GlyphName }[] = [
  { title: "Live monitor", text: "Pair your sensor and see your vitals.", href: "#/live", icon: "heartPulse" },
  { title: "Student Link", text: "Your class's vitals on one live board.", href: "#/crew-link", icon: "people" },
  { title: "Full-body checkup", text: "Tap your status on the live monitor.", href: "#/live", icon: "stethoscope" },
  { title: "Ask the assistant", text: "First aid and health in space, offline.", href: "#assistant", icon: "chat" },
];

const row = "flex items-center gap-3 rounded-2xl p-2 text-left transition-colors duration-300 hover:bg-white/[0.07]";

function You({ close }: { close: () => void }) {
  const { session, profile, signOut } = useAuth();
  const sync = useSyncState();
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <GlyphTile name="digitalAstronaut" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{profile?.display_name || "Student"}</p>
          <p className="font-mono text-xs tracking-wider text-white/55">{profile?.crew_id || "No student number yet"}</p>
        </div>
      </div>
      <p className="text-xs text-white/50">{syncLabel(sync)}</p>
      <div className="flex gap-2">
        <a href="#/account" onClick={close} className="flex-1">
          <LiquidButton size="sm" type="button" tabIndex={-1} className="h-9 w-full px-4 text-sm font-semibold text-white">
            Your account
          </LiquidButton>
        </a>
        {session && (
          <LiquidButton
            size="sm"
            type="button"
            onClick={() => {
              close();
              void signOut();
            }}
            className="h-9 px-4 text-sm text-white/75"
          >
            Sign out
          </LiquidButton>
        )}
      </div>
    </div>
  );
}

const ACTIONS: ActionItem[] = [
  {
    id: "explore",
    label: "Explore",
    icon: Compass,
    width: 560,
    content: (close) => (
      <nav aria-label="Sections" className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-3">
        {EXPLORE.map((e) => (
          <a key={e.title} href={e.href} onClick={close} className={row}>
            <GlyphTile name={e.icon} size="sm" />
            <span className="text-sm font-medium text-white/85">{e.title}</span>
          </a>
        ))}
      </nav>
    ),
  },
  {
    id: "health",
    label: "Health",
    icon: HeartPulse,
    width: 420,
    content: (close) => (
      <div className="space-y-1 p-3">
        {HEALTH.map((h) => (
          <a key={h.title} href={h.href} onClick={close} className={row}>
            <GlyphTile name={h.icon} tone="green" />
            <span>
              <span className="block font-semibold text-white">{h.title}</span>
              <span className="block text-sm text-white/55">{h.text}</span>
            </span>
          </a>
        ))}
      </div>
    ),
  },
  { id: "you", label: "You", icon: UserRound, width: 380, content: (close) => <You close={close} /> },
];

export default function SiteNav() {
  // portal: the page background has a CSS transform, which would pin "fixed" to the page instead of the screen
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 [body[data-immersive]_&]:hidden">
      <DynamicActionBar actions={ACTIONS} className="pointer-events-auto" />
    </div>,
    document.body,
  );
}
