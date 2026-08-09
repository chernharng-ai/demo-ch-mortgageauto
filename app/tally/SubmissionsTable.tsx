"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSubmissionsBulk } from "@/lib/actions/tally";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  reviewed: "bg-amber-100 text-amber-800",
  finalized: "bg-emerald-100 text-emerald-800",
};

export interface SubmissionRowData {
  id: string;
  client_name: string | null;
  agent_name: string | null;
  agent_agency: string | null;
  source_format: string | null;
  status: string;
  completeness_score: number;
  created_at: string;
  missing: number;
}

export default function SubmissionsTable({ rows }: { rows: SubmissionRowData[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function deleteSelected() {
    const count = selected.size;
    if (count === 0) return;
    if (!window.confirm(`Delete ${count} submission${count === 1 ? "" : "s"} and all their tally entries? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSubmissionsBulk([...selected]);
      if (result.error) setError(result.error);
      else setSelected(new Set());
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-900">{selected.size} selected</span>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={isPending}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {isPending ? "Deleting…" : "Delete selected"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Clear
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 accent-neutral-900"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Missing req.</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${selected.has(s.id) ? "bg-neutral-50" : ""}`}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={`Select ${s.client_name ?? "submission"}`}
                    className="h-4 w-4 accent-neutral-900"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/tally/${s.id}`} className="font-medium text-neutral-900 hover:underline">
                    {s.client_name ?? "Unnamed client"}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {s.agent_name ?? "—"}
                  {s.agent_agency && <span className="text-neutral-400"> · {s.agent_agency}</span>}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{s.source_format ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[s.status] ?? STATUS_BADGES.pending}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {s.missing > 0 ? (
                    <span className="font-semibold text-red-600">{s.missing}</span>
                  ) : (
                    <span className="text-emerald-600">0</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-neutral-900">
                  {Math.round(Number(s.completeness_score))}%
                </td>
                <td className="px-4 py-2.5 text-neutral-500">
                  {new Date(s.created_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
