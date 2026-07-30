"use client";

import { auth } from "@/lib/firebase";

// Browser-side helper. Every /api/google route authenticates by verifying this
// ID token server-side, so no route ever accepts a uid as input.
export async function callApi(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();

  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
