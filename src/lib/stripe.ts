import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily constructed so the app builds and runs without Stripe keys. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("...")) {
    throw new Error("STRIPE_SECRET_KEY is not set. Copy .env.example to .env and add a test key.");
  }
  client = new Stripe(key);
  return client;
}
