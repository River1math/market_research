import { db } from "./db";
import { FREE_QUESTION_LIMIT } from "./config";
import { draftWithLlm, llmEnabled, type Draft } from "./llm";
import { evidenceText, findEvidence, type BankEntry, type Evidence } from "./retrieval";

/**
 * Drafting pipeline (PRD F5).
 *
 * For each question: retrieve evidence from the org's answer bank, then
 *   - no evidence            → needs_input, without calling the model;
 *   - DEEPSEEK_API_KEY set   → DeepSeek drafts from the evidence;
 *   - no key (mock mode)     → the best-matching entry is copied verbatim.
 *
 * Runs after the HTTP response via next/server `after()`. That is fine
 * locally and for short runs; move to a job queue (Inngest) before
 * production, where serverless time limits would cut off a 400-question run.
 */
const CONCURRENCY = 5;
/** A run whose heartbeat is older than this is considered dead and can be taken over. */
const STALE_MS = 5 * 60 * 1000;
/** Mock mode only copies an entry that shares at least this much with the question. */
const MOCK_MIN_SCORE = 0.5;

export const NO_EVIDENCE_NOTE = "Nothing in your security facts covers this yet.";

export async function draftAnswers(questionnaireId: string): Promise<void> {
  if (!(await claim(questionnaireId))) return; // another run is active and will pick up new work

  try {
    // Loop: an unlock can widen the set of eligible questions mid-run.
    for (;;) {
      const questionnaire = await db.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { orgId: true, unlocked: true },
      });
      if (!questionnaire) return;

      const pending = await pendingQuestions(questionnaireId, questionnaire.unlocked);
      if (pending.length === 0) break;

      const bank = await db.answerBankEntry.findMany({
        where: { orgId: questionnaire.orgId },
        select: { id: true, questionText: true, answerText: true, source: true },
      });

      await runPool(pending, CONCURRENCY, async (question) => {
        await draftOne(question, bank);
        await db.questionnaire.update({
          where: { id: questionnaireId },
          data: { draftingStartedAt: new Date() }, // heartbeat
        });
      });
    }
  } finally {
    await db.questionnaire.updateMany({
      where: { id: questionnaireId },
      data: { status: "review", draftingStartedAt: null },
    });
  }

  // Closes the gap where an unlock landed between the last check and the
  // release above, and that unlock's own draftAnswers call lost the claim.
  const after = await db.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { unlocked: true },
  });
  if (after && (await pendingQuestions(questionnaireId, after.unlocked)).length > 0) {
    await draftAnswers(questionnaireId);
  }
}

/** Atomically mark the questionnaire as being drafted. False if another live run holds it. */
async function claim(questionnaireId: string): Promise<boolean> {
  const claimed = await db.questionnaire.updateMany({
    where: {
      id: questionnaireId,
      OR: [
        { status: { not: "drafting" } },
        { draftingStartedAt: null },
        { draftingStartedAt: { lt: new Date(Date.now() - STALE_MS) } },
      ],
    },
    data: { status: "drafting", draftingStartedAt: new Date() },
  });
  return claimed.count === 1;
}

/** Questions with no Answer row yet that the current entitlement covers. */
function pendingQuestions(questionnaireId: string, unlocked: boolean) {
  return db.question.findMany({
    where: {
      questionnaireId,
      answer: null,
      ...(unlocked ? {} : { position: { lte: FREE_QUESTION_LIMIT } }),
    },
    select: { id: true, text: true },
    orderBy: { position: "asc" },
  });
}

async function draftOne(question: { id: string; text: string }, bank: BankEntry[]) {
  const evidence = findEvidence(question.text, bank);

  let data;
  try {
    const draft =
      evidence.length === 0
        ? needsInput("none")
        : llmEnabled()
          ? await draftWithLlm(question.text, evidence)
          : mockDraft(evidence);

    const cited = evidence.filter((e) => draft.citedEntryIds.includes(e.entry.id));
    data = {
      answerType: draft.answerType,
      draftText: draft.answerType === "needs_input" ? NO_EVIDENCE_NOTE : draft.answerText,
      confidence: draft.confidence,
      citations: JSON.stringify(cited.map((e) => ({ entryId: e.entry.id, quote: evidenceText(e.entry) }))),
      status: "drafted",
      model: draft.model,
      inputTokens: draft.inputTokens ?? null,
      outputTokens: draft.outputTokens ?? null,
    };
  } catch (err) {
    // One bad question must not sink the run. A "failed" row also takes the
    // question out of the pending set so the loop terminates; "Redraft"
    // clears failed rows for another attempt.
    console.error(`[drafting] question ${question.id} failed:`, (err as Error).message);
    data = { answerType: null, draftText: null, confidence: null, citations: "[]", status: "failed", model: null };
  }

  // The question may have been deleted while the model call was in flight.
  const exists = await db.question.findUnique({ where: { id: question.id }, select: { id: true } });
  if (!exists) return;
  await db.answer.upsert({
    where: { questionId: question.id },
    create: { questionId: question.id, ...data },
    update: {}, // never overwrite: a user edit may have landed first
  });
}

function needsInput(model: string): Draft {
  return { answerType: "needs_input", answerText: "", confidence: "low", citedEntryIds: [], model };
}

/** Mock mode: no model call. Copies the single best-matching entry, always at low confidence. */
function mockDraft(evidence: Evidence[]): Draft {
  const best = evidence[0];
  if (!best || best.score < MOCK_MIN_SCORE) return needsInput("mock");
  return {
    answerType: "text",
    answerText: best.entry.answerText,
    confidence: "low",
    citedEntryIds: [best.entry.id],
    model: "mock",
  };
}

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}
