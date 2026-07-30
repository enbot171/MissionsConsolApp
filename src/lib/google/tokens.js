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

// Every connected user gets their own client — tokens are per-person, so a
// module-level singleton would leak one user's calendar into another's request.
export async function authedClientFor(uid) {
  const stored = await loadTokens(uid);
  if (!stored?.refreshToken) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: stored.refreshToken });
  return client;
}
