import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Resolve the caller's uid from their Firebase ID token.
 *
 * Every user-facing route under /api/google needs this, and each one having its
 * own copy meant the auth contract was five near-identical blocks that could
 * drift apart. The webhook and cron routes deliberately do NOT use this — they
 * authenticate with a shared secret because there is no signed-in user behind
 * them.
 *
 * Returns `{ uid }` on success, or `{ response }` holding the 401 to return.
 * Never returns a uid taken from client-supplied data.
 */
export async function requireUid(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) {
    return { response: Response.json({ error: "Missing ID token" }, { status: 401 }) };
  }

  try {
    // Touch the Admin SDK first so it is initialised before getAuth() runs.
    adminDb();
    const { uid } = await getAuth().verifyIdToken(idToken);
    return { uid };
  } catch {
    return { response: Response.json({ error: "Invalid ID token" }, { status: 401 }) };
  }
}
