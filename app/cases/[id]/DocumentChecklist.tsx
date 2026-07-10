"use client";

import { useRef, useState, useTransition } from "react";
import { resetDocumentGroupStatus, assignDocumentMatch, addChecklistItem, deleteChecklistItem, retryExtraction } from "@/lib/actions/documents";
import { addSubItem, setSubItemStatus, deleteSubItem } from "@/lib/actions/subItems";
import type { CaseDocument, DocStatus, DocumentItem, DocumentSubItem } from "@/lib/mortgage/types";
import BulkDocumentUpload from "./BulkDocumentUpload";
import ExtractionSummary from "./ExtractionSummary";

type SignedCaseDocument = CaseDocument & { signedUrl: string | null };

interface DocGroup {
  docName: string;
  status: DocStatus;
  bankCount: number;
  isCustom: boolean;
  documents: SignedCaseDocument[];
  subItems: DocumentSubItem[];
}

function icon(status: DocStatus) {
  if (status === "received") return "✅";
  if (status === "missing") return "❌";
  return "⚠️";
}

export default function DocumentChecklist({
  caseId,
  items,
  caseDocuments,
  subItems,
  canEdit,
}: {
  caseId: string;
  items: DocumentItem[];
  caseDocuments: SignedCaseDocument[];
  subItems: DocumentSubItem[];
  canEdit: boolean;
}) {
  const candidateDocNames = [...new Set(items.map((i) => i.doc_name))];

  const groups: DocGroup[] = candidateDocNames.map((docName) => {
    const groupItems = items.filter((i) => i.doc_name === docName);
    const documents = caseDocuments.filter((d) => d.matched_doc_name === docName);
    const groupSubItems = subItems.filter((s) => s.doc_name === docName).sort((a, b) => a.sort_order - b.sort_order);
    return {
      docName,
      status: groupItems[0]?.status ?? "pending",
      bankCount: groupItems.length,
      isCustom: groupItems.every((i) => i.bank_id === null),
      documents,
      subItems: groupSubItems,
    };
  });

  const unmatched = caseDocuments.filter((d) => !d.matched_doc_name);
  const receivedCount = groups.filter((g) => g.status === "received").length;

  return (
    <div className="space-y-4">
      {canEdit && <BulkDocumentUpload caseId={caseId} candidateDocNames={candidateDocNames} />}

      {caseDocuments.length > 0 && (
        <a
          href={`/api/cases/${caseId}/documents/zip`}
          className="inline-block text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100"
        >
          Download all documents (.zip)
        </a>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No document checklist yet.</p>
      ) : (
        <div>
          <p className="text-xs text-neutral-500 mb-2">
            {receivedCount} of {groups.length} collected
          </p>
          <ul className="space-y-2">
            {groups.map((g) => (
              <DocRow key={g.docName} caseId={caseId} group={g} canEdit={canEdit} />
            ))}
          </ul>
        </div>
      )}

      {canEdit && <AddChecklistItemRow caseId={caseId} />}

      {unmatched.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Unmatched uploads — assign manually</h3>
          <ul className="space-y-2">
            {unmatched.map((d) => (
              <UnmatchedRow key={d.id} caseId={caseId} doc={d} candidateDocNames={candidateDocNames} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocRow({ caseId, group, canEdit }: { caseId: string; group: DocGroup; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="rounded-md border border-neutral-200 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-800 flex items-center gap-2">
          <span aria-hidden>{icon(group.status)}</span>
          {group.docName}
          {!group.isCustom && (
            <span className="text-xs text-neutral-400">
              ({group.bankCount} bank{group.bankCount === 1 ? "" : "s"})
            </span>
          )}
        </span>
        {canEdit && (
          <div className="flex items-center gap-1" aria-disabled={isPending}>
            {(["pending", "received", "missing"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={isPending || group.status === s}
                onClick={() => startTransition(() => resetDocumentGroupStatus(caseId, group.docName, s))}
                className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed capitalize"
              >
                {s}
              </button>
            ))}
            {group.isCustom && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (window.confirm(`Remove the "${group.docName}" checklist item?`)) {
                    startTransition(() => deleteChecklistItem(caseId, group.docName));
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-neutral-200 text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      {group.documents.length > 0 && (
        <ul className="mt-1 space-y-1">
          {group.documents.map((doc) => (
            <li key={doc.id} className="text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                {doc.signedUrl ? (
                  <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="underline hover:text-neutral-600">
                    {doc.file_name}
                  </a>
                ) : (
                  <span>{doc.file_name}</span>
                )}
                {canEdit && doc.ai_extraction_status !== "done" && <RetryButton caseId={caseId} caseDocumentId={doc.id} />}
              </div>
              {doc.ai_extracted_data && <ExtractionSummary caseId={caseId} extraction={doc.ai_extracted_data} sourceLabel={doc.original_file_name} />}
            </li>
          ))}
        </ul>
      )}

      <SubItems caseId={caseId} docName={group.docName} subItems={group.subItems} canEdit={canEdit} />
    </li>
  );
}

function RetryButton({ caseId, caseDocumentId }: { caseId: string; caseDocumentId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => retryExtraction(caseDocumentId, caseId))}
      className="text-neutral-500 underline hover:text-neutral-800 disabled:opacity-40 whitespace-nowrap"
    >
      {isPending ? "Reading…" : "Retry AI reading"}
    </button>
  );
}

function SubItems({ caseId, docName, subItems, canEdit }: { caseId: string; docName: string; subItems: DocumentSubItem[]; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function cycle(current: DocStatus): DocStatus {
    if (current === "pending") return "received";
    if (current === "received") return "missing";
    return "pending";
  }

  function submitAdd() {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    startTransition(() => addSubItem(caseId, docName, value));
    if (inputRef.current) inputRef.current.value = "";
    setAdding(false);
  }

  if (subItems.length === 0 && !canEdit) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {subItems.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1 text-xs rounded border border-neutral-200 pl-2 pr-1 py-0.5">
          <button
            type="button"
            disabled={isPending || !canEdit}
            onClick={() => startTransition(() => setSubItemStatus(s.id, caseId, cycle(s.status)))}
            className="disabled:cursor-default"
          >
            {s.label} {icon(s.status)}
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => deleteSubItem(s.id, caseId))}
              className="text-neutral-400 hover:text-red-600 px-0.5"
              aria-label={`Remove ${s.label}`}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {canEdit &&
        (adding ? (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="e.g. 4, Borang B/Be"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={submitAdd}
            className="text-xs rounded border border-neutral-300 px-2 py-0.5 w-32"
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-neutral-400 hover:text-neutral-700">
            + sub-item
          </button>
        ))}
    </div>
  );
}

function AddChecklistItemRow({ caseId }: { caseId: string }) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    startTransition(() => addChecklistItem(caseId, value));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        placeholder="Add checklist item (e.g. Client Info, Prop Doc)"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={isPending}
        className="flex-1 text-sm rounded-md border border-neutral-300 px-3 py-1.5"
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function UnmatchedRow({
  caseId,
  doc,
  candidateDocNames,
}: {
  caseId: string;
  doc: SignedCaseDocument;
  candidateDocNames: string[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-800 flex items-center gap-2">
          {doc.signedUrl ? (
            <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="underline">
              {doc.original_file_name}
            </a>
          ) : (
            doc.original_file_name
          )}
          {doc.ai_extraction_status !== "done" && <RetryButton caseId={caseId} caseDocumentId={doc.id} />}
        </span>
        <select
          disabled={isPending}
          defaultValue=""
          onChange={(e) => {
            const docName = e.target.value;
            if (docName) startTransition(() => assignDocumentMatch(doc.id, caseId, docName));
          }}
          className="text-xs rounded border border-neutral-300 px-2 py-1"
        >
          <option value="" disabled>
            Assign to…
          </option>
          {candidateDocNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {doc.ai_extracted_data && <ExtractionSummary caseId={caseId} extraction={doc.ai_extracted_data} sourceLabel={doc.original_file_name} />}
    </li>
  );
}
