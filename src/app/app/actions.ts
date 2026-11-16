"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FREE_QUESTION_LIMIT } from "@/lib/config";
import { scheduleDrafting } from "@/lib/schedule";
import { getOrCreateOrgId, getOrgId } from "@/lib/session";

const MAX_FACTS = 200;
const MAX_FACT_LENGTH = 500;
const MAX_ANSWER_LENGTH = 4000;

/**
 * Replace the org's manually entered security facts (one per line).
 * These are the evidence the drafting pipeline answers from until the stack
 * wizard and interview (PRD F2/F3) exist.
 */
export async function saveFacts(formData: FormData) {
  const orgId = await getOrCreateOrgId();
  const facts = String(formData.get("facts") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, MAX_FACT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_FACTS);

  await db.$transaction([
    db.answerBankEntry.deleteMany({ where: { orgId, source: "manual" } }),
    db.answerBankEntry.createMany({
      data: facts.map((fact) => ({
        orgId,
        questionText: "",
        answerText: fact,
        answerType: "text",
        source: "manual",
      })),
    }),
  ]);
  revalidatePath("/app");
}

/** Save the user's wording for one answer and mark it approved. */
export async function saveAnswer(questionId: string, text: string): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not signed in." };

  const finalText = text.trim().slice(0, MAX_ANSWER_LENGTH);
  if (!finalText) return { error: "Write an answer before approving." };

  const question = await db.question.findFirst({
    where: { id: questionId, questionnaire: { orgId } },
    include: { questionnaire: { select: { id: true, unlocked: true } }, answer: true },
  });
  if (!question) return { error: "Not found." };
  if (!question.questionnaire.unlocked && question.position > FREE_QUESTION_LIMIT) {
    return { error: "Unlock this questionnaire to answer this question." };
  }

  const keepType = question.answer?.answerType && question.answer.answerType !== "needs_input";
  const answerType = keepType ? question.answer!.answerType : "text";

  await db.$transaction(async (tx) => {
    await tx.answer.upsert({
      where: { questionId },
      create: { questionId, answerType, finalText, status: "approved", approvedAt: new Date() },
      update: { answerType, finalText, status: "approved", approvedAt: new Date() },
    });

    // Approved answers become evidence for the next questionnaire.
    const existing = await tx.answerBankEntry.findFirst({
      where: { orgId, source: "approved_answer", sourceRef: questionId },
      select: { id: true },
    });
    const entry = { questionText: question.text, answerText: finalText, answerType: answerType ?? "text" };
    if (existing) await tx.answerBankEntry.update({ where: { id: existing.id }, data: entry });
    else await tx.answerBankEntry.create({ data: { orgId, source: "approved_answer", sourceRef: questionId, ...entry } });
  });

  revalidatePath(`/app/q/${question.questionnaire.id}`);
  return {};
}

/** Discard every draft the user has not approved and draft those questions again. */
export async function redraft(formData: FormData) {
  const orgId = await getOrgId();
  const id = String(formData.get("questionnaireId") ?? "");
  if (!orgId || !id) return;

  const questionnaire = await db.questionnaire.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!questionnaire) return;

  await db.answer.deleteMany({
    where: { status: { not: "approved" }, question: { questionnaireId: id } },
  });
  scheduleDrafting(id);
  revalidatePath(`/app/q/${id}`);
}
