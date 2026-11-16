# Attestly (working name)

Security-questionnaire answering for SaaS teams without a security team.
Research and product spec live in `competitor_analysis.csv`, `financial_model.md` and `mvp_prd.md`.

This repository is an MVP **scaffold**: Next.js (App Router, TypeScript), Tailwind CSS v4, Prisma + SQLite, Stripe Checkout.

## Run locally

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:push
```

```bash
npm run dev
```

Open http://localhost:3000, click "Upload a questionnaire" and upload `fixtures/sample-questionnaire.csv`.

## Test the $79 payment

1. Put a Stripe **test** secret key in `.env` as `STRIPE_SECRET_KEY`.
2. Forward webhooks and copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Upload a file with more than 25 questions, click "Unlock all for $79", pay with card `4242 4242 4242 4242`.

The questionnaire unlocks when the webhook arrives; the success page only polls for it.

## What works

| Area | Files | State |
|---|---|---|
| Landing page with $79 Single pricing | `src/app/page.tsx` | Done |
| Database schema | `prisma/schema.prisma` | Done (SQLite adaptation of PRD §4) |
| Upload + parse `.xlsx` / `.csv` | `src/app/api/upload/route.ts`, `src/lib/parser.ts` | Works; heuristic column detection, no correction screen yet |
| Free preview paywall (first 25 questions) | `src/app/app/q/[id]/page.tsx` | Done |
| Stripe Checkout, one-time $79 | `src/app/api/checkout/route.ts` | Done |
| Stripe webhook, idempotent credit grant | `src/app/api/stripe/webhook/route.ts`, `src/lib/credits.ts` | Done |

## What is stubbed — do not launch with these

| Stub | File | Replace with |
|---|---|---|
| **Answer drafting** — every answer is a "Needs your input" placeholder | `src/lib/drafting.ts` | Retrieval + LLM structured output in a background job (PRD F5) |
| **Auth** — anonymous org id in a cookie | `src/lib/session.ts` | Auth.js with magic link / Google (PRD F1) |
| **File storage** — local `./storage` directory | `src/lib/storage.ts` | S3 or R2; local disk does not work on Vercel |

Not built yet: stack wizard and interview (F2, F3), column-mapping correction (F4), answer editing and approval (F6), export back into the workbook (F8), data deletion (F9), subscriptions.

The landing page describes the finished product (cited answers, export, saved answers). Those features are not implemented, so do not send traffic to it or accept live payments until they are.

## Production notes

- Move to Postgres by changing the Prisma datasource; restore the `embedding` vector column and enums from PRD §4.
- Set `APP_URL` to the public origin; Stripe redirect URLs are built from it.
- Optionally create the $79 Price in Stripe and set `STRIPE_PRICE_SINGLE`; otherwise inline `price_data` is used.
