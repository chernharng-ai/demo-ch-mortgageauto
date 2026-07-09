"use client";

import { useTransition } from "react";
import { updateCaseProfile } from "@/lib/actions/calculations";
import type { Case } from "@/lib/mortgage/types";

export default function CaseProfile({ caseId, caseRow, canEdit }: { caseId: string; caseRow: Case; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();

  function update(applicantType: Case["applicant_type"], propertyLocation: Case["property_location"], propertyType: Case["property_type"]) {
    startTransition(() => updateCaseProfile(caseId, applicantType, propertyLocation, propertyType));
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-neutral-600">
        {caseRow.applicant_type === "joint" ? "Joint" : "Single"} applicant · {caseRow.property_location === "urban" ? "Urban" : "Non-urban"} ·{" "}
        {caseRow.property_type === "under_construction" ? "Under construction" : "Completed property"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 text-sm" aria-disabled={isPending}>
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Applicant:</span>
        <select
          value={caseRow.applicant_type}
          onChange={(e) => update(e.target.value as Case["applicant_type"], caseRow.property_location, caseRow.property_type)}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm bg-white"
        >
          <option value="single">Single</option>
          <option value="joint">Joint</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Location:</span>
        <select
          value={caseRow.property_location}
          onChange={(e) => update(caseRow.applicant_type, e.target.value as Case["property_location"], caseRow.property_type)}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm bg-white"
        >
          <option value="urban">Urban</option>
          <option value="non_urban">Non-urban</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Property:</span>
        <select
          value={caseRow.property_type}
          onChange={(e) => update(caseRow.applicant_type, caseRow.property_location, e.target.value as Case["property_type"])}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm bg-white"
        >
          <option value="completed">Completed / subsale</option>
          <option value="under_construction">Under construction</option>
        </select>
      </label>
    </div>
  );
}
