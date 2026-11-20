"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/firestore";
import { FiAlertCircle, FiHeart } from "react-icons/fi";
import { Button, Field, inputClass } from "@/components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        setError("Your account has not been set up yet. Contact your admin.");
        return;
      }
      router.push(profile.role === "Admin" ? "/admin" : "/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
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
            <p className="mt-1.5 hidden text-muted md:block">Use the email and password for your account.</p>
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
            disabled={loading}
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
