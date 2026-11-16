import Link from "next/link";
import { FREE_QUESTION_LIMIT, MAX_QUESTIONS, PRODUCT_NAME, SINGLE_PRICE_LABEL } from "@/lib/config";

const steps = [
  {
    title: "Upload the buyer's spreadsheet",
    body: "Drop in the .xlsx or .csv exactly as your prospect sent it. We find the question column for you.",
  },
  {
    title: "Review cited draft answers",
    body: "Each answer shows where it came from and how confident it is. Anything we can't support is flagged for you instead of guessed.",
  },
  {
    title: "Export into the original file",
    body: "Approved answers are written back into the buyer's own format, ready to send.",
  },
];

const faqs = [
  {
    q: "We don't have SOC 2. Will this still work?",
    a: "Yes — that is who it is built for. Answers are based on what you actually do and what your hosting vendors attest. Where the honest answer is “no”, the draft says so and adds any compensating control you have.",
  },
  {
    q: "Is it a subscription?",
    a: `No. ${SINGLE_PRICE_LABEL} covers one questionnaire of up to ${MAX_QUESTIONS} questions. You pay again only when the next questionnaire arrives.`,
  },
  {
    q: "What do I get before paying?",
    a: `The first ${FREE_QUESTION_LIMIT} answers of your real questionnaire, so you can judge the quality on your own file.`,
  },
  {
    q: "Who is responsible for the final answers?",
    a: "You are. Every answer is a draft until you approve it, and nothing is exported without your sign-off.",
  },
  {
    q: "What happens to the files I upload?",
    a: "They are used only to draft your answers. You can delete a questionnaire, or all of your data, at any time.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-lg font-bold tracking-tight">{PRODUCT_NAME}</span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" className="hidden text-slate-600 hover:text-ink sm:inline">
            How it works
          </a>
          <a href="#pricing" className="hidden text-slate-600 hover:text-ink sm:inline">
            Pricing
          </a>
          <Link href="/app" className="rounded-md bg-ink px-4 py-2 font-semibold text-white hover:bg-slate-700">
            Upload a questionnaire
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-10 lg:grid-cols-2 lg:items-center lg:pt-16">
          <div>
            <p className="inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
              For SaaS teams without a security team
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Answer the security questionnaire that&apos;s blocking your deal — today.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Upload the spreadsheet your prospect sent. Get draft answers with sources, review them, and
              export back into the original file. Works even if you don&apos;t have SOC 2 yet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/app"
                className="rounded-md bg-brand px-6 py-3 text-center font-semibold text-white hover:bg-brand-dark"
              >
                Try it free on your questionnaire
              </Link>
              <span className="text-sm text-slate-500">
                First {FREE_QUESTION_LIMIT} answers free · then {SINGLE_PRICE_LABEL} once
              </span>
            </div>
            <ul className="mt-8 space-y-2 text-sm text-slate-600">
              <li>✓ No subscription and no sales call</li>
              <li>✓ Never invents a “Yes” — gaps are flagged for you</li>
              <li>✓ You approve every answer before export</li>
            </ul>
          </div>

          {/* Product illustration (static sample, not customer data) */}
          <div aria-label="Example of drafted answers" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Example</p>
            <div className="mt-3 space-y-3">
              <SampleAnswer
                question="Is customer data encrypted at rest?"
                badge="Yes"
                tone="good"
                answer="Yes. Customer data is stored in our managed database, which encrypts data at rest using AES-256."
                source="Source: your hosting provider's security documentation"
              />
              <SampleAnswer
                question="Do you hold a current SOC 2 Type II report?"
                badge="No"
                tone="warn"
                answer="Not at this time. Our infrastructure providers are SOC 2 audited, and we can share our security overview and their reports on request."
                source="Source: your interview answers"
              />
              <SampleAnswer
                question="How often are restore tests performed?"
                badge="Needs your input"
                tone="todo"
                answer="We couldn't find evidence for this. Add your answer and we'll remember it for next time."
              />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">A 150-row spreadsheet shouldn&apos;t cost you the deal</h2>
            <p className="mt-4 text-lg text-slate-600">
              Enterprise buyers send the questionnaire, and the deal waits until it comes back. Filling it in
              by hand can take days the first time. The tools built for this start at hundreds of dollars a
              month and expect you to already have policies and an audit. You need this one answered.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-slate-200 p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">Pay per questionnaire</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              Most small teams get a handful of these a year. So there is no monthly fee.
            </p>

            <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2">
                <h3 className="font-semibold">Free preview</h3>
                <p className="mt-3 text-4xl font-bold">$0</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  <li>✓ Upload your real questionnaire</li>
                  <li>✓ First {FREE_QUESTION_LIMIT} answers drafted</li>
                  <li>✓ No card required</li>
                </ul>
                <Link
                  href="/app"
                  className="mt-6 block rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50"
                >
                  Start free
                </Link>
              </div>

              <div className="rounded-2xl border-2 border-brand bg-white p-6 shadow-lg md:col-span-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Single questionnaire</h3>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    One-time payment
                  </span>
                </div>
                <p className="mt-3">
                  <span className="text-5xl font-bold">{SINGLE_PRICE_LABEL}</span>
                  <span className="ml-2 text-slate-500">per questionnaire</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                  <li>✓ Every answer drafted, up to {MAX_QUESTIONS} questions</li>
                  <li>✓ Sources and confidence on each answer</li>
                  <li>✓ Export into the buyer&apos;s original spreadsheet</li>
                  <li>✓ Approved answers saved for your next questionnaire</li>
                </ul>
                <Link
                  href="/app"
                  className="mt-6 block rounded-md bg-brand px-4 py-3 text-center font-semibold text-white hover:bg-brand-dark"
                >
                  Upload a questionnaire
                </Link>
                <p className="mt-3 text-center text-xs text-slate-500">
                  You pay only after seeing your first {FREE_QUESTION_LIMIT} answers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ink">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">Send it back this afternoon</h2>
            <p className="mt-3 text-slate-300">
              Upload the questionnaire and see your first {FREE_QUESTION_LIMIT} answers before you pay anything.
            </p>
            <Link
              href="/app"
              className="mt-8 inline-block rounded-md bg-white px-6 py-3 font-semibold text-ink hover:bg-slate-100"
            >
              Upload a questionnaire
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        © {new Date().getFullYear()} {PRODUCT_NAME}. Drafts are not legal or compliance advice.
      </footer>
    </div>
  );
}

const tones = {
  good: "bg-emerald-100 text-emerald-900",
  warn: "bg-amber-100 text-amber-900",
  todo: "bg-slate-200 text-slate-700",
} as const;

function SampleAnswer(props: {
  question: string;
  badge: string;
  tone: keyof typeof tones;
  answer: string;
  source?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{props.question}</p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${tones[props.tone]}`}>
          {props.badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{props.answer}</p>
      {props.source && <p className="mt-2 text-xs text-slate-400">{props.source}</p>}
    </div>
  );
}
