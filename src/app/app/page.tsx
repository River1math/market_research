import Link from "next/link";
import { saveFacts } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { UploadForm } from "@/components/UploadForm";
import { db } from "@/lib/db";
import { FREE_QUESTION_LIMIT, PRODUCT_NAME, SINGLE_PRICE_LABEL } from "@/lib/config";
import { getOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

const FACTS_PLACEHOLDER = `One fact per line, for example:
Customer data is encrypted at rest with AES-256 by our database provider.
MFA is enforced for all employees with production access.
Backups run daily and restores are tested quarterly.
We do not have a SOC 2 report yet; our hosting providers are SOC 2 audited.`;

export default async function AppHome() {
  const orgId = await getOrgId();
  const [questionnaires, facts] = orgId
    ? await Promise.all([
        db.questionnaire.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } }),
        db.answerBankEntry.findMany({
          where: { orgId, source: "manual" },
          orderBy: { updatedAt: "asc" },
          select: { answerText: true },
        }),
      ])
    : [[], []];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-brand">
        ← {PRODUCT_NAME}
      </Link>

      <section className="mt-6">
        <h1 className="text-2xl font-bold">1. Tell us what&apos;s true about your security</h1>
        <p className="mt-2 text-slate-600">
          Answers are drafted only from these facts and from answers you approve. Anything not covered
          is left for you — nothing is guessed.
        </p>
        <form action={saveFacts} className="mt-4">
          <label htmlFor="facts" className="sr-only">
            Security facts, one per line
          </label>
          <textarea
            id="facts"
            name="facts"
            rows={7}
            defaultValue={facts.map((f) => f.answerText).join("\n")}
            placeholder={FACTS_PLACEHOLDER}
            className="block w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="mt-3 flex items-center gap-3">
            <SubmitButton
              pendingLabel="Saving…"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Save facts
            </SubmitButton>
            <span className="text-sm text-slate-500">
              {facts.length} {facts.length === 1 ? "fact" : "facts"} saved
            </span>
          </div>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">2. Upload a security questionnaire</h2>
        <p className="mt-2 text-slate-600">
          The first {FREE_QUESTION_LIMIT} answers are drafted free. Unlock the rest and the export for{" "}
          {SINGLE_PRICE_LABEL}.
        </p>
        <div className="mt-4">
          <UploadForm />
        </div>
      </section>

      {questionnaires.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Your questionnaires</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {questionnaires.map((q) => (
              <li key={q.id}>
                <Link href={`/app/q/${q.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0 truncate font-medium">{q.title}</span>
                  <span className="shrink-0 text-sm text-slate-500">
                    {q.questionCount} questions · {q.unlocked ? "Unlocked" : "Free preview"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
