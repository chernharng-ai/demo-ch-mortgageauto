"use client";

import { useRef, useTransition } from "react";
import { addCommitment, deleteCommitment } from "@/lib/actions/calculations";
import type { CaseCommitment } from "@/lib/mortgage/types";

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

export default function CommitmentsPanel({ caseId, commitments, canEdit }: { caseId: string; commitments: CaseCommitment[]; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const descRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const total = commitments.reduce((sum, c) => sum + c.monthly_amount, 0);

  function submit() {
    const description = descRef.current?.value.trim();
    const amount = Number(amountRef.current?.value);
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    startTransition(() => addCommitment(caseId, description, amount));
    if (descRef.current) descRef.current.value = "";
    if (amountRef.current) amountRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Existing monthly debt commitments — auto-read from the client&apos;s CTOS/Experian report on upload (loans at their instalment, cards at 5% of
        outstanding) and subtracted before DSR/NDI are checked. Add anything the report misses below.
      </p>

      {commitments.length === 0 ? (
        <p className="text-sm text-neutral-500">No commitments recorded — upload a CTOS/Experian report to auto-fill, or add manually below.</p>
      ) : (
        <ul className="space-y-2">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
              <span className="text-sm text-neutral-800">
                {c.description} — <span className="font-medium">{formatMYR(c.monthly_amount)}/mo</span>
                {c.source === "credit_report" && (
                  <span className="ml-2 text-[10px] rounded-full px-1.5 py-0.5 font-medium bg-neutral-100 text-neutral-600">auto from credit report</span>
                )}
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteCommitment(c.id, caseId))}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-1 text-sm font-medium text-neutral-700">
            <span>Total</span>
            <span>{formatMYR(total)}/mo</span>
          </li>
        </ul>
      )}

      {canEdit && (
        <div className="flex gap-2 bg-neutral-50 rounded-md p-3">
          <input ref={descRef} type="text" placeholder="e.g. Car loan, Credit card" className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input ref={amountRef} type="number" min="0" step="10" placeholder="RM / mo" className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="text-xs rounded-md bg-neutral-900 text-white px-3 py-1.5 font-medium hover:bg-neutral-700 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}
