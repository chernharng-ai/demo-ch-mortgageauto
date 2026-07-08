"use client";

import { useTransition } from "react";
import { deleteCase } from "@/lib/actions/cases";

export default function DeleteCaseButton({ caseId, clientName }: { caseId: string; clientName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(`Delete the case for "${clientName}"? This cannot be undone.`);
    if (!confirmed) return;
    startTransition(() => {
      deleteCase(caseId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-red-600 hover:underline disabled:opacity-40 whitespace-nowrap"
    >
      {isPending ? "Deleting…" : "Delete Case"}
    </button>
  );
}
