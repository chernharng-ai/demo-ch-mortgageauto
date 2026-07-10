"use client";

import { useTransition } from "react";
import { addIncomeEntryFromExtraction } from "@/lib/actions/income";
import type { DocumentExtraction } from "@/lib/mortgage/extraction";

const INCOME_TYPE_LABEL: Record<string, string> = {
  basic: "Basic salary",
  allowance: "Allowance",
  commission: "Commission",
  rental: "Rental income",
  net_profit: "Net profit",
  other: "Other",
};

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

/** Shows an AI-read document's detected income lines with an "Add" button per line — used both right after upload and whenever an already-uploaded document is revisited. */
export default function ExtractionSummary({ caseId, extraction, sourceLabel }: { caseId: string; extraction: DocumentExtraction; sourceLabel: string }) {
  const [isAdding, startAdding] = useTransition();

  if (extraction.detected_income.length === 0 && !extraction.notes) return null;

  return (
    <div className="mt-1">
      {extraction.detected_income.length > 0 && (
        <ul className="space-y-1">
          {extraction.detected_income.map((line, j) => (
            <li key={j} className="flex items-center justify-between gap-2 bg-neutral-50 rounded border border-neutral-200 px-2 py-1 text-xs">
              <span>
                {INCOME_TYPE_LABEL[line.income_type] ?? line.income_type} — {formatMYR(line.gross_amount)} / {line.frequency}{" "}
                <span className="text-neutral-400">({Math.round(line.confidence * 100)}% confidence)</span>
              </span>
              <button
                type="button"
                disabled={isAdding}
                onClick={() => startAdding(() => addIncomeEntryFromExtraction(caseId, line.income_type, line.gross_amount, line.frequency, `Extracted from ${sourceLabel}`))}
                className="text-neutral-900 underline font-medium whitespace-nowrap disabled:opacity-40"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {extraction.notes && <p className="text-amber-700 mt-1 text-xs">⚠ {extraction.notes}</p>}
    </div>
  );
}
