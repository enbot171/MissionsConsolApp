import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { authedClientFor, loadTokens, saveTokens } from "@/lib/google/tokens";
import { eventToMeetupPatch } from "@/lib/google/eventMapping";
import { requireEnv } from "@/lib/google/env";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(request) {
  // Notifications carry no body — everything is in the X-Goog-* headers.
  if (request.headers.get("x-goog-channel-token") !== requireEnv("GOOGLE_WEBHOOK_TOKEN")) {
    return new Response("Forbidden", { status: 403 });
  }

  const channelId = request.headers.get("x-goog-channel-id");
  const state = request.headers.get("x-goog-resource-state");
  // The first notification after watch() is a handshake with nothing to fetch.
  if (state === "sync" || !channelId) return new Response("OK", { status: 200 });

  const found = await adminDb().collection("googleTokens").where("channelId", "==", channelId).limit(1).get();
  if (found.empty) return new Response("OK", { status: 200 });

  const uid = found.docs[0].id;
  await pullChanges(uid).catch((e) => console.error("google sync failed", uid, e));
  return new Response("OK", { status: 200 });
}

async function pullChanges(uid) {
  const client = await authedClientFor(uid);
  if (!client) return;
  const calendar = google.calendar({ version: "v3", auth: client });
  const stored = await loadTokens(uid);

  let params = stored?.syncToken
    ? { calendarId: "primary", syncToken: stored.syncToken }
    // No token yet: seed from now forward. Past events are history we don't want.
    : { calendarId: "primary", timeMin: new Date().toISOString(), singleEvents: true };

  let pageToken;
  let nextSyncToken;

  do {
    let res;
    try {
      res = await calendar.events.list({ ...params, pageToken });
    } catch (e) {
      // 410 GONE: the sync token is dead. Drop it and re-seed on the next ping.
      if (e?.code === 410) {
        await saveTokens(uid, { syncToken: null });
        return;
      }
      throw e;
    }

    for (const event of res.data.items || []) {
      await applyEvent(uid, event);
    }

    pageToken = res.data.nextPageToken;
    nextSyncToken = res.data.nextSyncToken || nextSyncToken;
  } while (pageToken);

  if (nextSyncToken) await saveTokens(uid, { syncToken: nextSyncToken });
}

async function applyEvent(uid, event) {
  const db = adminDb();
  // Only events this app created are actionable. An event made directly in
  // Google has no personId, and a meetup without a person means nothing to the
  // rest of the app, so those are ignored on purpose.
  const meetupId = event.extendedProperties?.private?.consolAppMeetupId;
  if (!meetupId) return;

  const ref = db.collection("meetups").doc(meetupId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().assignedTo !== uid) return;

  const patch = eventToMeetupPatch(event);
  if (!patch) {
    await ref.delete();
    return;
  }

  await ref.set(
    {
      date: Timestamp.fromDate(patch.date),
      location: patch.location,
      notes: patch.notes,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}
