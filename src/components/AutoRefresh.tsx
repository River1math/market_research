"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the current page on an interval while mounted. */
export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
