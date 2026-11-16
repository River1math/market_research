/**
 * Keyword retrieval over the org's answer bank.
 *
 * Deliberately simple: an answer bank is tens to a few hundred entries, and
 * SQLite has no vector index. Swap for pgvector + full-text on Postgres
 * (PRD §3) without changing the callers.
 */
export type BankEntry = {
  id: string;
  questionText: string;
  answerText: string;
  source: string;
};

export type Evidence = { entry: BankEntry; score: number };

const STOPWORDS = new Set(
  `a an and any are as at be been by can could do does for from has have how if in into is it its
   of on or our please provide shall should that the their there these they this to was were what
   when where which who will with would you your describe list all not company organization vendor`
    .split(/\s+/),
);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 3 && !/^\d+$/.test(raw) && raw !== "mfa" && raw !== "sso") continue;
    if (STOPWORDS.has(raw)) continue;
    // Crude stemming so "backups"/"backup" and "encrypted"/"encrypt" match.
    out.add(raw.replace(/(ing|ion|ed|es|s)$/, "") || raw);
  }
  return out;
}

/** Entry text as shown to the model and quoted in citations. */
export function evidenceText(entry: BankEntry): string {
  return entry.questionText ? `Q: ${entry.questionText}\nA: ${entry.answerText}` : entry.answerText;
}

/**
 * Score = share of the question's keywords found in the entry.
 * Entries sharing fewer than `minScore` are dropped; no evidence at all is a
 * valid result and means the question goes to the user.
 */
export function findEvidence(question: string, bank: BankEntry[], limit = 6, minScore = 0.2): Evidence[] {
  const q = tokens(question);
  if (q.size === 0) return [];
  const scored: Evidence[] = [];
  for (const entry of bank) {
    const e = tokens(`${entry.questionText} ${entry.answerText}`);
    let shared = 0;
    for (const t of q) if (e.has(t)) shared++;
    const score = shared / q.size;
    if (score >= minScore) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
