"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getTeam, updateUserProfile } from "@/lib/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { callApi } from "@/lib/google/client";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import { useSidebar } from "@/context/SidebarContext";
import { FiLogOut, FiShield } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

const GOOGLE_BANNER = {
  connected: { text: "Google Calendar connected.", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  denied: { text: "Connection cancelled.", className: "bg-gray-50 text-gray-600 border-gray-100" },
  norefresh: {
    text: "Google didn't return a refresh token. Disconnect the app at myaccount.google.com/permissions and try again.",
    className: "bg-amber-50 text-amber-700 border-amber-100",
  },
  error: { text: "Couldn't connect to Google Calendar. Try again.", className: "bg-red-50 text-red-700 border-red-100" },
};

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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Put your scheduled meetings on your own Google Calendar, and pull changes back.
        </p>
      </div>

      {status?.connected ? (
        <>
          <p className="text-xs font-semibold text-emerald-600">Connected</p>
          <p className="text-[11px] text-gray-400">
            Google requires re-connecting about once a week while the app is unverified.
          </p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="w-full py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {busy ? "Working…" : "Disconnect"}
          </button>
        </>
      ) : (
        <button
          onClick={connect}
          disabled={busy || !status}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors"
        >
          {busy ? "Opening Google…" : "Connect Google Calendar"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function Settings() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";
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

  const roleColor = {
    Admin: "bg-gray-800 text-white",
    Leader: "bg-violet-100 text-violet-700",
    Member: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        <div className="bg-linear-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-blue-200 text-sm font-medium">Settings</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">{profile?.name || "—"}</h1>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4 px-4">
          <div className="max-w-lg mx-auto md:max-w-3xl space-y-3">

            <Suspense fallback={null}>
              <GoogleStatusBanner setGoogleStatus={setGoogleStatus} />
            </Suspense>

            {googleStatus && GOOGLE_BANNER[googleStatus] && (
              <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${GOOGLE_BANNER[googleStatus].className}`}>
                {GOOGLE_BANNER[googleStatus].text}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">My Account</p>
              <div className="space-y-3">
                <Row label="Name" value={profile?.name || "—"} />
                <Row label="Email" value={profile?.email || "—"} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Role</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${roleColor[profile?.role] || "bg-gray-100 text-gray-700"}`}>
                    {profile?.role || "—"}
                  </span>
                </div>
                <Row label="Team" value={teamName || (profile?.teamId ? "Loading…" : "Unassigned")} />
              </div>
            </div>

            {/* Follow-up Reminders */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Follow-up Reminders</p>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700">First follow-up after</p>
                <p className="text-xs text-gray-400">Remind you to text a new contact this many days after first meeting them.</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={1} max={90}
                    value={followUpDays ?? DEFAULT_FOLLOW_UP_DAYS}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 bg-gray-50 text-center"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700">Inactivity check after</p>
                <p className="text-xs text-gray-400">Flag contacts you haven't followed up with in this long — to check if they're still active or should be archived.</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={7} max={365}
                    value={inactivityDays ?? DEFAULT_INACTIVITY_DAYS}
                    onChange={(e) => setInactivityDays(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 bg-gray-50 text-center"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </div>

              <button
                onClick={handleSaveReminders}
                disabled={savingReminders}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {savingReminders ? "Saving…" : savedReminders ? "Saved!" : "Save"}
              </button>
            </div>

            <GoogleCalendarCard />

            {profile?.role === "Admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FiShield className="text-white" size={16} />
                </div>
                <span className="flex-1 text-left font-semibold text-gray-800">Admin Dashboard</span>
              </button>
            )}

            <button
              onClick={() => signOut(auth).then(() => router.push("/login"))}
              className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-red-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <FiLogOut className="text-red-500" size={16} />
              </div>
              <span className="flex-1 text-left font-semibold text-red-500">Sign Out</span>
            </button>

          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
