import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadTokens } from "@/lib/google/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return Response.json({ error: "Missing ID token" }, { status: 401 });

  try {
    adminDb();
    const { uid } = await getAuth().verifyIdToken(idToken);
    const tokens = await loadTokens(uid);
    return Response.json({
      connected: !!tokens?.refreshToken,
      googleEmail: tokens?.googleEmail || null,
      connectedAt: tokens?.connectedAt || null,
      channelExpiry: tokens?.channelExpiry || null,
      needsReconnect: !!tokens?.needsReconnect,
    });
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }
}
