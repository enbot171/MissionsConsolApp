import { requireUid } from "@/lib/google/requireUid";
import { loadTokens } from "@/lib/google/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const { uid, response } = await requireUid(request);
  if (response) return response;

  const tokens = await loadTokens(uid);
  return Response.json({
    connected: !!tokens?.refreshToken,
    googleEmail: tokens?.googleEmail || null,
    connectedAt: tokens?.connectedAt || null,
    channelExpiry: tokens?.channelExpiry || null,
    needsReconnect: !!tokens?.needsReconnect,
  });
}
