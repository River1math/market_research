import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";
import { db } from "@/lib/db";
import { FREE_QUESTION_LIMIT, PRODUCT_NAME, SINGLE_PRICE_LABEL } from "@/lib/config";
import { getOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const orgId = await getOrgId();
  const questionnaires = orgId
    ? await db.questionnaire.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-brand">
        ← {PRODUCT_NAME}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Upload a security questionnaire</h1>
      <p className="mt-2 text-slate-600">
        The first {FREE_QUESTION_LIMIT} answers are drafted free. Unlock the rest and the export for{" "}
        {SINGLE_PRICE_LABEL}.
      </p>

      <div className="mt-6">
        <UploadForm />
      </div>

      {questionnaires.length > 0 && (
        <section className="mt-10">
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
