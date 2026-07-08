"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { addIncomeEntry, deleteIncomeEntry, type AddIncomeState } from "@/lib/actions/income";
import { suggestIncomeType } from "@/lib/mortgage/assist";
import type { IncomeEntry } from "@/lib/mortgage/types";

const INCOME_TYPES = [
  { value: "basic", label: "Basic salary" },
  { value: "allowance", label: "Allowance" },
  { value: "commission", label: "Commission" },
  { value: "rental", label: "Rental income" },
  { value: "net_profit", label: "Net profit (self-employed)" },
  { value: "other", label: "Other" },
];

const INCOME_TYPE_LABEL: Record<string, string> = Object.fromEntries(INCOME_TYPES.map((t) => [t.value, t.label]));

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

const REVIEW_BADGE: Record<string, string> = {
  accepted: "bg-emerald-100 text-emerald-800",
  overridden: "bg-amber-100 text-amber-800",
};

export default function IncomeEntries({ caseId, entries, canEdit }: { caseId: string; entries: IncomeEntry[]; canEdit: boolean }) {
  const initialState: AddIncomeState = {};
  const [state, formAction, pending] = useActionState(addIncomeEntry.bind(null, caseId), initialState);
  const [isDeleting, startTransition] = useTransition();

  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestIncomeType>>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);

  function handleDescriptionChange(text: string) {
    setSuggestion(suggestIncomeType(text));
  }

  function applySuggestion() {
    if (suggestion && typeSelectRef.current) {
      typeSelectRef.current.value = suggestion.type;
      setSuggestion(null);
    }
  }

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
                {entry.ai_suggested_type && (
                  <span className={`inline-block mt-1 text-[10px] rounded-full px-1.5 py-0.5 font-medium ${REVIEW_BADGE[entry.ai_suggested_type_review_status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    AI suggested {INCOME_TYPE_LABEL[entry.ai_suggested_type] ?? entry.ai_suggested_type}
                    {entry.ai_suggested_type_review_status === "overridden" ? " (overridden)" : ""}
                  </span>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => startTransition(() => deleteIncomeEntry(entry.id, caseId))}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.error && <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs">{state.error}</div>}
      {state.warning && <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs">⚠ {state.warning}</div>}

      {canEdit && (
        <form action={formAction} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-start bg-neutral-50 rounded-md p-3">
          <div>
            <select
              ref={typeSelectRef}
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
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />

          {suggestion && (
            <div className="col-span-2 sm:col-span-4 flex items-center gap-2 text-xs text-neutral-600 bg-white border border-dashed border-neutral-300 rounded-md px-2 py-1.5">
              <span>
                Suggested type: <span className="font-medium capitalize">{INCOME_TYPE_LABEL[suggestion.type] ?? suggestion.type}</span>{" "}
                ({Math.round(suggestion.confidence * 100)}% confidence, keyword match)
              </span>
              <button type="button" onClick={applySuggestion} className="text-neutral-900 underline font-medium">
                Use this
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="col-span-2 sm:col-span-4 justify-self-start rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Adding…" : "+ Add Income Entry"}
          </button>
        </form>
      )}
    </div>
  );
}
