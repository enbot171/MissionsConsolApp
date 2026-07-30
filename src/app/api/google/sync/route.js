import { google } from "googleapis";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { authedClientFor, isDeadGrant, markNeedsReconnect } from "@/lib/google/tokens";
import { meetupToEvent } from "@/lib/google/eventMapping";

export const runtime = "nodejs";

export async function POST(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return Response.json({ error: "Missing ID token" }, { status: 401 });

  let uid;
  try {
    adminDb();
    ({ uid } = await getAuth().verifyIdToken(idToken));
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const { meetupId, action } = await request.json();
  if (!meetupId || !["upsert", "delete"].includes(action)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const client = await authedClientFor(uid);
  // Not being connected is the normal case, not an error — the app must work
  // fully without Google.
  if (!client) return Response.json({ ok: false, reason: "not_connected" });

  const calendar = google.calendar({ version: "v3", auth: client });
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
        await calendar.events.delete({ calendarId: "primary", eventId }).catch((e) => {
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

  const body = meetupToEvent(meetup);
  let eventId = meetup.googleEventId;

  try {
    if (eventId) {
      await calendar.events.patch({ calendarId: "primary", eventId, requestBody: body })
        .catch(async (e) => {
          if (![404, 410].includes(e?.code)) throw e;
          // The event was deleted in Google; recreate rather than dropping the link.
          const created = await calendar.events.insert({ calendarId: "primary", requestBody: body });
          eventId = created.data.id;
        });
    } else {
      const created = await calendar.events.insert({ calendarId: "primary", requestBody: body });
      eventId = created.data.id;
    }
  } catch (e) {
    if (!isDeadGrant(e)) throw e;
    await markNeedsReconnect(uid);
    return Response.json({ ok: false, reason: "needs_reconnect" });
  }

  await ref.set({ googleEventId: eventId, syncedAt: Date.now() }, { merge: true });
  return Response.json({ ok: true, googleEventId: eventId });
}
