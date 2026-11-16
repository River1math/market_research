import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { MAX_QUESTIONS } from "./config";

export type ColumnMapping = {
  sheet: string;
  headerRow: number; // 1-based; 0 when no header row was found
  questionCol: number; // 1-based
  answerCol: number; // 1-based
};

export type ParsedQuestion = {
  position: number;
  sheetName: string;
  rowNumber: number;
  text: string;
};

export type ParseResult = {
  mapping: ColumnMapping;
  questions: ParsedQuestion[];
  truncated: boolean;
};

export class ParseError extends Error {}

const QUESTION_HEADER = /\b(question|requirement|control|inquiry|description)\b/i;
const ANSWER_HEADER = /\b(answer|response|reply|vendor)\b/i;
const HEADER_SCAN_ROWS = 30;
const MIN_QUESTION_LENGTH = 8;

/**
 * Parse a questionnaire workbook and guess where the questions are.
 *
 * Heuristic (PRD F4): in each sheet, look for a header row naming a question
 * column; fall back to the column with the most long-text cells. The sheet
 * with the most detected questions wins. The mapping is returned so the UI
 * can show it — a correction screen is still TODO.
 */
export async function parseQuestionnaire(data: Buffer, ext: "xlsx" | "csv"): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (ext === "csv") await workbook.csv.read(Readable.from(data));
    else await workbook.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new ParseError("That file could not be read as a spreadsheet.");
  }

  let best: ParseResult | null = null;
  for (const sheet of workbook.worksheets) {
    const result = parseSheet(sheet);
    if (result && (!best || result.questions.length > best.questions.length)) best = result;
  }
  if (!best || best.questions.length === 0) {
    throw new ParseError("No questions were found. Check that the file has a column of questions.");
  }
  return best;
}

function parseSheet(sheet: ExcelJS.Worksheet): ParseResult | null {
  const rowCount = sheet.rowCount;
  const colCount = sheet.columnCount;
  if (rowCount === 0 || colCount === 0) return null;

  let headerRow = 0;
  let questionCol = 0;
  let answerCol = 0;

  for (let r = 1; r <= Math.min(rowCount, HEADER_SCAN_ROWS) && !headerRow; r++) {
    for (let c = 1; c <= colCount; c++) {
      const text = cellText(sheet, r, c);
      if (text.length <= 40 && QUESTION_HEADER.test(text)) {
        headerRow = r;
        questionCol = c;
        break;
      }
    }
  }

  if (headerRow) {
    for (let c = 1; c <= colCount; c++) {
      if (c !== questionCol && ANSWER_HEADER.test(cellText(sheet, headerRow, c))) {
        answerCol = c;
        break;
      }
    }
  } else {
    // No header: pick the column with the most long-text cells.
    let bestCount = 0;
    for (let c = 1; c <= colCount; c++) {
      let count = 0;
      for (let r = 1; r <= rowCount; r++) {
        if (cellText(sheet, r, c).length >= 20) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        questionCol = c;
      }
    }
    if (!questionCol) return null;
  }
  if (!answerCol) answerCol = questionCol + 1;

  const questions: ParsedQuestion[] = [];
  let truncated = false;
  for (let r = headerRow + 1; r <= rowCount; r++) {
    const text = cellText(sheet, r, questionCol);
    if (text.length < MIN_QUESTION_LENGTH) continue;
    if (questions.length >= MAX_QUESTIONS) {
      truncated = true;
      break;
    }
    questions.push({ position: questions.length + 1, sheetName: sheet.name, rowNumber: r, text });
  }

  return { mapping: { sheet: sheet.name, headerRow, questionCol, answerCol }, questions, truncated };
}

/**
 * Displayed text of a cell. For formula cells exceljs returns the cached
 * result, never the formula, so nothing executable is carried forward.
 * Leading formula characters are also stripped because this text is written
 * back into a spreadsheet on export (formula-injection guard, PRD §3).
 */
function cellText(sheet: ExcelJS.Worksheet, row: number, col: number): string {
  const cell = sheet.getRow(row).getCell(col);
  let text: string;
  try {
    text = cell.text ?? "";
  } catch {
    text = "";
  }
  return text.replace(/\s+/g, " ").trim().replace(/^[=+\-@]+\s*/, "");
}
