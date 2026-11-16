import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_URL, PRODUCT_NAME, SINGLE_PRICE_CENTS } from "@/lib/config";
import { consumeCredit, findUsableCredit } from "@/lib/credits";
import { draftAnswers } from "@/lib/drafting";
import { getOrgId } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Unlock a questionnaire (PRD §5, steps 1–3).
 * Responds {unlocked: true} when an existing credit covered it, otherwise
 * {url} pointing at a Stripe Checkout Session for the $79 Single.
 */
export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { questionnaireId?: unknown } | null;
  const questionnaireId = typeof body?.questionnaireId === "string" ? body.questionnaireId : null;
  if (!questionnaireId) {
    return NextResponse.json({ error: "questionnaireId is required." }, { status: 400 });
  }

  // Scoped by orgId: a questionnaire from another org is simply "not found".
  const questionnaire = await db.questionnaire.findFirst({
    where: { id: questionnaireId, orgId },
    include: { org: true },
  });
  if (!questionnaire) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (questionnaire.unlocked) return NextResponse.json({ unlocked: true });

  const usedCredit = await db.$transaction(async (tx) => {
    const credit = await findUsableCredit(tx, orgId);
    return credit ? consumeCredit(tx, credit.id, questionnaireId) : false;
  });
  if (usedCredit) {
    await draftAnswers(questionnaireId);
    return NextResponse.json({ unlocked: true });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }

  const priceId = process.env.STRIPE_PRICE_SINGLE;
  const returnUrl = `${APP_URL}/app/q/${questionnaireId}`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        priceId
          ? { price: priceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: SINGLE_PRICE_CENTS,
                product_data: {
                  name: `${PRODUCT_NAME} — Single questionnaire`,
                  description: "All answers drafted and export unlocked for one questionnaire.",
                },
              },
            },
      ],
      // Reuse the Stripe customer on repeat purchases; otherwise create one so
      // a later subscription can attach to the same customer.
      ...(questionnaire.org.stripeCustomerId
        ? { customer: questionnaire.org.stripeCustomerId }
        : { customer_creation: "always" as const }),
      client_reference_id: orgId,
      metadata: { orgId, questionnaireId },
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancelled`,
    });
  } catch (err) {
    console.error("[stripe] checkout session creation failed", err);
    return NextResponse.json({ error: "Could not reach Stripe. Please try again." }, { status: 502 });
  }

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
