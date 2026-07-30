import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { deleteTokens } from "@/lib/google/tokens";
import { stopChannel } from "@/lib/google/watch";

export const runtime = "nodejs";

export async function POST(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return Response.json({ error: "Missing ID token" }, { status: 401 });

  try {
    adminDb();
    const { uid } = await getAuth().verifyIdToken(idToken);
    await stopChannel(uid).catch(() => {});
    await deleteTokens(uid);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }
}
