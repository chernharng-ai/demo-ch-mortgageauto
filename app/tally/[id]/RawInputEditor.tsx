"use client";

import { useState, useTransition } from "react";
import { updateRawInputAndReTally } from "@/lib/actions/tally";

export default function RawInputEditor({
  submissionId,
  rawInput,
  sourceFormat,
}: {
  submissionId: string;
  rawInput: string;
  sourceFormat: string | null;
}) {
  const [draft, setDraft] = useState(rawInput);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = draft !== rawInput;

  function saveAndReRun() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateRawInputAndReTally(submissionId, draft);
      if (result.error) setError(result.error);
      else setNotice("Saved and re-tallied — the template above is updated. Your manual edits were kept.");
    });
  }

  return (
    <details className="mt-6 rounded-lg border border-neutral-200" open>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
        Raw input ({sourceFormat ?? "unknown"}) — paste an updated agent message here to re-tally this client
      </summary>
      <div className="border-t border-neutral-200 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-neutral-300 p-3 font-mono text-xs leading-relaxed text-neutral-800 focus:border-neutral-500 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveAndReRun}
            disabled={isPending || draft.trim().length === 0}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Re-tallying…" : "Save & Re-run Tally"}
          </button>
          {dirty && !isPending && (
            <button
              type="button"
              onClick={() => { setDraft(rawInput); setError(null); setNotice(null); }}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Discard changes
            </button>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
          {notice && <span className="text-xs text-emerald-700">{notice}</span>}
        </div>
      </div>
    </details>
  );
}
