import crypto from "node:crypto";
import { google } from "googleapis";
import { authedSession, saveTokens } from "@/lib/google/tokens";
import { requireEnv } from "@/lib/google/env";
import { ensureAppCalendar } from "@/lib/google/calendar";

export async function openChannel(uid) {
  const session = await authedSession(uid);
  if (!session) return;
  const calendar = google.calendar({ version: "v3", auth: session.client });
  const calendarId = await ensureAppCalendar(uid, session.client, session.tokens);

  // Google gives no way to renew a channel — you replace it with a new id.
  const id = crypto.randomUUID();
  const res = await calendar.events.watch({
    calendarId,
    requestBody: {
      id,
      type: "web_hook",
      address: `${requireEnv("NEXT_PUBLIC_APP_URL")}/api/google/webhook`,
      token: requireEnv("GOOGLE_WEBHOOK_TOKEN"),
    },
  });

  await saveTokens(uid, {
    channelId: id,
    resourceId: res.data.resourceId,
    channelExpiry: Number(res.data.expiration) || null,
  });
}

export async function stopChannel(uid) {
  const session = await authedSession(uid);
  if (!session) return;
  const stored = session.tokens;
  if (!stored?.channelId || !stored?.resourceId) return;

  await google.calendar({ version: "v3", auth: session.client }).channels
    .stop({ requestBody: { id: stored.channelId, resourceId: stored.resourceId } })
    .catch(() => {});

  await saveTokens(uid, { channelId: null, resourceId: null, channelExpiry: null });
}
