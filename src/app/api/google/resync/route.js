import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { resyncUpcoming } from "@/lib/google/resync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return Response.json({ error: "Missing ID token" }, { status: 401 });

  let uid;
  try {
    adminDb();
    ({ uid } = await getAuth().verifyIdToken(idToken));
  } catch {
    return Response.json({ error: "Invalid ID token" }, { status: 401 });
  }

  // uid comes from the verified token only — never from the request body.
  return Response.json(await resyncUpcoming(uid));
}
