import Link from "next/link";
import { notFound } from "next/navigation";
import { redraft } from "../../actions";
import { AnswerEditor } from "@/components/AnswerEditor";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PaymentPending } from "@/components/PaymentPending";
import { SubmitButton } from "@/components/SubmitButton";
import { UnlockButton } from "@/components/UnlockButton";
import { db } from "@/lib/db";
import { FREE_QUESTION_LIMIT, SINGLE_PRICE_LABEL } from "@/lib/config";
import { exportText } from "@/lib/export";
import { llmEnabled } from "@/lib/llm";
import type { ColumnMapping } from "@/lib/parser";
import { getOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

const TYPE_LABEL: Record<string, string> = {
  yes: "Yes",
  no: "No",
  partial: "Partial",
  na: "N/A",
  text: "Answer",
  needs_input: "Needs your input",
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
  const isLocked = (position: number) => !questionnaire.unlocked && position > FREE_QUESTION_LIMIT;

  const open = questionnaire.questions.filter((q) => !isLocked(q.position));
  const lockedCount = questionnaire.questionCount - open.length;
  const waiting = open.filter((q) => !q.answer).length;
  const approved = open.filter((q) => q.answer?.status === "approved").length;
  const ready = open.filter((q) => exportText(q.answer) !== null).length;
  const blank = open.length - ready;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {waiting > 0 && <AutoRefresh />}
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
            {mapping.headerRow > 0 && `, header on row ${mapping.headerRow}`}. Answers go in column{" "}
            {columnLetter(mapping.answerCol)}
          </>
        )}
        .
      </p>

      <div className="mt-6 space-y-4">
        {!llmEnabled() && (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
            <strong>Mock mode.</strong> No DeepSeek API key is set, so drafts are copied from your
            best-matching security fact instead of being written by a model.
          </div>
        )}
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

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold">
              {waiting > 0
                ? `Drafting… ${open.length - waiting} of ${open.length} done`
                : `${ready} of ${open.length} answers ready · ${approved} approved by you`}
            </p>
            {waiting === 0 && blank > 0 && (
              <p className="mt-1 text-slate-600">
                {blank} {blank === 1 ? "question still needs" : "questions still need"} your input and will
                be left blank in the export.
              </p>
            )}
            {waiting === 0 && ready > approved && (
              <p className="mt-1 text-slate-600">
                {ready - approved} {ready - approved === 1 ? "draft has" : "drafts have"} not been reviewed.
                Read them before you send the file — you are responsible for every answer.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <form action={redraft}>
              <input type="hidden" name="questionnaireId" value={questionnaire.id} />
              <SubmitButton
                pendingLabel="Starting…"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                Redraft unapproved
              </SubmitButton>
            </form>
            {questionnaire.unlocked && waiting === 0 && (
              <a
                href={`/api/questionnaires/${questionnaire.id}/export`}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Download completed file
              </a>
            )}
          </div>
        </div>
      </div>

      <ol className="mt-8 space-y-3">
        {questionnaire.questions.map((q) => {
          const a = q.answer;
          const citations = a ? (JSON.parse(a.citations) as { entryId: string; quote: string }[]) : [];
          return (
            <li key={q.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">{q.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{q.text}</p>
                  {isLocked(q.position) ? (
                    <p className="mt-2 text-sm text-slate-400">Locked — unlock to draft this answer.</p>
                  ) : !a ? (
                    <p className="mt-2 text-sm text-slate-400">Drafting…</p>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {a.status === "failed" ? (
                          <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-900">
                            Drafting failed — write an answer or redraft
                          </span>
                        ) : (
                          <span
                            className={`rounded px-2 py-0.5 font-medium ${
                              a.answerType === "needs_input" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {TYPE_LABEL[a.answerType ?? "text"] ?? a.answerType}
                          </span>
                        )}
                        {a.status === "drafted" && a.answerType !== "needs_input" && a.confidence && (
                          <span className="text-slate-500">{a.confidence} confidence</span>
                        )}
                        {a.status === "drafted" && a.answerType === "needs_input" && (
                          <span className="text-slate-500">{a.draftText}</span>
                        )}
                      </div>
                      <AnswerEditor
                        // Remount when a redraft replaces the draft text.
                        key={`${a.status}:${a.draftText ?? ""}`}
                        questionId={q.id}
                        initialText={a.finalText ?? (a.answerType === "needs_input" ? "" : (a.draftText ?? ""))}
                        approved={a.status === "approved"}
                      />
                      {a.status === "drafted" && citations.length > 0 && (
                        <p className="mt-2 break-words text-xs text-slate-500">
                          <span className="font-medium">Based on:</span>{" "}
                          {citations.map((c) => `“${c.quote.replace(/\s+/g, " ").slice(0, 160)}”`).join(" · ")}
                        </p>
                      )}
                    </>
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
