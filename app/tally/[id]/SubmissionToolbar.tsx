"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reTallySubmission, deleteSubmission, aiExtractSubmission } from "@/lib/actions/tally";

export default function SubmissionToolbar({ submissionId }: { submissionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/tally/${submissionId}/export`}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        Export ⤓
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await reTallySubmission(submissionId);
            if (result.error) setError(result.error);
          })
        }
        title="Re-run the rule engine on the saved raw input. Your manual edits are kept."
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      >
        {isPending ? "Working…" : "Re-run Tally"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setNotice(null);
            const result = await aiExtractSubmission(submissionId);
            if (result.error) setError(result.error);
            else setNotice(`AI suggested ${result.suggested} value${result.suggested === 1 ? "" : "s"} — review the amber rows and confirm.`);
          })
        }
        title="Ask AI to fill fields the rule engine missed. Suggestions appear amber until you confirm them."
        className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
      >
        {isPending ? "Working…" : "AI Extract ✨"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Delete this submission and all its tally entries? This cannot be undone.")) return;
          startTransition(async () => {
            setError(null);
            const result = await deleteSubmission(submissionId);
            if (result?.error) setError(result.error);
          });
        }}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        Delete
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {notice && <span className="text-xs text-indigo-700">{notice}</span>}
    </div>
  );
}
