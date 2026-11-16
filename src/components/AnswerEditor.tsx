"use client";

import { useState, useTransition } from "react";
import { saveAnswer } from "@/app/app/actions";

export function AnswerEditor({ questionId, initialText, approved }: {
  questionId: string;
  initialText: string;
  approved: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(approved ? initialText : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isApproved = savedText !== null && savedText === text;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveAnswer(questionId, text);
      if (result.error) setError(result.error);
      else setSavedText(text);
    });
  }

  return (
    <div className="mt-3">
      <label htmlFor={`a-${questionId}`} className="sr-only">
        Answer
      </label>
      <textarea
        id={`a-${questionId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Write your answer…"
        className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || isApproved || !text.trim()}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {pending ? "Saving…" : isApproved ? "Approved ✓" : "Save & approve"}
        </button>
        {error && (
          <span role="alert" className="text-xs text-red-700">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
