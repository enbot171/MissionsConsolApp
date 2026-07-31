import { google } from "googleapis";
import { loadTokens, saveTokens } from "@/lib/google/tokens";
import { meetupToEvent } from "@/lib/google/eventMapping";

export const APP_CALENDAR_NAME = "Missions Consol App";
const APP_CALENDAR_DESCRIPTION =
  "Meetings scheduled in the Missions Consol App. Created and managed by the app — " +
  "deleting this calendar removes every event it made.";

// Documents written before the app had its own calendar stored the literal
// "primary". Read provisioning state through here so that migration detail
// lives in exactly one place instead of being re-checked at each call site.
export function storedCalendarId(tokens) {
  const id = tokens?.calendarId;
  return id && id !== "primary" ? id : null;
}

// The app writes to its OWN calendar, never the user's primary one. The
// `calendar.app.created` scope cannot reach any calendar the app didn't make,
// so a bug here can't touch someone's real appointments, and inbound sync never
// reads their personal schedule.
//
// Pass `tokens` when the caller has already loaded them — otherwise this costs
// a second read of the same document on every sync.
export async function ensureAppCalendar(uid, client, tokens) {
  const existing = storedCalendarId(tokens ?? (await loadTokens(uid)));
  if (existing) return existing;

  const created = await google.calendar({ version: "v3", auth: client }).calendars.insert({
    requestBody: {
      summary: APP_CALENDAR_NAME,
      description: APP_CALENDAR_DESCRIPTION,
    },
  });

  await saveTokens(uid, { calendarId: created.data.id });
  return created.data.id;
}

// Push a meetup to Google and return the resulting event id. Shared by the
// per-save sync route and the bulk resync — both need identical
// patch-or-insert semantics, including recreating an event somebody deleted in
// Google rather than orphaning the link to it.
export async function upsertMeetupEvent(calendar, calendarId, meetup) {
  const body = meetupToEvent(meetup);
  const existingId = meetup.googleEventId;
  if (!existingId) {
    const created = await calendar.events.insert({ calendarId, requestBody: body });
    return created.data.id;
  }

  try {
    await calendar.events.patch({ calendarId, eventId: existingId, requestBody: body });
    return existingId;
  } catch (e) {
    if (![404, 410].includes(e?.code)) throw e;
    const created = await calendar.events.insert({ calendarId, requestBody: body });
    return created.data.id;
  }
}
