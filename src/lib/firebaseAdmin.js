import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { requireEnv } from "@/lib/google/env";

// Route handlers run in a warm serverless instance that may already hold an
// initialised app, so reuse rather than re-init.
function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp({
    credential: cert(JSON.parse(requireEnv("FIREBASE_SERVICE_ACCOUNT"))),
  });
}

export const adminDb = () => getFirestore(getAdminApp());
