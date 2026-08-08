"use client";

import { useState, useTransition } from "react";
import { setSubmissionStatus } from "@/lib/actions/tally";

const NEXT_STATUS: Record<string, { next: string; label: string } | undefined> = {
  pending: { next: "reviewed", label: "Mark Reviewed" },
  reviewed: { next: "finalized", label: "Finalize" },
};

const BADGES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  reviewed: "bg-amber-100 text-amber-800",
  finalized: "bg-emerald-100 text-emerald-800",
};

export default function StatusControl({ submissionId, status }: { submissionId: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const step = NEXT_STATUS[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGES[status] ?? BADGES.pending}`}>
        {status}
      </span>
      {step && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await setSubmissionStatus(submissionId, step.next);
              if (result.error) setError(result.error);
            })
          }
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          {isPending ? "Saving…" : step.label}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
