import { oauthClient } from "@/lib/google/oauth";
import { verifyState } from "@/lib/google/state";
import { saveTokens } from "@/lib/google/tokens";
import { requireEnv } from "@/lib/google/env";
import { openChannel } from "@/lib/google/watch";
import { resyncUpcoming } from "@/lib/google/resync";

export const runtime = "nodejs";

function back(status) {
  return Response.redirect(`${requireEnv("NEXT_PUBLIC_APP_URL")}/settings?google=${status}`, 302);
}

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");

  const code = params.get("code");
  if (!code) return back("error");

  let uid;
  try {
    uid = verifyState(params.get("state"));
  } catch {
    return back("error");
  }

  try {
    const { tokens } = await oauthClient().getToken(code);
    // Testing-mode consent screens re-issue a refresh token every time because
    // we always send prompt=consent. If one is ever missing, the connection is
    // useless, so fail loudly rather than storing a half-connection.
    if (!tokens.refresh_token) return back("norefresh");

    await saveTokens(uid, {
      refreshToken: tokens.refresh_token,
      calendarId: "primary",
      connectedAt: Date.now(),
      // A fresh grant clears any earlier "reconnect me" state.
      needsReconnect: false,
    });
    // Best-effort: a failed watch shouldn't make the connection itself fail.
    // The renew cron will pick it up within a day.
    await openChannel(uid).catch(() => {});
    // Meetup edits made while the grant was dead never reached Google, and
    // inbound sync won't fix them (Google's copy is older, so the echo guard
    // rejects it). Push upcoming meetups out now. This is a redirect, so it has
    // to happen inline — but a failure must never strand the user here.
    await resyncUpcoming(uid).catch(() => {});
    return back("connected");
  } catch {
    return back("error");
  }
}
