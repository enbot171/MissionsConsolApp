import crypto from "node:crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { openChannel } from "@/lib/google/watch";
import { requireEnv } from "@/lib/google/env";
import { isDeadGrant, markNeedsReconnect } from "@/lib/google/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

// Renew well before expiry — a channel that lapses takes inbound sync down
// silently, because outbound keeps working and nothing looks broken.
const RENEW_WITHIN_MS = 48 * 60 * 60 * 1000;

export async function GET(request) {
  // Same auth boundary reasoning as the webhook route — compare in constant time.
  const provided = request.headers.get("authorization") || "";
  const expected = `Bearer ${requireEnv("CRON_SECRET")}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response("Forbidden", { status: 403 });
  }

  const snap = await adminDb().collection("googleTokens").get();
  const cutoff = Date.now() + RENEW_WITHIN_MS;

  let renewed = 0, failed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.refreshToken) continue;
    if (data.channelExpiry && data.channelExpiry > cutoff) continue;

    try {
      await openChannel(doc.id);
      renewed++;
    } catch (e) {
      // A user whose refresh token expired (Testing mode, 7 days) fails here.
      // That's expected; flag it so settings can prompt them to reconnect.
      if (isDeadGrant(e)) await markNeedsReconnect(doc.id).catch(() => {});
      console.error("renew failed", doc.id, e?.message);
      failed++;
    }
  }

  return Response.json({ renewed, failed });
}
