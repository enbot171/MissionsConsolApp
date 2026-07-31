import { requireUid } from "@/lib/google/requireUid";
import { deleteTokens } from "@/lib/google/tokens";
import { stopChannel } from "@/lib/google/watch";

export const runtime = "nodejs";

export async function POST(request) {
  const { uid, response } = await requireUid(request);
  if (response) return response;

  // Stop before delete — stopChannel needs the stored resourceId to tell Google
  // which channel to close.
  await stopChannel(uid).catch(() => {});
  await deleteTokens(uid);
  return Response.json({ ok: true });
}
