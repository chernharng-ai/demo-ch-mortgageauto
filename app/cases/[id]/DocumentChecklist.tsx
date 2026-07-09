"use client";

import { useTransition } from "react";
import { resetDocumentGroupStatus, assignDocumentMatch } from "@/lib/actions/documents";
import type { CaseDocument, DocStatus, DocumentItem } from "@/lib/mortgage/types";
import BulkDocumentUpload from "./BulkDocumentUpload";

type SignedCaseDocument = CaseDocument & { signedUrl: string | null };

interface DocGroup {
  docName: string;
  status: DocStatus;
  bankCount: number;
  document: SignedCaseDocument | null;
}

export default function DocumentChecklist({
  caseId,
  items,
  caseDocuments,
  canEdit,
}: {
  caseId: string;
  items: DocumentItem[];
  caseDocuments: SignedCaseDocument[];
  canEdit: boolean;
}) {
  const candidateDocNames = [...new Set(items.map((i) => i.doc_name))];

  const groups: DocGroup[] = candidateDocNames.map((docName) => {
    const groupItems = items.filter((i) => i.doc_name === docName);
    const document = [...caseDocuments].reverse().find((d) => d.matched_doc_name === docName) ?? null;
    return { docName, status: groupItems[0]?.status ?? "pending", bankCount: groupItems.length, document };
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
  const received = group.status === "received";

  return (
    <li className="rounded-md border border-neutral-200 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-800 flex items-center gap-2">
          <span aria-hidden>{received ? "✅" : "⚠️"}</span>
          {group.docName}
          <span className="text-xs text-neutral-400">
            ({group.bankCount} bank{group.bankCount === 1 ? "" : "s"})
          </span>
        </span>
        {canEdit && (
          <div className="flex gap-1" aria-disabled={isPending}>
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
          </div>
        )}
      </div>
      {group.document && (
        <p className="text-xs text-neutral-400 mt-1">
          {group.document.signedUrl ? (
            <a href={group.document.signedUrl} target="_blank" rel="noreferrer" className="underline hover:text-neutral-600">
              {group.document.file_name}
            </a>
          ) : (
            group.document.file_name
          )}
        </p>
      )}
    </li>
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
    <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-800">
        {doc.signedUrl ? (
          <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="underline">
            {doc.original_file_name}
          </a>
        ) : (
          doc.original_file_name
        )}
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
    </li>
  );
}
