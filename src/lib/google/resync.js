import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { authedSession, isDeadGrant, markNeedsReconnect } from "@/lib/google/tokens";
import { ensureAppCalendar, upsertMeetupEvent } from "@/lib/google/calendar";

// While a grant is dead every meetup edit still saves locally but never reaches
// Google, and the echo guard rightly refuses to let Google's stale copy win. So
// after a reconnect nothing would ever repair the calendar. This pushes the
// current state of every upcoming meetup back out.
const MAX_MEETUPS = 50;

export async function resyncUpcoming(uid) {
  const session = await authedSession(uid);
  if (!session) return { ok: false, reason: "not_connected" };

  const calendar = google.calendar({ version: "v3", auth: session.client });
  const calendarId = await ensureAppCalendar(uid, session.client, session.tokens);
  const db = adminDb();

  // Only future meetings are repaired. Past ones are history — recreating them
  // would spray old events across a calendar the user has already moved on from.
  const snap = await db
    .collection("meetups")
    .where("assignedTo", "==", uid)
    .where("date", ">=", new Date())
    .orderBy("date", "asc")
    .limit(MAX_MEETUPS)
    .get();

  let synced = 0, failed = 0;

  for (const doc of snap.docs) {
    const meetup = { id: doc.id, ...doc.data() };
    try {
      const eventId = await upsertMeetupEvent(calendar, calendarId, meetup);

      await doc.ref.set({ googleEventId: eventId, syncedAt: Date.now() }, { merge: true });
      synced++;
    } catch (e) {
      if (isDeadGrant(e)) {
        // The grant died mid-run; nothing further will succeed.
        await markNeedsReconnect(uid).catch(() => {});
        return { ok: false, reason: "needs_reconnect", synced, failed };
      }
      console.error("resync failed", uid, doc.id, e?.message);
      failed++;
    }
  }

  return { ok: true, synced, failed };
}
