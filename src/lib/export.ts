import ExcelJS from "exceljs";
import type { Answer, Question, Questionnaire } from "@prisma/client";
import { loadWorkbook, type ColumnMapping } from "./parser";
import { readUpload } from "./storage";

type QuestionWithAnswer = Question & { answer: Answer | null };

/**
 * The text that goes into the buyer's file for one question, or null to
 * leave the cell untouched. Unanswered and failed questions are never
 * filled with placeholder text.
 */
export function exportText(answer: Answer | null): string | null {
  if (!answer) return null;
  if (answer.status === "approved") return answer.finalText?.trim() || null;
  if (answer.status === "drafted" && answer.answerType !== "needs_input") {
    return answer.draftText?.trim() || null;
  }
  return null;
}

/**
 * Write answers into a copy of the original upload, at the mapped answer
 * column on each question's original row (PRD F8). The output format matches
 * the upload (.xlsx or .csv).
 *
 * Known limit: exceljs round-trips cell values, styles and column widths,
 * but can drop some workbook features (e.g. certain conditional formatting,
 * macros). Check heavily formatted workbooks before sending.
 */
export async function buildExport(
  questionnaire: Questionnaire & { questions: QuestionWithAnswer[] },
): Promise<{ data: Buffer; ext: "xlsx" | "csv"; contentType: string; filled: number }> {
  if (!questionnaire.columnMapping) throw new Error("Questionnaire has no column mapping.");
  const mapping = JSON.parse(questionnaire.columnMapping) as ColumnMapping;
  const ext = questionnaire.originalKey.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";

  const workbook = new ExcelJS.Workbook();
  await loadWorkbook(workbook, await readUpload(questionnaire.originalKey), ext);

  let filled = 0;
  for (const q of questionnaire.questions) {
    const text = exportText(q.answer);
    if (!text) continue;
    // A CSV has exactly one sheet; its name is not stable across reads.
    const sheet = ext === "csv" ? workbook.worksheets[0] : workbook.getWorksheet(q.sheetName);
    if (!sheet) continue;
    // In .xlsx a string value is stored as text and never evaluated. A CSV
    // has no types, so neutralise anything a spreadsheet would run as a formula.
    sheet.getRow(q.rowNumber).getCell(mapping.answerCol).value =
      ext === "csv" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    filled++;
  }

  const out = ext === "csv" ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(out as ArrayBuffer),
    ext,
    contentType:
      ext === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filled,
  };
}
