import { AutoRefresh } from "./AutoRefresh";

/**
 * Shown after returning from Checkout while the webhook has not landed yet.
 * Access is granted by the webhook only, so this just re-fetches the page.
 */
export function PaymentPending() {
  return (
    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AutoRefresh />
      Payment received — confirming with Stripe. This page updates automatically.
    </div>
  );
}
