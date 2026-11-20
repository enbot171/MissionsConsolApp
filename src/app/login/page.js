"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider, getAdditionalUserInfo, signInWithEmailAndPassword, signInWithPopup, signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/firestore";
import { FiAlertCircle, FiHeart } from "react-icons/fi";
import { Button, Field, inputClass } from "@/components/ui";

const NOT_SET_UP = "Your account has not been set up yet. Contact your admin.";

// Google's own "G" mark, as its sign-in branding asks for.
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const busy = loading || googleLoading;

  // Accounts are made by an admin. Signing in only works for someone who has a
  // profile; anyone else is signed straight back out.
  const goToApp = (profile) => router.push(profile.role === "Admin" ? "/admin" : "/");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        setError(NOT_SET_UP);
        return;
      }
      goToApp(profile);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  // Google signs in to the same account when its email matches the one the
  // admin set up. A Google account with no matching profile gets no access: a
  // sign-in record made just now is deleted again, so nothing is left behind.
  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const profile = await getUserProfile(cred.user.uid).catch(() => null);
      if (profile) {
        goToApp(profile);
        return;
      }
      if (getAdditionalUserInfo(cred)?.isNewUser) await cred.user.delete().catch(() => signOut(auth));
      else await signOut(auth);
      setError(`No account is set up for ${cred.user.email || "that Google account"}. Contact your admin, or sign in with the email they gave you.`);
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      setError(
        code === "auth/popup-blocked"
          ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
          : code === "auth/account-exists-with-different-credential"
            ? "This email already signs in with a password. Use your email and password below."
            : "Could not sign in with Google. Try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[15px] text-ink md:flex-row md:flex-wrap">
      <aside className="flex flex-col gap-7 rounded-b-3xl bg-navy px-6 pb-8 pt-7 text-white md:max-w-full md:flex-[1_1_440px] md:gap-6 md:rounded-none md:px-12 md:pb-10 md:pt-9">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-light text-navy">
            <FiHeart size={20} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.015em]">Missions Consol App</span>
        </div>
        <div className="flex flex-col gap-2.5 md:my-auto md:max-w-105 md:gap-4">
          <p className="text-[28px] font-bold leading-[1.15] tracking-[-0.03em] md:text-[40px] md:leading-[1.12]">
            Know who you met, and who to follow up next.
          </p>
          <p className="text-nav-muted md:text-[17px]">
            One place for your missions team to keep contacts, follow-ups, meetings and connect groups.
          </p>
        </div>
        <p className="hidden text-[13px] text-nav-muted md:block">Accounts are set up by your team admin.</p>
      </aside>

      <main className="min-w-0 px-6 pt-7 pb-10 md:flex md:flex-[1.2_1_480px] md:items-center md:justify-center md:px-9 md:py-12">
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-4 md:w-95 md:max-w-full md:gap-4.5">
          <div>
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em] md:text-[32px]">Sign in</h1>
            <p className="mt-1.5 hidden text-muted md:block">Use Google, or the email and password for your account.</p>
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={handleGoogle}
            disabled={busy}
            aria-busy={googleLoading}
            className="w-full gap-2.5 md:h-12! md:rounded-[14px]!"
          >
            <GoogleMark />
            {googleLoading ? "Opening Google…" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${inputClass} font-normal`}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={`${inputClass} font-normal`}
            />
          </Field>

          {error && (
            <div role="alert" className="flex items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger-ink">
              <FiAlertCircle size={18} aria-hidden="true" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={busy}
            aria-busy={loading}
            className="mt-1 w-full md:h-12! md:rounded-[14px]!"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-[13px] text-muted">If your account has not been set up yet, contact your admin.</p>
        </form>
      </main>
    </div>
  );
}
