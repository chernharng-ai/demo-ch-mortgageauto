"use client";

import { useActionState } from "react";
import { updateBank, type UpdateBankState } from "@/lib/actions/banks";
import type { Bank } from "@/lib/mortgage/types";
import GuidelineReference from "./GuidelineReference";

export default function BankEditor({ bank, canEdit }: { bank: Bank; canEdit: boolean }) {
  const initialState: UpdateBankState = {};
  const [state, formAction, pending] = useActionState(updateBank.bind(null, bank.id), initialState);
  const guideline = (bank.calc_params as { guideline?: Record<string, string | null> }).guideline;

  return (
    <details className="rounded-lg border border-neutral-200 p-4">
      <summary className="cursor-pointer font-semibold text-neutral-900">{bank.name}</summary>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Underwriting Guideline</h3>
        <GuidelineReference guideline={guideline} />
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor={`calc-${bank.id}`} className="block text-sm text-neutral-700 mb-1">
            Calculation parameters (JSON)
          </label>
          <textarea
            id={`calc-${bank.id}`}
            name="calc_params"
            rows={10}
            disabled={!canEdit}
            defaultValue={JSON.stringify(bank.calc_params, null, 2)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
          {state.fieldErrors?.calc_params && <p className="text-xs text-red-600 mt-1">{state.fieldErrors.calc_params}</p>}
          <p className="text-xs text-neutral-400 mt-1">
            Must include stress_rate, tenure_max_years, income_rules, and either dsr_limit (flat) or dsr_tiers (income brackets).
          </p>
        </div>

        <div>
          <label htmlFor={`docs-${bank.id}`} className="block text-sm text-neutral-700 mb-1">
            Required documents (one per line)
          </label>
          <textarea
            id={`docs-${bank.id}`}
            name="doc_requirements"
            rows={6}
            disabled={!canEdit}
            defaultValue={bank.doc_requirements.join("\n")}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
          {state.fieldErrors?.doc_requirements && <p className="text-xs text-red-600 mt-1">{state.fieldErrors.doc_requirements}</p>}
        </div>

        {state.error && <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{state.error}</div>}
        {state.success && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">Saved.</div>
        )}

        {canEdit && (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
        )}
      </form>
    </details>
  );
}
