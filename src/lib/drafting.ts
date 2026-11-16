import { db } from "./db";
import { FREE_QUESTION_LIMIT } from "./config";

/**
 * STUB DRAFTING — creates placeholder Answer rows so the review screen and
 * the paywall can be exercised end to end.
 *
 * The real implementation (PRD F5) should:
 *   1. run as a background job (Inngest), fanned out per question;
 *   2. retrieve the top answer-bank entries for the question;
 *   3. call the LLM with structured output
 *      {answer_type, answer_text, citations[], confidence};
 *   4. store `needs_input` whenever evidence is missing — never guess "Yes".
 *
 * Until then every draft is `needs_input`, which is the honest value.
 *
 * Safe to call repeatedly: questions that already have an Answer are skipped.
 */
export async function draftAnswers(questionnaireId: string): Promise<number> {
  const questionnaire = await db.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { unlocked: true },
  });
  if (!questionnaire) return 0;

  const pending = await db.question.findMany({
    where: {
      questionnaireId,
      answer: null,
      ...(questionnaire.unlocked ? {} : { position: { lte: FREE_QUESTION_LIMIT } }),
    },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  for (const q of pending) {
    await db.answer.create({
      data: {
        questionId: q.id,
        answerType: "needs_input",
        draftText: "Draft placeholder — answer generation is not connected yet.",
        confidence: "low",
        status: "drafted",
        model: "stub",
      },
    });
  }

  await db.questionnaire.update({ where: { id: questionnaireId }, data: { status: "review" } });
  return pending.length;
}
