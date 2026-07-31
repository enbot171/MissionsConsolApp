import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireUid } from "@/lib/google/requireUid";
import { authedSession, isDeadGrant, markNeedsReconnect } from "@/lib/google/tokens";
import { ensureAppCalendar, upsertMeetupEvent } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function POST(request) {
  const { uid, response } = await requireUid(request);
  if (response) return response;

  const { meetupId, action } = await request.json();
  if (!meetupId || !["upsert", "delete"].includes(action)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  // Not being connected is the normal case, not an error — the app must work
  // fully without Google.
  const session = await authedSession(uid);
  if (!session) return Response.json({ ok: false, reason: "not_connected" });

  const calendar = google.calendar({ version: "v3", auth: session.client });
  const calendarId = await ensureAppCalendar(uid, session.client, session.tokens);
  const ref = adminDb().collection("meetups").doc(meetupId);
  const snap = await ref.get();

  if (action === "delete") {
    // Same ownership rule as upsert. Returns ok rather than 403 so the caller
    // can't use this route to probe which meetup ids exist.
    const eventId = snap.exists && snap.data().assignedTo === uid
      ? snap.data().googleEventId
      : null;
    if (eventId) {
      try {
        // 404/410 mean it's already gone from Google, which is the desired end state.
        await calendar.events.delete({ calendarId, eventId }).catch((e) => {
          if (![404, 410].includes(e?.code)) throw e;
        });
      } catch (e) {
        // A grant that died (weekly, in Testing mode) is not a server error —
        // record it so the UI can ask for a reconnect instead of lying green.
        if (!isDeadGrant(e)) throw e;
        await markNeedsReconnect(uid);
        return Response.json({ ok: false, reason: "needs_reconnect" });
      }
    }
    return Response.json({ ok: true });
  }

  if (!snap.exists) return Response.json({ error: "Meetup not found" }, { status: 404 });
  const meetup = { id: snap.id, ...snap.data() };
  if (meetup.assignedTo !== uid) return Response.json({ error: "Forbidden" }, { status: 403 });

  let eventId;
  try {
    eventId = await upsertMeetupEvent(calendar, calendarId, meetup);
  } catch (e) {
    if (!isDeadGrant(e)) throw e;
    await markNeedsReconnect(uid);
    return Response.json({ ok: false, reason: "needs_reconnect" });
  }

  await ref.set({ googleEventId: eventId, syncedAt: Date.now() }, { merge: true });
  return Response.json({ ok: true, googleEventId: eventId });
}
