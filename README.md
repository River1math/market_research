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

## AI drafting (DeepSeek)

Set `DEEPSEEK_API_KEY` in `.env` to draft with DeepSeek. DeepSeek has no dedicated Node SDK; its API is OpenAI-compatible, so `src/lib/llm.ts` uses the `openai` package pointed at `DEEPSEEK_BASE_URL`. `DEEPSEEK_MODEL` defaults to `deepseek-chat` — confirm the current model name in DeepSeek's docs.

Without a key the app runs in **mock mode**: each draft is copied from the best keyword-matching security fact at low confidence, and the review page says so. Keyword matching can pick the wrong fact; mock mode is for exercising the flow, not for real answers.

How a question is drafted (`src/lib/drafting.ts`):

1. Keyword retrieval over the org's answer bank (`src/lib/retrieval.ts`): the security facts entered on `/app` plus every answer the user has approved.
2. No evidence → "Needs your input", with no model call.
3. Otherwise the model answers from the evidence only and returns JSON with `answer_type`, `answer_text`, `citations`, `confidence`.
4. The reply is validated. An answer whose citations do not resolve to supplied evidence is downgraded to "Needs your input"; an unparseable reply marks the question failed.

Drafting runs after the response via `after()` and the page polls until it finishes.

## What works

| Area | Files | State |
|---|---|---|
| Landing page with $79 Single pricing | `src/app/page.tsx` | Done |
| Database schema | `prisma/schema.prisma` | Done (SQLite adaptation of PRD §4) |
| Security facts (manual answer bank) | `src/app/app/page.tsx`, `src/app/app/actions.ts` | Done; stand-in for the stack wizard and interview |
| Upload + parse `.xlsx` / `.csv` | `src/app/api/upload/route.ts`, `src/lib/parser.ts` | Works; heuristic column detection, no correction screen yet |
| Drafting pipeline, DeepSeek or mock | `src/lib/drafting.ts`, `src/lib/llm.ts`, `src/lib/retrieval.ts` | Done; real mode tested only against a local stand-in server |
| Review: edit, approve, redraft | `src/app/app/q/[id]/page.tsx`, `src/components/AnswerEditor.tsx` | Done; approved answers are saved to the answer bank |
| Free preview paywall (first 25 questions) | `src/app/app/q/[id]/page.tsx` | Done |
| Stripe Checkout, one-time $79 | `src/app/api/checkout/route.ts` | Done |
| Stripe webhook, idempotent credit grant | `src/app/api/stripe/webhook/route.ts`, `src/lib/credits.ts` | Done |
| Export to the original `.xlsx` / `.csv` | `src/lib/export.ts`, `src/app/api/questionnaires/[id]/export/route.ts` | Done; paid questionnaires only |

Export writes each answer into the detected answer column on the question's original row. Approved answers use your wording; unreviewed drafts are exported as drafted; "Needs your input" and failed questions are left blank. exceljs can drop some workbook features (certain conditional formatting, macros), so check heavily formatted files.

## What is stubbed — do not launch with these

| Stub | File | Replace with |
|---|---|---|
| **Auth** — anonymous org id in a cookie | `src/lib/session.ts` | Auth.js with magic link / Google (PRD F1) |
| **File storage** — local `./storage` directory | `src/lib/storage.ts` | S3 or R2; local disk does not work on Vercel |
| **Background work** — `after()` in the request process | `src/lib/schedule.ts` | A job queue (Inngest); serverless time limits would cut off a long run |
| **Retrieval** — keyword overlap | `src/lib/retrieval.ts` | pgvector + full-text on Postgres |

Not built yet: stack wizard and interview (F2, F3), column-mapping correction (F4), data deletion (F9), subscriptions, and an accuracy eval set for the drafting prompt.

## Production notes

- Move to Postgres by changing the Prisma datasource; restore the `embedding` vector column and enums from PRD §4.
- Set `APP_URL` to the public origin; Stripe redirect URLs are built from it.
- Optionally create the $79 Price in Stripe and set `STRIPE_PRICE_SINGLE`; otherwise inline `price_data` is used.
