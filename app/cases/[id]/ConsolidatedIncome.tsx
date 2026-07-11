"use client";

import { useTransition } from "react";
import { rederiveAndCalculate } from "@/lib/actions/income";
import type { ConsolidatedIncomeProposal } from "@/lib/mortgage/consolidate";

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 }).format(n);
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Shows the income the autopilot derived from the payslips (applied automatically on every upload) plus any flags, with a manual re-run button. */
export default function ConsolidatedIncome({ caseId, proposal, canEdit }: { caseId: string; proposal: ConsolidatedIncomeProposal; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (proposal.lines.length === 0) return null;

  const monthNames = proposal.monthsUsed.map((m) => MONTH_NAMES[Number(m)] ?? m).join(", ");

  return (
    <div className="mb-4 rounded-md border border-neutral-300 bg-neutral-50 p-3">
      <p className="text-xs font-medium text-neutral-700 mb-2">
        Income auto-derived from {proposal.monthsUsed.length} payslips ({monthNames}) — applied to the calculation automatically on every upload:
      </p>
      <ul className="space-y-1 mb-2">
        {proposal.lines.map((line, i) => (
          <li key={i} className="text-xs text-neutral-800 flex items-center justify-between gap-2 bg-white rounded border border-neutral-200 px-2 py-1">
            <span>{line.label}</span>
            <span className="font-semibold whitespace-nowrap text-right">
              {formatMYR(line.gross_amount)} / mo
              {line.nett_amount != null && <span className="block font-normal text-neutral-500">nett {formatMYR(line.nett_amount)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {proposal.flags.length > 0 && (
        <ul className="space-y-0.5 mb-2">
          {proposal.flags.map((flag, i) => (
            <li key={i} className="text-xs text-amber-700">
              ⚠ {flag}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => rederiveAndCalculate(caseId))}
          className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          {isPending ? "Recalculating…" : "Re-derive & recalculate now"}
        </button>
      )}
      <p className="text-[11px] text-neutral-400 mt-1.5">
        Nett basic uses the real deductions on the latest payslip. Manually typed entries below are kept and included on top.
      </p>
    </div>
  );
}
