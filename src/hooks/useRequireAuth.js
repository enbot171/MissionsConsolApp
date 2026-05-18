"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function useRequireAuth() {
  const { user, profile, loading, needsSetup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || needsSetup) {
      router.push("/login");
    }
  }, [user, loading, needsSetup, router]);

  return { user, profile, loading, needsSetup };
}
