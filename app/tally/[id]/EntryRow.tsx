"use client";

import { useState, useTransition } from "react";
import { updateEntry, confirmEntry } from "@/lib/actions/tally";
import type { EntryWithField } from "@/lib/tally/types";

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  confirmed: { badge: "bg-emerald-100 text-emerald-800", label: "confirmed" },
  unreviewed: { badge: "bg-emerald-50 text-emerald-700", label: "extracted" },
  uncertain: { badge: "bg-amber-100 text-amber-800", label: "uncertain" },
  missing: { badge: "bg-red-100 text-red-700", label: "MISSING" },
};

export default function EntryRow({ entry, submissionId }: { entry: EntryWithField; submissionId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.extracted_value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = STATUS_STYLES[entry.review_status] ?? STATUS_STYLES.unreviewed;
  const field = entry.template_fields;
  const missing = entry.review_status === "missing" || entry.extracted_value === null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateEntry(entry.id, submissionId, draft);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmEntry(entry.id, submissionId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-4 py-2.5 align-top">
        <span className="font-medium text-neutral-900">{field?.field_label}</span>
        {field?.is_required && <span className="ml-1 text-red-500">*</span>}
      </td>
      <td className="px-4 py-2.5 align-top">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="Type value (empty = mark missing)"
              className="w-full min-w-40 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              {isPending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(entry.extracted_value ?? ""); }}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to edit"
            className={`text-left hover:underline ${missing ? "italic text-red-500" : "text-neutral-900"}`}
          >
            {missing ? "— add value" : entry.extracted_value}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-4 py-2.5 align-top">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.badge}`}>
          {status.label}
        </span>
        {entry.source && entry.source !== "missing" && (
          <span className="ml-1.5 text-xs text-neutral-400">{entry.source}</span>
        )}
      </td>
      <td className="px-4 py-2.5 align-top tabular-nums text-neutral-600">
        {entry.confidence !== null && entry.source !== "missing" && entry.source !== "manual"
          ? `${Math.round(Number(entry.confidence) * 100)}%`
          : "—"}
      </td>
      <td className="px-4 py-2.5 align-top">
        {!editing && !missing && entry.review_status !== "confirmed" && (
          <button
            type="button"
            onClick={confirm}
            disabled={isPending}
            className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            Confirm ✓
          </button>
        )}
      </td>
    </tr>
  );
}
