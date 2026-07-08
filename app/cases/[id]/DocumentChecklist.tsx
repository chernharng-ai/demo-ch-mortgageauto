"use client";

import { useTransition } from "react";
import { updateDocumentStatus } from "@/lib/actions/cases";
import type { Bank, DocStatus, DocumentItem } from "@/lib/mortgage/types";

const STATUS_STYLES: Record<DocStatus, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  received: "bg-emerald-100 text-emerald-800",
  missing: "bg-red-100 text-red-700",
};

export default function DocumentChecklist({
  caseId,
  items,
  banks,
  canEdit,
}: {
  caseId: string;
  items: DocumentItem[];
  banks: Bank[];
  canEdit: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">No document checklist yet.</p>;
  }

  const bankName = (bankId: string | null) => banks.find((b) => b.id === bankId)?.name ?? "General";
  const grouped = new Map<string, DocumentItem[]>();
  for (const item of items) {
    const key = bankName(item.bank_id);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([bank, docs]) => (
        <div key={bank}>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{bank}</h3>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <DocRow key={doc.id} caseId={caseId} doc={doc} canEdit={canEdit} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DocRow({ caseId, doc, canEdit }: { caseId: string; doc: DocumentItem; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: DocStatus) {
    startTransition(() => {
      updateDocumentStatus(doc.id, caseId, status);
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
      <span className="text-sm text-neutral-800">{doc.doc_name}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs rounded-full px-2 py-0.5 font-medium capitalize ${STATUS_STYLES[doc.status]}`}>{doc.status}</span>
        {canEdit && (
          <div className="flex gap-1" aria-disabled={isPending}>
            {(["pending", "received", "missing"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={isPending || doc.status === s}
                onClick={() => setStatus(s)}
                className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed capitalize"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
