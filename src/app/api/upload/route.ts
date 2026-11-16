import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { draftAnswers } from "@/lib/drafting";
import { ParseError, parseQuestionnaire } from "@/lib/parser";
import { getOrCreateOrgId } from "@/lib/session";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 413 });
  }
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext !== "xlsx" && ext !== "csv") {
    return NextResponse.json({ error: "Upload an .xlsx or .csv file." }, { status: 415 });
  }

  const data = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseQuestionnaire(data, ext);
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const orgId = await getOrCreateOrgId();
  const originalKey = await saveUpload(orgId, randomUUID(), ext, data);

  const questionnaire = await db.questionnaire.create({
    data: {
      orgId,
      title: file.name.replace(/\.(xlsx|csv)$/i, "").slice(0, 120) || "Questionnaire",
      originalKey,
      columnMapping: JSON.stringify(parsed.mapping),
      status: "mapped",
      questionCount: parsed.questions.length,
      questions: { create: parsed.questions },
    },
  });

  // Stub: synchronous. The real drafting job runs in the background (PRD F5).
  await draftAnswers(questionnaire.id);

  return NextResponse.json({
    id: questionnaire.id,
    questionCount: parsed.questions.length,
    truncated: parsed.truncated,
  });
}
