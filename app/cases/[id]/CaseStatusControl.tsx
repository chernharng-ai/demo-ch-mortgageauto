"use client";

import { useTransition } from "react";
import { updateCaseStatus } from "@/lib/actions/cases";
import type { CaseStatus } from "@/lib/mortgage/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  "in-review": "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const STATUSES: CaseStatus[] = ["draft", "in-review", "approved", "rejected"];

export default function CaseStatusControl({ caseId, status }: { caseId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: CaseStatus) {
    if (next === status) return;
    const confirmed = window.confirm(`Change case status from "${status}" to "${next}"?`);
    if (!confirmed) return;
    startTransition(() => {
      updateCaseStatus(caseId, next);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-700"}`}>
        {status}
      </span>
      <select
        aria-label="Change case status"
        disabled={isPending}
        value=""
        onChange={(e) => handleChange(e.target.value as CaseStatus)}
        className="text-xs rounded-md border border-neutral-300 px-2 py-1 bg-white disabled:opacity-50"
      >
        <option value="" disabled>
          Change status…
        </option>
        {STATUSES.filter((s) => s !== status).map((s) => (
          <option key={s} value={s} className="capitalize">
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
