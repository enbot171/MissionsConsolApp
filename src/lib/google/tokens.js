import { adminDb } from "@/lib/firebaseAdmin";
import { oauthClient } from "@/lib/google/oauth";

const COLLECTION = "googleTokens";

export async function saveTokens(uid, data) {
  await adminDb().collection(COLLECTION).doc(uid).set(data, { merge: true });
}

export async function loadTokens(uid) {
  const snap = await adminDb().collection(COLLECTION).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

export async function deleteTokens(uid) {
  await adminDb().collection(COLLECTION).doc(uid).delete();
}

// Google reports a dead grant as `invalid_grant`. In Testing mode this happens
// to every user every 7 days, so it is an expected state, not an exception.
export function isDeadGrant(error) {
  const code = error?.response?.data?.error || error?.errors?.[0]?.reason || "";
  return code === "invalid_grant" || error?.message?.includes("invalid_grant");
}

export async function markNeedsReconnect(uid) {
  // Keep the document so the UI can explain what happened, but drop the dead
  // credential — a token string that no longer works is worse than none,
  // because everything downstream reads its presence as "connected".
  await adminDb().collection(COLLECTION).doc(uid).set(
    { refreshToken: null, needsReconnect: true, disconnectedAt: Date.now() },
    { merge: true }
  );
}

// Every connected user gets their own client — tokens are per-person, so a
// module-level singleton would leak one user's calendar into another's request.
export async function authedClientFor(uid) {
  const stored = await loadTokens(uid);
  if (!stored?.refreshToken) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: stored.refreshToken });
  return client;
}
