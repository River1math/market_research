import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { consumeCredit } from "@/lib/credits";
import { scheduleDrafting } from "@/lib/schedule";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook (PRD §5, step 4). This is the only place a payment grants
 * access — the success page never does.
 *
 * Local testing:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || secret.includes("...")) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set." }, { status: 503 });
  }
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  // Signature verification needs the exact bytes Stripe sent.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    // async_payment_succeeded covers delayed methods (e.g. bank debits) where
    // checkout.session.completed arrives with payment_status "unpaid".
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const questionnaireId = await fulfilSinglePurchase(event);
      if (questionnaireId) scheduleDrafting(questionnaireId);
      break;
    }
    default:
      // Subscription events (invoice.paid, customer.subscription.*) are not
      // handled yet — the MVP leads with the Single purchase only.
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Record the event and grant the credit in one transaction, so a failure
 * rolls back both and Stripe's retry gets a clean second attempt. A replayed
 * event hits the StripeEvent primary key and is ignored.
 *
 * Returns the questionnaire to draft, or null when nothing was granted.
 */
async function fulfilSinglePurchase(event: Stripe.Event): Promise<string | null> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;

  const orgId = session.metadata?.orgId ?? session.client_reference_id;
  const questionnaireId = session.metadata?.questionnaireId;
  if (!orgId || !questionnaireId) return null;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  try {
    return await db.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });

      const questionnaire = await tx.questionnaire.findFirst({
        where: { id: questionnaireId, orgId },
      });
      if (!questionnaire) {
        // Paid, but nothing to attach it to. Keep the event recorded and
        // surface it: this needs a manual look (refund or re-link).
        console.error(`[stripe] ${event.id}: questionnaire ${questionnaireId} not found for org ${orgId}`);
        return null;
      }

      if (customerId) {
        await tx.organization.update({ where: { id: orgId }, data: { stripeCustomerId: customerId } });
      }

      // Unique on (source, stripeRef): the two event types above can both
      // fire for one session without double-granting.
      const credit = await tx.questionnaireCredit.upsert({
        where: { source_stripeRef: { source: "single_purchase", stripeRef: session.id } },
        create: { orgId, source: "single_purchase", stripeRef: session.id, quantity: 1 },
        update: {},
      });

      // If the questionnaire was unlocked some other way in the meantime,
      // the credit stays on the org for the next questionnaire.
      if (!questionnaire.unlocked) await consumeCredit(tx, credit.id, questionnaireId);
      return questionnaireId;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null; // duplicate delivery — already processed
    }
    throw err; // 500 → Stripe retries
  }
}
