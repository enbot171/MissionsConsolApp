import { google } from "googleapis";
import { loadTokens, saveTokens } from "@/lib/google/tokens";

export const APP_CALENDAR_NAME = "Missions Consol App";
const APP_CALENDAR_DESCRIPTION =
  "Meetings scheduled in the Missions Consol App. Created and managed by the app — " +
  "deleting this calendar removes every event it made.";

// The app writes to its OWN calendar, never the user's primary one. The
// `calendar.app.created` scope cannot reach any calendar the app didn't make,
// so a bug here can't touch someone's real appointments, and inbound sync never
// reads their personal schedule.
export async function ensureAppCalendar(uid, client) {
  const stored = await loadTokens(uid);
  // "primary" is the pre-migration value; treat it as "not provisioned yet".
  if (stored?.calendarId && stored.calendarId !== "primary") return stored.calendarId;

  const created = await google.calendar({ version: "v3", auth: client }).calendars.insert({
    requestBody: {
      summary: APP_CALENDAR_NAME,
      description: APP_CALENDAR_DESCRIPTION,
    },
  });

  await saveTokens(uid, { calendarId: created.data.id });
  return created.data.id;
}
