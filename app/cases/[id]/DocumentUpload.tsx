"use client";

import { useActionState, useRef, useTransition } from "react";
import { uploadDocument, type UploadDocumentState } from "@/lib/actions/documents";
import { addIncomeEntryFromExtraction } from "@/lib/actions/income";
import type { DocumentItem } from "@/lib/mortgage/types";

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

export default function DocumentUpload({ caseId, doc }: { caseId: string; doc: DocumentItem }) {
  const initialState: UploadDocumentState = {};
  const [state, formAction, pending] = useActionState(uploadDocument.bind(null, doc.id, caseId), initialState);
  const [isAdding, startAdding] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extraction = state.extraction ?? doc.ai_extracted_data;

  function handleFileChange() {
    if (fileInputRef.current?.files?.length) {
      fileInputRef.current.form?.requestSubmit();
    }
  }

  return (
    <div className="mt-1.5">
      <form action={formAction} className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={handleFileChange}
          disabled={pending}
          className="text-xs text-neutral-500 file:mr-2 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs disabled:opacity-50"
        />
        {pending && <span className="text-xs text-neutral-400">Uploading &amp; reading…</span>}
      </form>

      {doc.file_name && !pending && (
        <p className="text-xs text-neutral-400 mt-1">Saved as {doc.file_name}</p>
      )}

      {state.error && <p className="text-xs text-red-600 mt-1">{state.error}</p>}

      {extraction && (
        <div className="mt-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-2 text-xs space-y-1.5">
          <div className="text-neutral-500">
            Claude read this as <span className="font-medium text-neutral-700">{extraction.document_type.replace(/_/g, " ")}</span>
            {extraction.employer_name ? ` — employer: ${extraction.employer_name}` : ""}
          </div>
          {extraction.detected_income.length > 0 ? (
            <ul className="space-y-1">
              {extraction.detected_income.map((line, i) => (
                <li key={i} className="flex items-center justify-between gap-2 bg-white rounded border border-neutral-200 px-2 py-1">
                  <span>
                    {INCOME_TYPE_LABEL[line.income_type] ?? line.income_type} — {formatMYR(line.gross_amount)} / {line.frequency}{" "}
                    <span className="text-neutral-400">({Math.round(line.confidence * 100)}% confidence)</span>
                  </span>
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() =>
                      startAdding(() =>
                        addIncomeEntryFromExtraction(caseId, line.income_type, line.gross_amount, line.frequency, `Extracted from ${doc.doc_name}`),
                      )
                    }
                    className="text-neutral-900 underline font-medium whitespace-nowrap disabled:opacity-40"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-400">No income figures detected on this document.</p>
          )}
          {extraction.notes && <p className="text-amber-700">⚠ {extraction.notes}</p>}
        </div>
      )}

      {doc.ai_extraction_status === "unavailable" && doc.file_name && !extraction && (
        <p className="text-xs text-neutral-400 mt-1">AI reading isn&apos;t available for this file — enter income manually.</p>
      )}
    </div>
  );
}
