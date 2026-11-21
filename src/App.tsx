import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import KineticGrid from "@/components/ui/kinetic-grid";
import Hero from "@/sections/Hero";
import Assistant from "@/sections/Assistant";
import LiveTeaser from "@/sections/LiveTeaser";
import { Crew, Mission, Modules, Readings, Team, Unique } from "@/sections/Sections";
import LivePage from "@/live/LivePage";
import HygienePage from "@/hygiene/HygienePage";
import HygieneTeaser from "@/sections/HygieneTeaser";
import EnvironmentPage from "@/environment/EnvironmentPage";
import MedicinePage from "@/medicine/MedicinePage";
import BonePage from "@/bone/BonePage";
import IsolationPage from "@/isolation/IsolationPage";
import FluidPage from "@/fluid/FluidPage";
import OfflinePage from "@/offline/OfflinePage";
import { AuthProvider, useAuth } from "@/lib/auth";
import SiteNav from "@/components/SiteNav";

// The simulator pulls in three.js, so it loads only when someone opens it.
const SimulatorPage = lazy(() => import("@/simulator/SimulatorPage"));
// Crew Link loads only when someone opens it.
const CrewLinkPage = lazy(() => import("@/crewlink/CrewLinkPage"));
// Accounts load the sign-in pages only when someone opens them.
const AccountPage = lazy(() => import("@/account/AccountPage"));
const ResetPasswordPage = lazy(() => import("@/account/ResetPasswordPage"));

/** "#/live" and "#/hygiene" open their own pages. Every other hash is a section of the main page. */
function usePage() {
  const read = () => {
    const h = window.location.hash;
    if (h.startsWith("#/live")) return "live";
    if (h.startsWith("#/hygiene")) return "hygiene";
    if (h.startsWith("#/environment")) return "environment";
    if (h.startsWith("#/medicine")) return "medicine";
    if (h.startsWith("#/bone")) return "bone";
    if (h.startsWith("#/isolation")) return "isolation";
    if (h.startsWith("#/fluid")) return "fluid";
    if (h.startsWith("#/offline")) return "offline";
    if (h.startsWith("#/simulator")) return "simulator";
    if (h.startsWith("#/crew-link")) return "crewlink";
    if (h.startsWith("#/account")) return "account";
    if (h.startsWith("#/reset-password")) return "reset";
    return "home";
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onHash = () => setPage(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return page;
}

export default function App() {
  return (
    <AuthProvider>
      <KineticGrid>
        <Pages />
      </KineticGrid>
    </AuthProvider>
  );
}

/**
 * Every page needs an account: until you're signed in and have built your crew card, the sign-in page
 * shows instead (the password-reset link is the one exception). Sign-in is remembered on each device.
 */
function Pages() {
  const page = usePage();
  const { enabled, session, profile } = useAuth();
  const calm = useReducedMotion();
  if (enabled && page !== "reset" && (!session || !profile?.onboarded)) {
    return (
      <Suspense fallback={<p className="p-12 text-sm text-white/60">Loading…</p>}>
        <AccountPage />
      </Suspense>
    );
  }
  // each page fades and rises in as the last one sinks away; reduced motion gets a plain fade
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          initial={{ opacity: 0, y: calm ? 0 : 16 }}
          animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 30 } }}
          exit={{ opacity: 0, y: calm ? 0 : -10, transition: { duration: 0.16 } }}
        >
      {page === "live" ? (
        <LivePage />
      ) : page === "hygiene" ? (
        <HygienePage />
      ) : page === "environment" ? (
        <EnvironmentPage />
      ) : page === "medicine" ? (
        <MedicinePage />
      ) : page === "bone" ? (
        <BonePage />
      ) : page === "isolation" ? (
        <IsolationPage />
      ) : page === "fluid" ? (
        <FluidPage />
      ) : page === "offline" ? (
        <OfflinePage />
      ) : page === "account" || page === "reset" ? (
        <Suspense fallback={<p className="p-12 text-sm text-white/60">Loading…</p>}>{page === "account" ? <AccountPage /> : <ResetPasswordPage />}</Suspense>
      ) : page === "crewlink" ? (
        <Suspense fallback={<p className="p-12 text-sm text-white/60">Linking to your class…</p>}>
          <CrewLinkPage />
        </Suspense>
      ) : page === "simulator" ? (
        <Suspense fallback={<p className="p-12 font-mono text-sm text-cyan-200/70">Loading the simulator…</p>}>
          <SimulatorPage />
        </Suspense>
      ) : (
        <main>
          <Hero />
          <Modules />
          <Readings />
          <Assistant />
          <LiveTeaser />
          <HygieneTeaser />
          <Mission />
          <Crew />
          <Unique />
          <Team />
        </main>
      )}
        </motion.div>
      </AnimatePresence>
      {page !== "reset" && (
        <>
          {/* room for the floating nav, so it never covers the end of a page */}
          <div className="h-24" aria-hidden="true" />
          <SiteNav />
        </>
      )}
    </>
  );
}
