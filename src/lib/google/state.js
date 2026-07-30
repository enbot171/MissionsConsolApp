import crypto from "node:crypto";
import { requireEnv } from "@/lib/google/env";

const TTL_MS = 10 * 60 * 1000;

function sign(payload) {
  return crypto
    .createHmac("sha256", requireEnv("GOOGLE_STATE_SECRET"))
    .update(payload)
    .digest("base64url");
}

// The OAuth redirect can't carry an Authorization header, so the uid rides in
// `state` instead — signed, because Google hands it straight back to us and an
// unsigned uid would let anyone bind their calendar to another user's account.
export function signState(uid, exp = Date.now() + TTL_MS) {
  const payload = Buffer.from(JSON.stringify({ uid, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyState(state) {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) throw new Error("Invalid state");

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid state");

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new Error("Invalid state");
  }
  if (!decoded.uid) throw new Error("Invalid state");
  if (Date.now() > decoded.exp) throw new Error("Expired state");
  return decoded.uid;
}
