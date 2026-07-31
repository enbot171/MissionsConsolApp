import { authUrl } from "@/lib/google/oauth";
import { signState } from "@/lib/google/state";
import { requireUid } from "@/lib/google/requireUid";

export const runtime = "nodejs";

export async function POST(request) {
  const { uid, response } = await requireUid(request);
  if (response) return response;

  return Response.json({ url: authUrl(signState(uid)) });
}
