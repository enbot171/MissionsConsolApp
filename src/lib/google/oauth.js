import { google } from "googleapis";
import { requireEnv } from "@/lib/google/env";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

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
    scope: [CALENDAR_SCOPE],
    state,
  });
}
