"use client";

import { useTransition } from "react";
import { applyConsolidatedIncome } from "@/lib/actions/income";
import type { ConsolidatedIncomeProposal } from "@/lib/mortgage/consolidate";

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 }).format(n);
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One-click income setup from all uploaded payslips — basic once, fixed allowances once, variable income averaged — instead of per-line Adds off every payslip. */
export default function ConsolidatedIncome({ caseId, proposal, canEdit }: { caseId: string; proposal: ConsolidatedIncomeProposal; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (!canEdit || proposal.lines.length === 0) return null;

  const monthNames = proposal.monthsUsed.map((m) => MONTH_NAMES[Number(m)] ?? m).join(", ");

  return (
    <div className="mb-4 rounded-md border border-neutral-300 bg-neutral-50 p-3">
      <p className="text-xs font-medium text-neutral-700 mb-2">
        Suggested income from {proposal.monthsUsed.length} payslips ({monthNames}) — one clean set, no double counting:
      </p>
      <ul className="space-y-1 mb-3">
        {proposal.lines.map((line, i) => (
          <li key={i} className="text-xs text-neutral-800 flex items-center justify-between gap-2 bg-white rounded border border-neutral-200 px-2 py-1">
            <span>{line.label}</span>
            <span className="font-semibold whitespace-nowrap">{formatMYR(line.gross_amount)} / mo</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => applyConsolidatedIncome(caseId))}
        className="text-xs rounded-md bg-neutral-900 text-white px-3 py-1.5 font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "Applying…" : "Use this as the case income"}
      </button>
      <p className="text-[11px] text-neutral-400 mt-1.5">
        Replaces income lines previously added from documents (typed-in entries are kept). Each bank still applies its own variable-income multiplier in
        the calculation.
      </p>
    </div>
  );
}
