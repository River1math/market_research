import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildExport } from "@/lib/export";
import { getOrgId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const questionnaire = await db.questionnaire.findFirst({
    where: { id, orgId },
    include: { questions: { orderBy: { position: "asc" }, include: { answer: true } } },
  });
  if (!questionnaire) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!questionnaire.unlocked) {
    return NextResponse.json({ error: "Unlock this questionnaire to export it." }, { status: 402 });
  }

  const { data, ext, contentType } = await buildExport(questionnaire);
  const name = questionnaire.title.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "questionnaire";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${name} - answered.${ext}"`,
      "cache-control": "no-store",
    },
  });
}
