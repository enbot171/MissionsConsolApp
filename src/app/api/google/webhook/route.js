import crypto from "node:crypto";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { authedClientFor, loadTokens, saveTokens } from "@/lib/google/tokens";
import { eventToMeetupPatch } from "@/lib/google/eventMapping";
import { requireEnv } from "@/lib/google/env";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(request) {
  // Notifications carry no body — everything is in the X-Goog-* headers.
  // This header is the endpoint's whole auth boundary — compare in constant time.
  const token = request.headers.get("x-goog-channel-token") || "";
  const expected = requireEnv("GOOGLE_WEBHOOK_TOKEN");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
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

  // A webhook has a hard execution limit. Stopping early is safe: the sync
  // token is only saved after a complete pass, so the next ping resumes.
  const MAX_PAGES = 20;
  let pages = 0;

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
  } while (pageToken && ++pages < MAX_PAGES);

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
    // Only an actual cancellation removes the meetup. An event we simply can't
    // represent — an all-day conversion, say — is left alone; deleting on that
    // would destroy a meetup because someone toggled a checkbox in Google.
    if (event.status === "cancelled") await ref.delete();
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
