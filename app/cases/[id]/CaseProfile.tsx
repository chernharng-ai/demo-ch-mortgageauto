"use client";

import { useTransition } from "react";
import { updateCaseProfile } from "@/lib/actions/calculations";
import { updateCaseChecklistProfile, generateChecklistFromTemplate } from "@/lib/actions/documents";
import type { Case } from "@/lib/mortgage/types";

export default function CaseProfile({ caseId, caseRow, canEdit }: { caseId: string; caseRow: Case; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();

  function update(applicantType: Case["applicant_type"], propertyLocation: Case["property_location"], propertyType: Case["property_type"]) {
    startTransition(() => updateCaseProfile(caseId, applicantType, propertyLocation, propertyType));
  }

  function updateChecklistFlags(
    financingScheme: Case["financing_scheme"],
    applicationDate: string,
    isOverseas: boolean,
    hasRentalIncome: boolean,
    needsSiteVisit: boolean,
  ) {
    startTransition(() => updateCaseChecklistProfile(caseId, financingScheme, applicationDate, isOverseas, hasRentalIncome, needsSiteVisit));
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-neutral-600">
        {caseRow.applicant_type === "joint" ? "Joint" : "Single"} applicant · {caseRow.property_location === "urban" ? "Urban" : "Non-urban"} ·{" "}
        {caseRow.property_type === "under_construction" ? "Under construction" : "Completed property"} ·{" "}
        {caseRow.financing_scheme === "lppsa" ? "LPPSA" : "Bank loan"}
      </p>
    );
  }

  return (
    <div className="space-y-3" aria-disabled={isPending}>
      <div className="flex flex-wrap gap-3 text-sm">
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

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-neutral-500">Financing:</span>
          <select
            value={caseRow.financing_scheme}
            onChange={(e) =>
              updateChecklistFlags(
                e.target.value as Case["financing_scheme"],
                caseRow.application_date,
                caseRow.is_overseas,
                caseRow.has_rental_income,
                caseRow.needs_site_visit,
              )
            }
            disabled={isPending}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm bg-white"
          >
            <option value="bank_loan">Bank loan</option>
            <option value="lppsa">LPPSA</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-neutral-500">Date:</span>
          <input
            type="date"
            value={caseRow.application_date}
            onChange={(e) =>
              updateChecklistFlags(caseRow.financing_scheme, e.target.value, caseRow.is_overseas, caseRow.has_rental_income, caseRow.needs_site_visit)
            }
            disabled={isPending}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm bg-white"
          />
        </label>
      </div>

      {caseRow.financing_scheme === "bank_loan" && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={caseRow.is_overseas}
              onChange={(e) =>
                updateChecklistFlags(caseRow.financing_scheme, caseRow.application_date, e.target.checked, caseRow.has_rental_income, caseRow.needs_site_visit)
              }
              disabled={isPending}
              className="accent-neutral-900"
            />
            <span className="text-neutral-600">Working overseas</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={caseRow.has_rental_income}
              onChange={(e) =>
                updateChecklistFlags(caseRow.financing_scheme, caseRow.application_date, caseRow.is_overseas, e.target.checked, caseRow.needs_site_visit)
              }
              disabled={isPending}
              className="accent-neutral-900"
            />
            <span className="text-neutral-600">Has rental income</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={caseRow.needs_site_visit}
              onChange={(e) =>
                updateChecklistFlags(caseRow.financing_scheme, caseRow.application_date, caseRow.is_overseas, caseRow.has_rental_income, e.target.checked)
              }
              disabled={isPending}
              className="accent-neutral-900"
            />
            <span className="text-neutral-600">Site visit needed</span>
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={isGenerating}
        onClick={() => startGenerating(() => generateChecklistFromTemplate(caseId))}
        className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : "Generate checklist from these settings"}
      </button>
    </div>
  );
}
