"use client";

import { useActionState } from "react";
import { runCalculations, type RunCalculationState } from "@/lib/actions/calculations";
import type { Bank, IncomeCalculation, LoanEligibility } from "@/lib/mortgage/types";

const ELIGIBILITY_STYLES: Record<string, string> = {
  eligible: "bg-emerald-100 text-emerald-800",
  marginal: "bg-amber-100 text-amber-800",
  ineligible: "bg-red-100 text-red-700",
};

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

export default function CalculationPanel({
  caseId,
  hasIncome,
  canEdit,
  banks,
  incomeCalculations,
  loanEligibilities,
}: {
  caseId: string;
  hasIncome: boolean;
  canEdit: boolean;
  banks: Bank[];
  incomeCalculations: IncomeCalculation[];
  loanEligibilities: LoanEligibility[];
}) {
  const initialState: RunCalculationState = {};
  const [state, formAction, pending] = useActionState(runCalculations.bind(null, caseId), initialState);

  const rows = banks
    .map((bank) => {
      const calc = incomeCalculations.find((c) => c.bank_id === bank.id);
      const eligibility = loanEligibilities.find((e) => e.bank_id === bank.id);
      return { bank, calc, eligibility };
    })
    .filter((r) => r.calc && r.eligibility)
    .sort((a, b) => (b.eligibility?.max_loan_amount ?? 0) - (a.eligibility?.max_loan_amount ?? 0));

  return (
    <div className="space-y-4">
      {canEdit && (
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || !hasIncome}
            title={!hasIncome ? "Add income entries first" : undefined}
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Calculating…" : "Run Calculation"}
          </button>
        </form>
      )}

      {state.error && <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{state.error}</div>}
      {state.success && <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">Calculation complete.</div>}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No results yet. Run the calculation to see eligibility per bank.</p>
      ) : (
        <div className="rounded-lg border border-neutral-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Bank</th>
                <th className="px-4 py-2 font-medium">Eligible Income</th>
                <th className="px-4 py-2 font-medium">Max Loan</th>
                <th className="px-4 py-2 font-medium">Instalment</th>
                <th className="px-4 py-2 font-medium">DSR</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bank, calc, eligibility }) => (
                <tr key={bank.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 font-medium text-neutral-900">{bank.name}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{formatMYR(calc!.eligible_income)}</td>
                  <td className="px-4 py-2.5 font-semibold text-neutral-900">{formatMYR(eligibility!.max_loan_amount)}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{formatMYR(eligibility!.monthly_instalment)}/mo</td>
                  <td className="px-4 py-2.5 text-neutral-700">{(eligibility!.dsr_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ELIGIBILITY_STYLES[eligibility!.eligibility_status]}`}>
                      {eligibility!.eligibility_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
