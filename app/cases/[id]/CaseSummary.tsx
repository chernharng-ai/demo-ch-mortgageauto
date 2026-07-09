"use client";

import { useActionState, useState, useTransition } from "react";
import { generateSummary, setSummaryStatus, type SummaryState } from "@/lib/actions/summary";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — awaiting review",
  accepted: "Accepted",
  dismissed: "Dismissed",
};

export default function CaseSummary({
  caseId,
  summary,
  status,
  canEdit,
}: {
  caseId: string;
  summary: string | null;
  status: string;
  canEdit: boolean;
}) {
  const initialState: SummaryState = {};
  const [state, formAction, pending] = useActionState(generateSummary.bind(null, caseId), initialState);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!canEdit && !summary) {
    return null;
  }

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Eligibility Summary</h2>
      <div className="space-y-3">
      {summary ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">{STATUS_LABEL[status] ?? status}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs rounded-md border border-neutral-300 px-2 py-1 font-medium hover:bg-neutral-100"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-sm text-neutral-800">{summary}</p>
          {canEdit && status === "draft" && (
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => setSummaryStatus(caseId, "accepted"))}
                className="text-xs rounded-md bg-neutral-900 text-white px-3 py-1.5 font-medium hover:bg-neutral-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => setSummaryStatus(caseId, "dismissed"))}
                className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No summary drafted yet.</p>
      )}

      {canEdit && (
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
          >
            {pending ? "Drafting…" : summary ? "Regenerate Summary" : "Draft Summary"}
          </button>
        </form>
      )}
      {state.error && <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs">{state.error}</div>}
      </div>
    </section>
  );
}
