/*
 * Set a new password (#/reset-password). Opens from the link in the password-reset email.
 * It only lets you change the password while that reset link's session is valid: the link must
 * have been opened (the ?reset=1 marker) and Supabase must have turned it into a session in this
 * browser. Otherwise it asks for a new link.
 */
import { useState } from "react";
import { Shell } from "@/live/LivePage";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { supabase } from "@/lib/supabase";
import { endRecovery, friendlyError, useAuth } from "@/lib/auth";
import { ShinyButton } from "@/components/ui/shiny-button";

const field =
  "h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm text-white placeholder:text-white/35 focus:border-sky-300/70 focus:outline-none";

export default function ResetPasswordPage() {
  const { loading, session, recovering } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg("Use at least 8 characters.");
    if (pw !== pw2) return setMsg("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(friendlyError(error.message));
    endRecovery();
    setDone(true);
  };

  const valid = !!session && recovering;

  return (
    <Shell eyebrow="Account" title="Set a new password." back={{ label: "Back to VITALS" }}>
      <div className="max-w-md rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7">
        {loading ? (
          <p className="text-white/60">Checking your reset link…</p>
        ) : done ? (
          <div className="space-y-5">
            <p role="status" className="text-emerald-300">
              Your password has been changed.
            </p>
            <LiquidButton type="button" onClick={() => (window.location.hash = "#/account")} className="h-11 w-full bg-sky-400/20 font-semibold text-white">
              Go to my account
            </LiquidButton>
          </div>
        ) : !valid ? (
          <div className="space-y-5">
            <p className="text-white/75">
              This reset link has expired, was already used, or was opened in a different browser from the one that asked for it. Please ask for a new one.
            </p>
            <LiquidButton type="button" onClick={() => (window.location.hash = "#/account")} className="h-11 w-full bg-sky-400/20 font-semibold text-white">
              Ask for a new link
            </LiquidButton>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <p className="text-sm text-white/60">Signed in from your reset link as {session?.user.email}.</p>
            <label className="block text-sm text-white/70">
              New password
              <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${field} mt-1.5`} />
            </label>
            <label className="block text-sm text-white/70">
              Confirm new password
              <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${field} mt-1.5`} />
            </label>
            {msg && (
              <p role="alert" className="text-sm text-rose-300">
                {msg}
              </p>
            )}
            <ShinyButton type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Saving…" : "Save new password"}
            </ShinyButton>
          </form>
        )}
      </div>
    </Shell>
  );
}
