"use client";

import { useState, useTransition } from "react";
import { updateCaseNotes } from "@/lib/actions/cases";

export default function CaseNotes({ caseId, notes }: { caseId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateCaseNotes(caseId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder="Add case notes…"
        className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || value === (notes ?? "")}
          className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-700 disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save Notes"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>
    </div>
  );
}
