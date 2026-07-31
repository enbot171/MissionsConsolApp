import { google } from "googleapis";
import { requireEnv } from "@/lib/google/env";

// Lets the app create secondary calendars and manage events on those only. It
// cannot see or touch the user's existing calendars at all — so a bug in this
// app can never delete someone's real appointment, and inbound sync never reads
// their personal schedule.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
// Which Google account is connected. `calendar.events` cannot read calendar
// metadata (403), and asking for a broader calendar scope to learn an address
// would be disproportionate — these two are non-sensitive and add nothing to
// the verification burden.
const IDENTITY_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email"];

export function oauthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function authUrl(state) {
  return oauthClient().generateAuthUrl({
    // offline + consent is the only combination that reliably returns a
    // refresh token; without prompt:consent a returning user gets none.
    access_type: "offline",
    prompt: "consent",
    scope: [CALENDAR_SCOPE, ...IDENTITY_SCOPES],
    state,
  });
}

// The id_token comes straight from Google's token endpoint over TLS, not from
// the browser, so reading the claim without verifying the signature is safe
// here. Returns null rather than throwing — an unknown address is a cosmetic
// loss, and must never cost someone their connection.
export function emailFromIdToken(idToken) {
  try {
    const payload = String(idToken).split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString()).email || null;
  } catch {
    return null;
  }
}
