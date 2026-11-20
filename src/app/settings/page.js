"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getTeam, updateUserProfile } from "@/lib/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { callApi } from "@/lib/google/client";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui";
import { FiAlertCircle, FiAlertTriangle, FiCheck, FiInfo, FiLogOut, FiShield } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

const GOOGLE_BANNER = {
  connected: { text: "Google Calendar connected.", tone: "success" },
  denied: { text: "Connection cancelled.", tone: "info" },
  norefresh: {
    text: "Google didn't return a refresh token. Disconnect the app at myaccount.google.com/permissions and try again.",
    tone: "warning",
  },
  error: { text: "Couldn't connect to Google Calendar. Try again.", tone: "error" },
};

// Result of the Google redirect, shown above the cards.
const NOTICE_TONES = {
  success: { className: "bg-ok-soft text-ok-ink", Icon: FiCheck },
  info: { className: "bg-brand-soft text-brand-ink", Icon: FiInfo },
  warning: { className: "bg-warn-soft text-warn-ink", Icon: FiAlertTriangle },
  error: { className: "bg-danger-soft text-danger-ink", Icon: FiAlertCircle },
};

const HEADING = "text-[17px] font-bold tracking-[-0.015em]";

// White cards: 16px all round on phones, roomier on laptop.
const CARD = "flex flex-col rounded-3xl p-4 md:px-[22px] md:pb-[22px] md:pt-5";

// Buttons are 48px on phones and 44px on laptop, so the kit's one size is overridden.
const BUTTON_SIZE =
  "h-12! rounded-2xl! text-base! disabled:opacity-60! md:h-11! md:rounded-[14px]! md:text-[15px]!";
const PRIMARY_BUTTON = `${BUTTON_SIZE} max-md:shadow-none! disabled:shadow-none!`;

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");

const ROLE_TAG = {
  Admin: "bg-navy text-white",
  Leader: "bg-role-cgl text-role-cgl-ink",
  Member: "bg-role-contact text-role-contact-ink",
};

// The big rows at the foot of the page (Admin, Sign out).
const ROW_BUTTON =
  "flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-white px-4 text-left text-base font-semibold ring-1 ring-line transition-colors hover:bg-tint md:text-[15px]";
const ROW_ICON = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]";

const DAYS_INPUT =
  "h-12 w-22 rounded-[14px] bg-white px-3.5 text-center text-base text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand md:h-11 md:text-[15px]";

function GoogleStatusBanner({ setGoogleStatus }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const status = searchParams.get("google");
    if (status && GOOGLE_BANNER[status]) setGoogleStatus(status);
  }, [searchParams, setGoogleStatus]);
  return null;
}

function GoogleCalendarCard() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    callApi("/api/google/status").then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      const { url } = await callApi("/api/google/connect");
      window.location.href = url;
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError("");
    try { await callApi("/api/google/disconnect"); load(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <section className={`${CARD} gap-3 bg-white shadow-card md:gap-3.5`}>
      <div>
        <h2 className={HEADING}>Google Calendar</h2>
        <p className="mt-0.5 text-[13px] text-muted md:text-sm">
          Put your scheduled meetings on your own Google Calendar, and pull changes back.
        </p>
      </div>

      {status?.needsReconnect && !status?.connected ? (
        // A warning, not an error: Google ends the grant every week or so while
        // the consent screen is unverified. Expected, but the user must act.
        <>
          <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-warn-soft px-3.5 py-3 text-warn-ink md:rounded-[14px]">
            <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-warn md:hidden" />
            <FiAlertTriangle size={17} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 hidden shrink-0 md:block" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Google ended the connection</p>
              <p className="text-[13px] md:font-medium">
                This happens about once a week until the app is verified by Google. Your meetups
                are safe. Reconnect to put them back on your calendar.
              </p>
            </div>
          </div>
          <Button onClick={connect} disabled={busy} aria-busy={busy} className={PRIMARY_BUTTON}>
            {busy ? "Opening Google…" : "Reconnect Google Calendar"}
          </Button>
        </>
      ) : status?.connected ? (
        <>
          <div className="flex items-start gap-2.5 rounded-2xl bg-ok-soft px-3.5 py-3 md:px-4">
            <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-ok-ink" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ok-ink">Connected</p>
              {status.googleEmail ? (
                <p className="font-semibold wrap-anywhere">{status.googleEmail}</p>
              ) : (
                <p className="font-semibold">Reconnect to show which account this is</p>
              )}
              <p className="text-[13px] text-ok-ink">Meetings sync to this account&apos;s calendar</p>
            </div>
          </div>
          <p className="text-[13px] text-muted">
            Google requires re-connecting about once a week while the app is unverified.
          </p>
          <Button variant="outline" onClick={disconnect} disabled={busy} aria-busy={busy} className={BUTTON_SIZE}>
            {busy ? "Working…" : "Disconnect"}
          </Button>
        </>
      ) : (
        <Button onClick={connect} disabled={busy || !status} aria-busy={busy || !status} className={PRIMARY_BUTTON}>
          {busy ? "Opening Google…" : "Connect Google Calendar"}
        </Button>
      )}

      {error && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
    </section>
  );
}

export default function Settings() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState(null);
  const [followUpDays, setFollowUpDays] = useState(null);
  const [inactivityDays, setInactivityDays] = useState(null);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savedReminders, setSavedReminders] = useState(false);
  const [googleStatus, setGoogleStatus] = useState(null);

  useEffect(() => {
    if (profile?.teamId) {
      getTeam(profile.teamId).then((t) => setTeamName(t?.name || null));
    }
    if (profile) {
      setFollowUpDays(profile.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS);
      setInactivityDays(profile.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS);
    }
  }, [profile?.teamId, profile]);

  const handleSaveReminders = async () => {
    const days = Math.min(90, Math.max(1, parseInt(followUpDays) || DEFAULT_FOLLOW_UP_DAYS));
    const inDays = Math.min(365, Math.max(7, parseInt(inactivityDays) || DEFAULT_INACTIVITY_DAYS));
    setSavingReminders(true);
    await updateUserProfile(user.uid, { followUpDays: days, inactivityCheckDays: inDays });
    setSavingReminders(false);
    setSavedReminders(true);
    setTimeout(() => setSavedReminders(false), 2000);
  };

  if (loading) return null;

  const notice = googleStatus && GOOGLE_BANNER[googleStatus];
  const noticeTone = notice && NOTICE_TONES[notice.tone];
  const name = profile?.name?.trim();

  // Phones head the page "Settings". Laptop heads it with the person: their
  // initials, "Settings" as the small line, then their name.
  const heading = name ? (
    <>
      <span className="md:hidden">Settings</span>
      <span className="hidden items-center gap-4 md:flex">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-role-contact text-[22px] tracking-normal text-role-contact-ink"
        >
          {initials(name)}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-normal leading-normal tracking-normal text-muted">Settings</span>
          <span className="block leading-[1.15] wrap-anywhere">{name}</span>
        </span>
      </span>
    </>
  ) : (
    "Settings"
  );

  return (
    <PageShell title={heading}>
      <Suspense fallback={null}>
        <GoogleStatusBanner setGoogleStatus={setGoogleStatus} />
      </Suspense>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-3 flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-sm font-medium leading-[1.45] md:mb-[18px] ${noticeTone.className}`}
        >
          <noticeTone.Icon size={17} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0">{notice.text}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:gap-4">
        <div className="flex min-w-0 flex-col gap-3 md:flex-[1_1_380px] md:gap-4">
          <section className="flex flex-col gap-0.5 rounded-[20px] bg-tint px-4 pb-2 pt-3 md:gap-1.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-3.5 md:pt-5 md:shadow-card">
            <h2 className="text-sm font-bold md:text-[17px] md:tracking-[-0.015em]">My account</h2>
            <dl className="flex flex-col">
              <Row label="Name">{profile?.name || "—"}</Row>
              <Row label="Email"><span className="block truncate md:whitespace-normal md:wrap-anywhere">{profile?.email || "—"}</span></Row>
              <Row label="Role">
                <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12.5px] md:h-[26px] md:px-3 md:text-[13px] ${ROLE_TAG[profile?.role] || "bg-fill text-ink-2"}`}>
                  {profile?.role || "—"}
                </span>
              </Row>
              <Row label="Team">
                {teamName || (profile?.teamId ? <span className="text-muted">Loading…</span> : "Unassigned")}
              </Row>
            </dl>
          </section>

          <GoogleCalendarCard />
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:flex-[1_1_380px] md:gap-4">
          <section className={`${CARD} gap-3.5 bg-brand-soft md:gap-4`}>
            <h2 className={HEADING}>Follow-up reminders</h2>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">First follow-up after</span>
              <span className="text-[13px] text-ink-2">Remind you to text a new contact this many days after first meeting them.</span>
              <span className="mt-1 flex items-center gap-2.5">
                <input
                  type="number" inputMode="numeric" min={1} max={90}
                  value={followUpDays ?? DEFAULT_FOLLOW_UP_DAYS}
                  onChange={(e) => setFollowUpDays(e.target.value)}
                  className={DAYS_INPUT}
                />
                days
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Inactivity check after</span>
              <span className="text-[13px] text-ink-2">Flag contacts you haven&apos;t followed up with in this long, to check if they&apos;re still active or should be archived.</span>
              <span className="mt-1 flex items-center gap-2.5">
                <input
                  type="number" inputMode="numeric" min={7} max={365}
                  value={inactivityDays ?? DEFAULT_INACTIVITY_DAYS}
                  onChange={(e) => setInactivityDays(e.target.value)}
                  className={DAYS_INPUT}
                />
                days
              </span>
            </label>

            <Button onClick={handleSaveReminders} disabled={savingReminders} aria-busy={savingReminders} className={PRIMARY_BUTTON}>
              {savedReminders && !savingReminders && <FiCheck size={17} strokeWidth={2.4} aria-hidden="true" />}
              <span role="status">{savingReminders ? "Saving…" : savedReminders ? "Saved!" : "Save"}</span>
            </Button>
          </section>

          {profile?.role === "Admin" && (
            <button type="button" onClick={() => router.push("/admin")} className={`${ROW_BUTTON} text-ink`}>
              <span aria-hidden="true" className={`${ROW_ICON} bg-navy text-white`}>
                <FiShield size={18} />
              </span>
              Admin dashboard
            </button>
          )}

          <button
            type="button"
            onClick={() => signOut(auth).then(() => router.push("/login"))}
            className={`${ROW_BUTTON} text-warn-ink`}
          >
            <span aria-hidden="true" className={`${ROW_ICON} bg-warn-soft text-role-core-ink`}>
              <FiLogOut size={18} />
            </span>
            Sign out
          </button>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-3 md:min-h-11">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 font-semibold">{children}</dd>
    </div>
  );
}
