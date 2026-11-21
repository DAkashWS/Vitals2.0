/*
 * Sign-in card, from the HextaUI "modern stunning sign in" component (21st.dev), adapted for VITALS:
 *   - three modes in one card: sign in, create account, and forgot password
 *   - real callbacks instead of a demo alert; the parent connects them to Supabase
 *   - VITALS logo and a local Google logo instead of images loaded from 21st.dev, so it works offline
 *   - the real Mission 61:4 team under the card instead of stock avatars and "thousands of developers"
 *   - liquid glass buttons, labelled inputs, and errors read out to screen readers
 */
import * as React from "react";
import { HeartPulse } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { ShinyButton } from "@/components/ui/shiny-button";

export type SignInMode = "signin" | "signup" | "forgot";

type Props = {
  mode: SignInMode;
  onModeChange: (m: SignInMode) => void;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (name: string, email: string, password: string) => Promise<string | null>;
  onForgot: (email: string) => Promise<string | null>;
  /** leave out to hide the Google button (e.g. while Google sign-in is switched off) */
  onGoogle?: () => Promise<string | null>;
  /** called as you type your name on the sign-up form (for a live card preview) */
  onNameChange?: (name: string) => void;
  /** a success message to show (e.g. "Check your email") */
  notice?: string;
  className?: string;
};


/** Google "G" mark, drawn locally so sign-in works with no internet for images. */
function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const SignIn1 = ({ mode, onModeChange, onSignIn, onSignUp, onForgot, onGoogle, notice, onNameChange, className = "" }: Props) => {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setError("");
  }, [mode]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError("");
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) return setError("Please enter a valid email address.");
    if (mode === "forgot") return run(() => onForgot(email.trim()));
    if (!password) return setError("Please enter your password.");
    if (mode === "signin") return run(() => onSignIn(email.trim(), password));
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The two passwords don't match.");
    return run(() => onSignUp(name.trim(), email.trim(), password));
  };

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const field =
    "w-full rounded-xl bg-white/10 px-5 py-3 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300/70";

  return (
    <div className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl py-10 ${className}`}>
      {/* centred glass card */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl bg-gradient-to-r from-[#ffffff] to-[#fff1f1] p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 shadow-lg">
          <HeartPulse className="h-6 w-6 text-white" strokeWidth={2.4} aria-hidden="true" />
        </div>
        <h2 className="mb-1 text-center text-2xl font-semibold text-white">VITALS</h2>
        <p className="mb-6 text-center text-sm text-white/60">{title}</p>

        <form className="flex w-full flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex w-full flex-col gap-3">
            {mode === "signup" && (
              <>
                <label htmlFor="auth-name" className="sr-only">
                  Your name
                </label>
                <input id="auth-name" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => {
                    setName(e.target.value);
                    onNameChange?.(e.target.value);
                  }}
                  className={field}
                />
              </>
            )}
            <label htmlFor="auth-email" className="sr-only">
              Email
            </label>
            <input id="auth-email" placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            {mode !== "forgot" && (
              <>
                <label htmlFor="auth-password" className="sr-only">
                  Password
                </label>
                <input
                  id="auth-password"
                  placeholder="Password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                />
              </>
            )}
            {mode === "signup" && (
              <>
                <label htmlFor="auth-confirm" className="sr-only">
                  Confirm password
                </label>
                <input id="auth-confirm" placeholder="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
              </>
            )}
            {mode === "signin" && (
              <button type="button" onClick={() => onModeChange("forgot")} className="self-end text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
                Forgot password?
              </button>
            )}
            {mode === "forgot" && <p className="text-xs leading-relaxed text-white/55">Enter the email you signed up with and we'll send you a link to set a new password.</p>}
            {error && (
              <div role="alert" className="text-left text-sm text-red-400">
                {error}
              </div>
            )}
            {notice && !error && (
              <div role="status" className="text-left text-sm text-emerald-300">
                {notice}
              </div>
            )}
          </div>
          <hr className="opacity-10" />
          <div>
            <ShinyButton type="submit" disabled={busy} className="mb-3 h-11 w-full text-sm">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </ShinyButton>
            {mode !== "forgot" && onGoogle && (
              <LiquidButton
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => run(onGoogle)}
                className="mb-2 h-11 w-full gap-2 bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-sm font-medium text-white hover:brightness-110"
              >
                <GoogleMark className="h-5 w-5" /> Continue with Google
              </LiquidButton>
            )}
            <div className="mt-2 w-full text-center">
              <span className="text-xs text-gray-400">
                {mode === "signin" ? (
                  <>
                    New to VITALS?{" "}
                    <button type="button" onClick={() => onModeChange("signup")} className="text-white/80 underline hover:text-white">
                      Create your account
                    </button>
                  </>
                ) : (
                  <>
                    {mode === "signup" ? "Already have an account? " : "Remembered it? "}
                    <button type="button" onClick={() => onModeChange("signin")} className="text-white/80 underline hover:text-white">
                      Sign in
                    </button>
                  </>
                )}
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* the team */}
      <div className="relative z-10 mt-10 flex flex-col items-center text-center">
        <p className="text-sm text-gray-400">
          Built by the <span className="font-medium text-white">Mission 61:4</span> team for NASA Space Apps 2026.
        </p>
      </div>
    </div>
  );
};

export { SignIn1 };
export default SignIn1;
