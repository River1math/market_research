# Financial Model & Unit Economics — "Attestly" (working name)

> **中文摘要:** 产品是面向「没有安全团队、还没做 SOC 2 的小型 B2B SaaS」的安全问卷自动应答工具。定价为 $79 单次 / $49 月付 / $129 月付。按 65% Starter + 35% Growth 的组合,混合 ARPU 为 $77,**需要 65 个付费订阅用户达到 $5,000 MRR**。基准情景下第 11–12 个月达到。本文所有转化率、流失率、CAC 均为**假设值**(已标注),不是实测数据 — 上线后请用真实数据替换。

**Product in one line:** security-questionnaire answering for B2B SaaS teams with no security team and no SOC 2 yet. Upload the buyer's spreadsheet, get cited draft answers built from your actual tech stack, review, export back into the original file.

Everything marked **(assumption)** is my estimate, not measured data. Replace with real numbers after the first 30 days.

---

## 1. Pricing

| Plan | Price | Includes | Who it is for |
|---|---|---|---|
| Free | $0 | Stack-based answer bank + first 25 questions of one questionnaire drafted | Activation; proves answer quality before payment |
| Single | **$79 one-time** | 1 full questionnaire (up to 400 questions), export | Teams that get 1–4 questionnaires a year |
| Starter | **$49 / month** | 2 questionnaires / month, 2 seats, answer bank | Teams with a steady enterprise pipeline |
| Growth | **$129 / month** | 10 questionnaires / month, 5 seats, security overview PDF + subprocessor list, contradiction check | Teams with a sales hire fielding weekly reviews |

Annual billing: 2 months free (improves cash flow and cuts churn; not modelled below).

Why this shape: the main competitor price points are $149–$300/month subscriptions or ~$9.6k/year contracts (see `competitor_analysis.csv`), but a small SaaS typically receives a handful of questionnaires a year. The $79 single purchase matches that usage and is the low-friction first Stripe payment; the subscription captures teams whose volume grows.

---

## 2. Exact math to $5,000 MRR

Only subscriptions count toward MRR. Single purchases are extra, non-recurring revenue.

**Assumed paid mix (assumption):** 65% Starter, 35% Growth.

```
Blended ARPU = 0.65 × $49 + 0.35 × $129
             = $31.85 + $45.15
             = $77.00 per subscriber per month

Subscribers needed = $5,000 ÷ $77.00 = 64.94  →  65 subscribers

Check: 42 Starter × $49  = $2,058
       23 Growth  × $129 = $2,967
       Total             = $5,025 MRR  ✔
```

Sensitivity to mix:

| Mix | ARPU | Subscribers for $5k MRR |
|---|---|---|
| 100% Starter | $49 | 5,000 ÷ 49 = 102.04 → **103** |
| 80 / 20 | $65 | 5,000 ÷ 65 = 76.9 → **77** |
| **65 / 35 (base)** | **$77** | **65** |
| 50 / 50 | $89 | 5,000 ÷ 89 = 56.2 → **57** |
| 100% Growth | $129 | 5,000 ÷ 129 = 38.76 → **39** |

**Funnel required to hold 65 subscribers (all assumptions):**

- Visitor → free signup: 4%
- Free signup → any payment (single or subscription): 12%
- Of payers, 45% subscribe and 55% buy a single

To add 13 new subscribers in a month (month-12 pace): 13 ÷ 0.45 = 29 payers → 29 ÷ 0.12 = 242 signups → 242 ÷ 0.04 = **~6,000 targeted visitors/month**. That traffic level is the real constraint, and it is why the PRD puts SEO pages and a free tool in the launch plan.

---

## 3. Operating costs

### Fixed monthly costs

| Item | Month 1–3 | Month 10–12 | Notes |
|---|---|---|---|
| Vercel Pro | $20 | $20 | Next.js hosting |
| Postgres (Neon or Supabase, with pgvector) | $25 | $50 | |
| Background jobs (Inngest) | $0 | $25 | Free tier covers early volume |
| Object storage (S3/R2) | $1 | $5 | Uploaded spreadsheets and docs |
| Transactional email (Resend) | $0 | $20 | |
| Analytics + error tracking | $9 | $9 | Privacy-friendly analytics; Sentry free tier |
| Domain, misc. | $25 | $21 | |
| **Total fixed** | **~$80** | **~$150** | |

These are typical list prices as I understand them; confirm on each vendor's pricing page.

### Variable cost: LLM per questionnaire

Model: `claude-opus-5-5` at $4.00 / 1M input tokens and $20.00 / 1M output tokens (Anthropic first-party list price, cached 2026-11-03).

```
Average questionnaire        = 150 questions            (assumption)
Input per question           = 3,500 tokens (profile + retrieved evidence + question)
Output per question          = 600 tokens (answer + citations + reasoning)

Input cost  = 150 × 3,500 = 525,000 tokens × $4.00/1M  = $2.10
Output cost = 150 ×   600 =  90,000 tokens × $20.00/1M = $1.80
LLM cost per questionnaire                             ≈ $3.90
```

Levers if this needs to come down (your decision, test quality first): prompt caching on the stable company-profile prefix, or a cheaper tier — `claude-sonnet-5-5` ($2 / $10) roughly halves it and `claude-haiku-5-5` ($0.10 / $0.50) cuts it by ~97%. Answer accuracy is the whole product, so I would not downgrade without an eval set.

### Variable cost per subscriber per month

```
LLM:    1.2 questionnaires/month × $3.90            = $4.68   (usage is an assumption)
Stripe: 2.9% + $0.30 card fee + 0.7% Billing fee
        = 3.6% × $77 + $0.30                        = $3.07
Total variable cost                                 = $7.75

Gross margin = ($77.00 − $7.75) ÷ $77.00 = 89.9%  ≈ 90%
```

Single purchase margin: $79 − $3.90 LLM − ($79 × 2.9% + $0.30 = $2.59) = $72.51 → 91.8%.

---

## 4. CAC

| Measure | Calculation | Result |
|---|---|---|
| Cash CAC per subscriber | $3,000 total 12-month marketing spend ÷ 89 new subscribers | **≈ $34** |
| Cash CAC per paying customer (incl. singles) | $3,000 ÷ (89 + 101) | **≈ $16** |
| Fully-loaded CAC | ($3,000 + 40 h/month × 12 × $50/h founder time = $27,000) ÷ 89 | **≈ $303** |

The cash figure looks excellent only because distribution is founder labour (content, community, cold outreach). Judge channels against the **$303** number. If you later buy ads, expect B2B SaaS-founder clicks at several dollars each; at the funnel rates in section 2 a subscriber would cost roughly `CPC ÷ (0.04 × 0.12 × 0.45)` = `CPC × 463`, i.e. a $3 click → ~$1,390 CAC. **Paid ads do not work at this price point; do not run them.**

---

## 5. LTV

**Monthly subscriber churn (assumption): 6%.** This is deliberately pessimistic. Questionnaires are bursty, so small teams will cancel between deals; the answer bank and the "pause plan" option are the retention levers.

```
Contribution per subscriber per month = $77.00 − $7.75 = $69.25
Expected lifetime                     = 1 ÷ 0.06 = 16.7 months
LTV                                   = $69.25 ÷ 0.06 = $1,154
```

| Churn | Lifetime | LTV | LTV : loaded CAC ($303) | LTV : cash CAC ($34) |
|---|---|---|---|---|
| 4% | 25.0 mo | $1,731 | 5.7 | 51 |
| **6% (base)** | **16.7 mo** | **$1,154** | **3.8** | **34** |
| 9% | 11.1 mo | $769 | 2.5 | 23 |

Payback on loaded CAC: $303 ÷ $69.25 = **4.4 months**.

At 9% churn the business still works on cash but the loaded ratio drops below 3 — that is the signal to push annual plans and the single-purchase path rather than monthly subscriptions.

---

## 6. 12-month projection (base case)

Assumptions: 6% monthly churn applied to opening subscribers; blended ARPU $77; singles at $79; LLM cost includes free-tier usage (three free signups per payer, each consuming ~20% of a questionnaire); Stripe at 3.6% + $0.30 per transaction.

| Month | New subs | Churned | Subs (end) | MRR | Single sales | Total revenue | Fixed | LLM | Stripe | Marketing | Net | Cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 1 | $77 | $158 | $235 | $80 | $20 | $9 | $100 | $26 | $26 |
| 2 | 3 | 0 | 4 | $308 | $316 | $624 | $80 | $51 | $25 | $150 | $318 | $345 |
| 3 | 4 | 0 | 8 | $616 | $395 | $1,011 | $80 | $78 | $40 | $150 | $663 | $1,007 |
| 4 | 5 | 0 | 13 | $1,001 | $474 | $1,475 | $95 | $110 | $59 | $200 | $1,011 | $2,018 |
| 5 | 6 | 1 | 18 | $1,386 | $553 | $1,939 | $95 | $142 | $77 | $200 | $1,425 | $3,443 |
| 6 | 7 | 1 | 24 | $1,848 | $632 | $2,480 | $95 | $179 | $99 | $250 | $1,858 | $5,301 |
| 7 | 8 | 1 | 31 | $2,387 | $711 | $3,098 | $120 | $220 | $124 | $250 | $2,385 | $7,685 |
| 8 | 9 | 2 | 38 | $2,926 | $790 | $3,716 | $120 | $261 | $148 | $300 | $2,887 | $10,572 |
| 9 | 10 | 2 | 46 | $3,542 | $869 | $4,411 | $120 | $307 | $176 | $300 | $3,508 | $14,080 |
| 10 | 11 | 3 | 54 | $4,158 | $948 | $5,106 | $150 | $353 | $204 | $350 | $4,049 | $18,129 |
| 11 | 12 | 3 | 63 | $4,851 | $1,027 | $5,878 | $150 | $404 | $234 | $350 | $4,740 | $22,868 |
| 12 | 13 | 4 | 72 | **$5,544** | $1,106 | $6,650 | $150 | $455 | $265 | $400 | $5,380 | $28,248 |

"Net" excludes founder salary and taxes.

### MRR milestones

| Milestone | Subscribers | Base case | What must be true |
|---|---|---|---|
| First payment | 1 (likely a $79 single) | Week 2–3 | Launch plan executed; free tier shows convincing answers |
| $500 MRR | 7 | Month 3 | A repeatable channel identified (which post/page produced the payers?) |
| $1,000 MRR | 13 | Month 4 | Single buyers converting to subscriptions on their second questionnaire |
| $2,500 MRR | 33 | Month 7–8 | SEO pages indexed and bringing >2,000 visits/month |
| **$5,000 MRR** | **65** | **Month 11–12** | ~6,000 targeted visits/month, churn ≤ 6% |

### Downside case

Halve new subscribers and raise churn to 9%: month-12 lands near 30 subscribers / ~$2,300 MRR. Still cash-positive (costs are ~$400/month) but not a living. **Kill / pivot criteria:** fewer than 5 paying customers of any kind by day 45, or fewer than 15% of single buyers returning for a second questionnaire within 6 months.

---

## 7. Risks that move these numbers

1. **Free tiers from funded players.** Vanta and 1up already have free plans. They cap out below one full questionnaire, but that can change overnight. Defence: the pre-SOC 2 / stack-aware wedge and the single-purchase price, not being cheaper.
2. **Bursty usage → churn.** The 6% assumption is the most fragile number here. Track it from month 2.
3. **Trust.** Customers upload sensitive security detail to a solo-founder tool. Expect this to depress signup→upload conversion until there is a clear data-handling page, deletion controls, and a few named customers.
4. **Liability.** A wrong "Yes" in a questionnaire can become a contractual misrepresentation for the customer. The product must force human sign-off and never assert unconfirmed controls; the ToS must say the customer owns the final answers. Have a lawyer review the ToS before charging.
5. **Research limits.** Competitor prices came from web search across third-party listings and vendor blogs, several of them conflicting. The two Indie Hackers threads that evidence founder pain could not be opened from this environment (host blocked), so I relied on their titles and search summaries. Verify prices on vendor sites before using them in marketing.
