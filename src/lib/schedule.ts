import { after } from "next/server";
import { draftAnswers } from "./drafting";

/**
 * Start drafting once the current response has been sent. Only callable
 * inside a request (Route Handler or Server Action).
 */
export function scheduleDrafting(questionnaireId: string) {
  after(async () => {
    try {
      await draftAnswers(questionnaireId);
    } catch (err) {
      console.error(`[drafting] run for ${questionnaireId} crashed:`, err);
    }
  });
}
