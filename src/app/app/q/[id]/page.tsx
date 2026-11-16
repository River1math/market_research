import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentPending } from "@/components/PaymentPending";
import { UnlockButton } from "@/components/UnlockButton";
import { db } from "@/lib/db";
import { FREE_QUESTION_LIMIT, SINGLE_PRICE_LABEL } from "@/lib/config";
import type { ColumnMapping } from "@/lib/parser";
import { getOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

export default async function QuestionnairePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { checkout } = await searchParams;

  const orgId = await getOrgId();
  if (!orgId) notFound();

  const questionnaire = await db.questionnaire.findFirst({
    where: { id, orgId },
    include: { questions: { orderBy: { position: "asc" }, include: { answer: true } } },
  });
  if (!questionnaire) notFound();

  const mapping = questionnaire.columnMapping
    ? (JSON.parse(questionnaire.columnMapping) as ColumnMapping)
    : null;
  const lockedCount = questionnaire.unlocked
    ? 0
    : Math.max(0, questionnaire.questionCount - FREE_QUESTION_LIMIT);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/app" className="text-sm font-semibold text-brand">
        ← All questionnaires
      </Link>
      <h1 className="mt-4 break-words text-2xl font-bold">{questionnaire.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {questionnaire.questionCount} questions found
        {mapping && (
          <>
            {" "}
            in sheet “{mapping.sheet}”, column {columnLetter(mapping.questionCol)}
            {mapping.headerRow > 0 && `, header on row ${mapping.headerRow}`}
          </>
        )}
        .
      </p>

      <div className="mt-6 space-y-4">
        {checkout === "success" && !questionnaire.unlocked && <PaymentPending />}
        {checkout === "success" && questionnaire.unlocked && (
          <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Payment confirmed. All answers are unlocked.
          </div>
        )}
        {checkout === "cancelled" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            Checkout was cancelled. You have not been charged.
          </div>
        )}

        {lockedCount > 0 && checkout !== "success" && (
          <div className="flex flex-col gap-4 rounded-xl border border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                {lockedCount} more {lockedCount === 1 ? "answer is" : "answers are"} locked
              </p>
              <p className="text-sm text-slate-600">
                One payment of {SINGLE_PRICE_LABEL} drafts every answer and unlocks the export. No subscription.
              </p>
            </div>
            <UnlockButton questionnaireId={questionnaire.id} label={`Unlock all for ${SINGLE_PRICE_LABEL}`} />
          </div>
        )}
      </div>

      <ol className="mt-8 space-y-3">
        {questionnaire.questions.map((q) => {
          const locked = !questionnaire.unlocked && q.position > FREE_QUESTION_LIMIT;
          return (
            <li key={q.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">{q.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{q.text}</p>
                  {locked ? (
                    <p className="mt-2 text-sm text-slate-400">Locked — unlock to draft this answer.</p>
                  ) : q.answer ? (
                    <div className="mt-2 text-sm">
                      <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {q.answer.answerType === "needs_input" ? "Needs your input" : q.answer.answerType}
                      </span>
                      <span className="text-slate-600">{q.answer.finalText ?? q.answer.draftText}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Drafting…</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function columnLetter(col: number): string {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}
