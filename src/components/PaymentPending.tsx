"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Shown after returning from Checkout while the webhook has not landed yet.
 * Access is granted by the webhook only, so this just re-fetches the page.
 */
export function PaymentPending() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Payment received — confirming with Stripe. This page updates automatically.
    </div>
  );
}
