"use client";

import { useActionState, useTransition } from "react";
import { addIncomeEntry, deleteIncomeEntry, type AddIncomeState } from "@/lib/actions/income";
import type { IncomeEntry } from "@/lib/mortgage/types";

const INCOME_TYPES = [
  { value: "basic", label: "Basic salary" },
  { value: "allowance", label: "Allowance" },
  { value: "commission", label: "Commission" },
  { value: "rental", label: "Rental income" },
  { value: "net_profit", label: "Net profit (self-employed)" },
  { value: "other", label: "Other" },
];

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

export default function IncomeEntries({ caseId, entries }: { caseId: string; entries: IncomeEntry[] }) {
  const initialState: AddIncomeState = {};
  const [state, formAction, pending] = useActionState(addIncomeEntry.bind(null, caseId), initialState);
  const [isDeleting, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No income entries yet — add one below.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
              <div className="text-sm">
                <span className="font-medium text-neutral-900 capitalize">{entry.income_type.replace("_", " ")}</span>{" "}
                <span className="text-neutral-600">
                  {formatMYR(entry.gross_amount)} / {entry.frequency}
                </span>
                {entry.supporting_doc && <div className="text-xs text-neutral-400">{entry.supporting_doc}</div>}
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => startTransition(() => deleteIncomeEntry(entry.id, caseId))}
                className="text-xs text-red-600 hover:underline disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.error && <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs">{state.error}</div>}

      <form action={formAction} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-start bg-neutral-50 rounded-md p-3">
        <div>
          <select
            name="income_type"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm bg-white"
            defaultValue="basic"
          >
            {INCOME_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.income_type && <p className="text-xs text-red-600 mt-1">{state.fieldErrors.income_type}</p>}
        </div>
        <div>
          <input
            type="number"
            name="gross_amount"
            min="0"
            step="100"
            placeholder="Amount (RM)"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
          {state.fieldErrors?.gross_amount && <p className="text-xs text-red-600 mt-1">{state.fieldErrors.gross_amount}</p>}
        </div>
        <select name="frequency" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm bg-white" defaultValue="monthly">
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
        <input
          type="text"
          name="supporting_doc"
          placeholder="Supporting doc (optional)"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 sm:col-span-4 justify-self-start rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "+ Add Income Entry"}
        </button>
      </form>
    </div>
  );
}
