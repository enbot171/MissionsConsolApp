import { getAuth } from "firebase-admin/auth";
import { authUrl } from "@/lib/google/oauth";
import { signState } from "@/lib/google/state";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return Response.json({ error: "Missing ID token" }, { status: 401 });

  try {
    adminDb(); // force Admin SDK init before verifying
    const { uid } = await getAuth().verifyIdToken(idToken);
    return Response.json({ url: authUrl(signState(uid)) });
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }
}
