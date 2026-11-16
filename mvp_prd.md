# MVP PRD — "Attestly" (working name)

> **中文摘要:** MVP 只做一条闭环:注册 → 选择技术栈并回答约 25 个问题生成「答案库」→ 上传客户发来的 XLSX/CSV 安全问卷 → AI 起草带引用和置信度的答案 → 人工审核 → 导出回原表格 → Stripe 付款($79 单次或订阅)。免费版只起草前 25 题,付费墙放在「解锁全部答案并导出」这一步。技术栈:Next.js App Router + Postgres(pgvector)+ Inngest 后台任务 + Stripe Checkout。预计 10–12 个工作日可完成。产品名为暂定,请先查域名和商标。

Stack: Next.js (App Router), React, Node.js, Tailwind, Stripe. The name is a placeholder — check domain and trademark availability before using it.

---

## 1. Problem, user, UVP

**User:** founder or first sales hire at a 2–20 person B2B SaaS, no security team, no SOC 2, hosted on a modern PaaS stack (Vercel / AWS / Supabase / Stripe / Clerk…). An enterprise prospect has just emailed a 150-row security questionnaire and the deal is stalled until it comes back.

**Problem:** first-time completion takes 10–40 hours; existing tools start at $149–$300/month or ~$9.6k/year and assume you already have policies and past answers to feed them.

**UVP:** *"Answer your first security questionnaire in under an hour — even without SOC 2."*

Three things make that true, and the MVP exists to test them:

1. **Stack-aware bootstrap.** The user picks their vendors; we pre-fill what they inherit (e.g. encryption at rest, physical security, the vendor's own attestations) from a curated control library, then ask ~25 plain-English questions about what only they can know (MFA, offboarding, backups, incident contact). Result: a usable answer bank with no prior documents.
2. **Honest answers with citations.** Each draft cites its source (interview answer, uploaded doc, or vendor library entry) and has a confidence level. Unsupported questions become "Needs your input", never a guessed "Yes". Gaps are answered as "No/Partial + compensating control".
3. **Pay per questionnaire.** $79 once, or a subscription if volume justifies it.

**Validation hypothesis:** ≥ 10% of users who see 25 drafted answers pay to unlock the rest.

---

## 2. Scope

### In scope (the minimum to validate the UVP and take the first payment)

| # | Feature | Acceptance criteria |
|---|---|---|
| F1 | Auth + org | Email magic link and Google sign-in. One org is created on first login. |
| F2 | Stack wizard | User selects vendors from ~40 seeded options across hosting, DB, auth, payments, email, monitoring. Selection seeds answer-bank entries from `vendor_controls`. |
| F3 | Security interview | ~25 questions (yes/no/partial + free text). Autosaves. Can be skipped and resumed. Produces answer-bank entries with `source = 'interview'`. |
| F4 | Upload + parse | Accept `.xlsx` and `.csv` up to 10 MB. Detect sheet, header row, question column and answer/comment columns; show a mapping screen the user can correct. Persist one `questions` row per item with its original cell address. |
| F5 | Draft answers | Background job per questionnaire. For each question: retrieve top answer-bank entries → LLM returns structured `{answer_type, answer_text, citations[], confidence}`. Free tier drafts the first 25 questions only. Progress is visible live. |
| F6 | Review UI | Table of question / draft / confidence / sources. Edit inline, approve, "save to answer bank". Filter by low confidence. Bulk-approve high confidence. |
| F7 | Paywall + Stripe | "Unlock all answers + export" → Stripe Checkout: `mode=payment` for the $79 Single, `mode=subscription` for Starter/Growth. Webhook grants entitlement. Customer Portal link for subscribers. |
| F8 | Export | Write approved answers back into a copy of the original workbook at the mapped cells; other sheets and formatting untouched. Download as `.xlsx`. Blocked while unapproved rows exist unless the user confirms. |
| F9 | Data controls | "Delete this questionnaire" and "Delete all my data" actually delete rows and stored files. Public page listing subprocessors and data handling. |

### Out of scope for MVP

Browser extension for web portals (OneTrust, Whistic, etc.), PDF/Word questionnaires, public trust-center page, Slack bot, SSO/SAML, multi-org, team roles beyond owner/member, CRM integrations, policy document generation, API. The Growth plan's "security overview PDF + subprocessor list" and "contradiction check" ship in weeks 3–4; until then sell Growth on quota and seats only, or hide it.

### Explicit non-goals

- No claim that answers are legally or factually verified. The user approves every answer and owns the result (ToS + in-app sign-off checkbox at export).
- No compliance certification of any kind.

---

## 3. Architecture

```
Next.js App Router (Vercel)
 ├─ app/(marketing)            static pages, SEO library, pricing
 ├─ app/(app)                  authenticated UI (RSC + client components)
 ├─ app/api/stripe/webhook     Stripe events (raw body, signature verified)
 ├─ app/api/inngest            job endpoint
 ├─ app/api/upload             signed-URL issue for direct-to-storage upload
 └─ server actions             mutations (answers, bank entries, mapping)

Postgres + pgvector (Neon or Supabase)      Drizzle ORM
Object storage (S3 or R2)                   original and exported workbooks
Inngest                                     parse → draft (fan-out) → finalize
Anthropic API                               answer drafting
Embeddings provider                         answer-bank retrieval vectors
Stripe                                      Checkout, Billing, Customer Portal
Resend                                      magic links, "draft ready" email
```

Key decisions:

- **Jobs:** a 150-question draft exceeds a serverless request budget, so drafting runs as an Inngest function that fans out per question (concurrency ~5 per org), with retries and idempotency on `question_id`. The UI polls `questionnaires.status` and per-question state.
- **Spreadsheet I/O:** `exceljs` for read and write so the export can modify cells in place and preserve the buyer's formatting. CSV is converted to a single-sheet workbook internally.
- **Retrieval:** hybrid — Postgres full-text (`tsvector`) plus pgvector cosine similarity over `answer_bank_entries`, top 6 merged. An answer bank is a few hundred rows, so no separate vector DB.
- **LLM:** `claude-opus-5-5` through the official `@anthropic-ai/sdk`. Use structured outputs (`output_config.format` with a JSON schema) so each response parses into `{answer_type, answer_text, citations, confidence}`; do not rely on forced tool choice or assistant prefill, which this model rejects. Put the stable instructions and company profile first and mark them for prompt caching; put the per-question content last. Always check `stop_reason` before reading content and route refusals or truncations to "Needs your input". Follow the SDK's TypeScript docs for exact call shapes rather than older examples. Cost is ~$3.90 per 150-question questionnaire (see `financial_model.md`); a cheaper model tier is possible but only after an accuracy eval.
- **Prompt rules that carry the UVP:** answer only from supplied evidence; cite entry IDs; if evidence is missing return `needs_input`; never upgrade a "partial" to "yes"; when the honest answer is "no", say so and attach any compensating control present in the evidence.
- **Untrusted input:** questionnaire cells are third-party content. Treat them as data inside the prompt, never as instructions, and strip formulas on import (cells starting with `=`, `+`, `-`, `@`) to prevent formula injection in the export.
- **Multi-tenancy:** every query is scoped by `org_id` in a single data-access layer; add Postgres RLS as a second guard if on Supabase.

---

## 4. Database schema (Postgres)

```sql
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Identity ------------------------------------------------------------
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now()
);

create table organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  stripe_customer_id  text unique,
  plan                text not null default 'free'
                      check (plan in ('free','starter','growth')),
  created_at          timestamptz not null default now()
);

create table memberships (
  org_id   uuid not null references organizations(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  role     text not null default 'owner' check (role in ('owner','member')),
  primary key (org_id, user_id)
);

-- Billing -------------------------------------------------------------
create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id  text not null unique,
  stripe_price_id         text not null,
  status                  text not null,          -- active, past_due, canceled...
  current_period_start    timestamptz not null,
  current_period_end      timestamptz not null,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- One row per questionnaire entitlement: monthly grants and $79 singles.
create table questionnaire_credits (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  source             text not null check (source in ('single_purchase','subscription_period')),
  stripe_ref         text,                        -- checkout session or invoice id
  quantity           int  not null,
  used               int  not null default 0,
  expires_at         timestamptz,                 -- period end for subscription grants
  created_at         timestamptz not null default now(),
  unique (source, stripe_ref)
);

-- Webhook idempotency
create table stripe_events (
  id           text primary key,                  -- Stripe event id
  type         text not null,
  processed_at timestamptz not null default now()
);

-- Knowledge -----------------------------------------------------------
-- Curated, global: what a customer inherits from each vendor.
create table vendor_controls (
  id            uuid primary key default gen_random_uuid(),
  vendor_slug   text not null,                    -- 'vercel', 'aws', 'supabase'
  category      text not null,                    -- 'hosting','database','auth',...
  topic         text not null,                    -- 'encryption_at_rest', ...
  statement     text not null,
  source_url    text not null,
  verified_at   date not null
);
create index on vendor_controls (vendor_slug);

create table org_vendors (
  org_id       uuid not null references organizations(id) on delete cascade,
  vendor_slug  text not null,
  purpose      text,                              -- feeds the subprocessor list
  primary key (org_id, vendor_slug)
);

create table interview_answers (
  org_id        uuid not null references organizations(id) on delete cascade,
  question_key  text not null,                    -- 'mfa_enforced', 'backup_frequency'
  value         text not null check (value in ('yes','no','partial','na')),
  detail        text,
  updated_at    timestamptz not null default now(),
  primary key (org_id, question_key)
);

-- The answer bank: the single source of truth used for retrieval.
create table answer_bank_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  topic         text,
  question_text text not null,                    -- canonical phrasing
  answer_text   text not null,
  answer_type   text not null check (answer_type in ('yes','no','partial','na','text')),
  source        text not null check (source in ('vendor','interview','approved_answer','manual')),
  source_ref    text,                             -- vendor_controls.id / answers.id
  embedding     vector(1024),                     -- match your embedding model's dimension
  fts           tsvector generated always as
                (to_tsvector('english', question_text || ' ' || answer_text)) stored,
  updated_at    timestamptz not null default now()
);
create index on answer_bank_entries (org_id);
create index on answer_bank_entries using gin (fts);
create index on answer_bank_entries using hnsw (embedding vector_cosine_ops);

-- Questionnaires ------------------------------------------------------
create table questionnaires (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  created_by      uuid not null references users(id),
  title           text not null,
  requester_name  text,                           -- the prospect
  original_key    text not null,                  -- object-storage key
  export_key      text,
  column_mapping  jsonb,                          -- {sheet, headerRow, questionCol, answerCol, commentCol}
  status          text not null default 'uploaded'
                  check (status in ('uploaded','mapped','drafting','review','exported','failed')),
  unlocked        boolean not null default false, -- true once a credit is consumed
  credit_id       uuid references questionnaire_credits(id),
  question_count  int not null default 0,
  created_at      timestamptz not null default now()
);
create index on questionnaires (org_id, created_at desc);

create table questions (
  id                uuid primary key default gen_random_uuid(),
  questionnaire_id  uuid not null references questionnaires(id) on delete cascade,
  position          int  not null,
  sheet_name        text not null,
  row_number        int  not null,
  section           text,
  text              text not null,
  unique (questionnaire_id, position)
);

create table answers (
  question_id   uuid primary key references questions(id) on delete cascade,
  answer_type   text check (answer_type in ('yes','no','partial','na','text','needs_input')),
  draft_text    text,
  final_text    text,
  confidence    text check (confidence in ('high','medium','low')),
  citations     jsonb not null default '[]',      -- [{entry_id, quote}]
  status        text not null default 'pending'
                check (status in ('pending','drafted','approved','failed')),
  approved_by   uuid references users(id),
  approved_at   timestamptz,
  model         text,
  input_tokens  int,
  output_tokens int
);

-- Cost and funnel tracking
create table usage_events (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  kind        text not null,                      -- 'draft_question','export','signup',...
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on usage_events (org_id, created_at);
```

Notes: Auth.js needs its own `accounts` / `sessions` / `verification_tokens` tables (use its Drizzle adapter). The embedding dimension must match whichever embedding model you pick.

---

## 5. Stripe flow (first payment)

**Products:** `single_questionnaire` (one-time $79), `starter_monthly` ($49), `growth_monthly` ($129), plus annual prices at 10× monthly.

1. User clicks "Unlock all answers + export" on a questionnaire in `review` with `unlocked = false`.
2. Server action checks for an unused, unexpired credit. If one exists: consume it in a transaction (`used = used + 1 where used < quantity`), set `unlocked = true`, enqueue drafting of the remaining questions. Otherwise:
3. Create a Checkout Session — `mode: 'payment'` or `'subscription'` — with `customer` (create and store `stripe_customer_id` if absent), `client_reference_id = org_id`, and `metadata.questionnaire_id`. Success URL returns to the questionnaire.
4. Webhook `POST /api/stripe/webhook` (Node runtime, raw body, verify signature, insert into `stripe_events` first and exit on conflict):
   - `checkout.session.completed` (payment mode) → insert a `questionnaire_credits` row (quantity 1), consume it for `metadata.questionnaire_id`, enqueue drafting.
   - `checkout.session.completed` (subscription mode) → no entitlement here beyond linking the customer; wait for the invoice event.
   - `invoice.paid` → upsert `subscriptions`, set `organizations.plan`, insert the period's credits (2 or 10) with `expires_at = period end`; on the first invoice also consume one for the pending questionnaire.
   - `customer.subscription.updated` / `.deleted` → sync status and plan; downgrade to `free` at period end.
   - `invoice.payment_failed` → mark `past_due`, email the user (Stripe Smart Retries handles dunning).
5. The success page never grants access itself; it polls until the webhook has set `unlocked = true`.

Use Stripe Tax or at minimum collect billing country from day one; enable the Customer Portal for cancel, plan switch and invoices.

---

## 6. Build plan (≈ 10–12 working days, before the launch clock starts)

| Days | Deliverable |
|---|---|
| 1 | Repo, Drizzle schema, Auth.js, org creation, app shell |
| 2–3 | Vendor control library (seed ~40 vendors × 6–10 controls, each with a source URL), stack wizard, interview, answer-bank generation |
| 4–5 | Upload, parser, column-mapping screen (test against real CAIQ, SIG Lite, and 3 messy custom sheets) |
| 6–7 | Retrieval + drafting job, structured output, progress UI |
| 8 | Review UI, save-to-bank, export writer |
| 9 | Stripe Checkout, webhook, credits, portal |
| 10 | Deletion, data-handling page, ToS/privacy, landing + pricing page |
| 11–12 | Build a 60-question eval set with known-correct answers for a sample company; fix the worst failures; dogfood on two real questionnaires |

The vendor control library is the moat and the main liability: every statement needs a source URL and `verified_at` date, and must describe what the *vendor* attests, not what the customer does.

**Metrics to instrument from day one:** signup → stack completed → first upload → 25 drafts viewed → checkout started → paid → exported; percentage of answers edited before approval (quality proxy); LLM cost per questionnaire.

---

## 7. 14-day cold-start launch plan

Rule for every community below: read the self-promotion rules first, lead with something useful, disclose that you built the tool.

**Pre-launch asset list (finish before Day 1):** landing page with a 90-second demo video; free ungated tool — "Security answer generator: pick your stack, get 20 common questionnaire answers"; 30 SEO pages of the form "How to answer '<common question>' without SOC 2"; a public sample export; ProductHunt draft.

| Day | Action | Target |
|---|---|---|
| 1 | Publish the free generator and SEO pages; submit sitemap. Start a build-in-public thread on X and LinkedIn with the "15-hour questionnaire" story. | Indexing started |
| 2 | Hand-pick 50 small B2B SaaS founders who recently posted about enterprise deals, SOC 2 or questionnaires (X, LinkedIn, Indie Hackers). Send individual messages offering to complete their next questionnaire free in exchange for a 20-minute call. | 10 replies |
| 3 | Indie Hackers post: "I analysed 5 common security questionnaires — the 40 questions that appear in all of them, with answers for a Vercel + Supabase stack". Link to the free tool at the end. | 5 design partners |
| 4 | r/SaaS and r/startups value post: "How we answered an enterprise security questionnaire with no SOC 2 (template inside)". | 100 visits |
| 5 | Run the first design-partner questionnaires yourself, watching over their shoulder. Fix parser failures the same day. | 3 completed exports |
| 6 | Publish a free Google Sheet: "Pre-SOC 2 answer bank template". Share in relevant Slack/Discord founder communities and on LinkedIn. | 50 downloads |
| 7 | Show HN: frame it technically — "Show HN: I mapped what security controls you inherit from Vercel/AWS/Supabase". Be present in comments all day. | Front-page attempt |
| 8 | Collect two written testimonials and one before/after time figure from design partners. Add to landing page. Turn on the paywall for everyone else. | **First Stripe payment** |
| 9 | Outreach to fractional CISOs / vCISO consultants and small compliance consultancies: they do this work for many clients and can resell or refer. Offer a partner discount code. | 5 conversations |
| 10 | **ProductHunt launch** (Tuesday–Thursday, 12:01 am PT). Tagline: "Security questionnaires for SaaS teams without a security team". First comment tells the founder story; notify design partners and your email list. | Top 10 of the day |
| 11 | Follow up every PH and HN signup personally within 24 hours; ask what questionnaire they have pending. | 5 uploads |
| 12 | Post a transparent numbers update (signups, conversion, first revenue) on Indie Hackers, X and r/indiehackers. | Second wave of traffic |
| 13 | Submit to directories (SaaS and AI tool lists, "alternatives" sites); answer existing Reddit, Quora and Stack Exchange questions on answering security questionnaires. Participate helpfully in r/cybersecurity and compliance communities without pitching. | 10 backlinks |
| 14 | Review the funnel. Decide: which one channel produced payers? Double down on it for the next 30 days and drop the rest. | Decision made |

**Targets by Day 14:** 150 signups, 40 uploads, 5–8 payments ($400–$650 revenue, mostly $79 singles), 2 subscribers. If there are zero payments after 40 uploads, the problem is answer quality or trust, not traffic — interview the non-payers before building anything else.

**After launch (the durable channel):** long-tail SEO. Generate a page per `{common question} × {stack}` from the vendor control library — the same asset that powers the product — and per framework ("CAIQ answers for a startup", "SIG Lite without SOC 2"). Enterprise competitors fight over "X alternatives" keywords and ignore these.

---

## 8. Open questions for you

1. Are you comfortable carrying the liability exposure of security answers? A lawyer-reviewed ToS and mandatory human sign-off are required, not optional.
2. Do you have 2–3 founder contacts with a real questionnaire in hand? Dogfooding on real files in the build phase matters more than any feature.
3. Subscription-first or single-first on the pricing page? I recommend leading with the $79 Single until churn data exists.
