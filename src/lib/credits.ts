import type { Prisma } from "@prisma/client";

/**
 * Spend one credit on a questionnaire inside an existing transaction.
 * Returns false when the credit has nothing left.
 *
 * The `used < quantity` guard lives in the UPDATE's WHERE clause so two
 * concurrent unlock attempts cannot both spend the same credit.
 */
export async function consumeCredit(
  tx: Prisma.TransactionClient,
  creditId: string,
  questionnaireId: string,
): Promise<boolean> {
  const credit = await tx.questionnaireCredit.findUnique({ where: { id: creditId } });
  if (!credit) return false;

  const spent = await tx.questionnaireCredit.updateMany({
    where: { id: creditId, used: { lt: credit.quantity } },
    data: { used: { increment: 1 } },
  });
  if (spent.count === 0) return false;

  await tx.questionnaire.update({
    where: { id: questionnaireId },
    data: { unlocked: true, creditId },
  });
  return true;
}

/** Oldest credit with remaining balance that has not expired, if any. */
export async function findUsableCredit(tx: Prisma.TransactionClient, orgId: string) {
  const credits = await tx.questionnaireCredit.findMany({
    where: { orgId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "asc" },
  });
  return credits.find((c) => c.used < c.quantity) ?? null;
}
