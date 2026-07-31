import { requireUid } from "@/lib/google/requireUid";
import { resyncUpcoming } from "@/lib/google/resync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  // uid comes from the verified token only — never from the request body.
  const { uid, response } = await requireUid(request);
  if (response) return response;

  return Response.json(await resyncUpcoming(uid));
}
