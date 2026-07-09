"use client";

import { useActionState, useMemo, useState } from "react";
import { updateCaseReview, type UpdateReviewState } from "@/lib/actions/review";
import { buildDocChecklistGroups, generateReviewNote } from "@/lib/mortgage/reviewNote";
import type { Case, Client, DocumentItem, DocumentSubItem, ReviewClientType } from "@/lib/mortgage/types";

interface FormState {
  review_client_type: ReviewClientType;
  review_doc_link: string;
  review_age: string;
  review_residential_address: string;
  review_working_address: string;
  review_attention: string;
  review_gross_income: string;
  review_nett_income: string;
  review_max_allowed_commitment: string;
  review_commitment_breakdown: string;
  review_project: string;
  review_bank_eligible_notes: string;
  review_risk_level: string;
  review_approval_chance: string;
  review_agent_notes: string;
}

function toFormState(caseRow: Case, defaultDocLink: string, defaultClientType: ReviewClientType): FormState {
  return {
    review_client_type: caseRow.review_client_type ?? defaultClientType,
    review_doc_link: caseRow.review_doc_link ?? defaultDocLink,
    review_age: caseRow.review_age != null ? String(caseRow.review_age) : "",
    review_residential_address: caseRow.review_residential_address ?? "",
    review_working_address: caseRow.review_working_address ?? "",
    review_attention: caseRow.review_attention ?? "",
    review_gross_income: caseRow.review_gross_income ?? "",
    review_nett_income: caseRow.review_nett_income ?? "",
    review_max_allowed_commitment: caseRow.review_max_allowed_commitment != null ? String(caseRow.review_max_allowed_commitment) : "",
    review_commitment_breakdown: caseRow.review_commitment_breakdown ?? "",
    review_project: caseRow.review_project ?? "",
    review_bank_eligible_notes: caseRow.review_bank_eligible_notes ?? "",
    review_risk_level: caseRow.review_risk_level ?? "",
    review_approval_chance: caseRow.review_approval_chance != null ? String(caseRow.review_approval_chance) : "",
    review_agent_notes: caseRow.review_agent_notes ?? "",
  };
}

export default function CaseReviewNote({
  caseId,
  caseRow,
  client,
  documentItems,
  documentSubItems,
  appUrl,
  canEdit,
}: {
  caseId: string;
  caseRow: Case;
  client: Client;
  documentItems: DocumentItem[];
  documentSubItems: DocumentSubItem[];
  appUrl: string;
  canEdit: boolean;
}) {
  const defaultDocLink = `${appUrl}/api/cases/${caseId}/documents/zip`;
  const defaultClientType: ReviewClientType = client.employment_type === "self-employed" ? "business_owner" : "salary_earner";

  const [form, setForm] = useState<FormState>(() => toFormState(caseRow, defaultDocLink, defaultClientType));
  const [copied, setCopied] = useState(false);
  const initialState: UpdateReviewState = {};
  const [state, formAction, pending] = useActionState(updateCaseReview.bind(null, caseId), initialState);

  const docGroups = useMemo(() => buildDocChecklistGroups(documentItems, documentSubItems), [documentItems, documentSubItems]);

  const previewCase: Case = {
    ...caseRow,
    review_client_type: form.review_client_type,
    review_doc_link: form.review_doc_link || null,
    review_age: form.review_age ? Number(form.review_age) : null,
    review_residential_address: form.review_residential_address || null,
    review_working_address: form.review_working_address || null,
    review_attention: form.review_attention || null,
    review_gross_income: form.review_gross_income || null,
    review_nett_income: form.review_nett_income || null,
    review_max_allowed_commitment: form.review_max_allowed_commitment ? Number(form.review_max_allowed_commitment) : null,
    review_commitment_breakdown: form.review_commitment_breakdown || null,
    review_project: form.review_project || null,
    review_bank_eligible_notes: form.review_bank_eligible_notes || null,
    review_risk_level: form.review_risk_level || null,
    review_approval_chance: form.review_approval_chance ? Number(form.review_approval_chance) : null,
    review_agent_notes: form.review_agent_notes || null,
  };

  const preview = useMemo(() => generateReviewNote(previewCase, client, docGroups), [previewCase, client, docGroups]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCopy() {
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isBusinessOwner = form.review_client_type === "business_owner";

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Case Review Note</h2>

      {canEdit && (
        <form action={formAction} className="space-y-4 mb-6">
          <input type="hidden" name="review_client_type" value={form.review_client_type} />

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={isBusinessOwner}
                onChange={() => set("review_client_type", "business_owner")}
                className="accent-neutral-900"
              />
              Business owner
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={!isBusinessOwner}
                onChange={() => set("review_client_type", "salary_earner")}
                className="accent-neutral-900"
              />
              Salary earner
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Doc link">
              <input
                name="review_doc_link"
                value={form.review_doc_link}
                onChange={(e) => set("review_doc_link", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Age">
              <input
                type="number"
                name="review_age"
                value={form.review_age}
                onChange={(e) => set("review_age", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {!isBusinessOwner && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Residential address">
                <input
                  name="review_residential_address"
                  value={form.review_residential_address}
                  onChange={(e) => set("review_residential_address", e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Working address">
                <input
                  name="review_working_address"
                  value={form.review_working_address}
                  onChange={(e) => set("review_working_address", e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={isBusinessOwner ? "GMI" : "Gross income"}>
              <input
                name="review_gross_income"
                value={form.review_gross_income}
                onChange={(e) => set("review_gross_income", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={isBusinessOwner ? "NMI" : "Nett income"}>
              <input
                name="review_nett_income"
                value={form.review_nett_income}
                onChange={(e) => set("review_nett_income", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {!isBusinessOwner && (
            <Field label="Max allowed commitment">
              <div className="flex gap-2">
                <input
                  type="number"
                  name="review_max_allowed_commitment"
                  value={form.review_max_allowed_commitment}
                  onChange={(e) => set("review_max_allowed_commitment", e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nett = Number(form.review_nett_income);
                    if (Number.isFinite(nett) && nett > 0) set("review_max_allowed_commitment", String(Math.round(nett * 0.5 * 100) / 100));
                  }}
                  className="text-xs whitespace-nowrap rounded-md border border-neutral-300 px-2 hover:bg-neutral-100"
                >
                  Auto (50%)
                </button>
              </div>
            </Field>
          )}

          <Field label={isBusinessOwner ? "Commitment" : "Commitment (CCRIS + payslip + NCLI)"}>
            <textarea
              name="review_commitment_breakdown"
              value={form.review_commitment_breakdown}
              onChange={(e) => set("review_commitment_breakdown", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>

          {isBusinessOwner && (
            <Field label="Project">
              <input
                name="review_project"
                value={form.review_project}
                onChange={(e) => set("review_project", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          )}

          <Field label={isBusinessOwner ? "Attn / notes" : "Attention"}>
            <textarea
              name="review_attention"
              value={form.review_attention}
              onChange={(e) => set("review_attention", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Bank eligible">
            <textarea
              name="review_bank_eligible_notes"
              value={form.review_bank_eligible_notes}
              onChange={(e) => set("review_bank_eligible_notes", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Risk level">
              <input
                name="review_risk_level"
                value={form.review_risk_level}
                onChange={(e) => set("review_risk_level", e.target.value)}
                placeholder="Low / Medium / High"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Approval chance (%)">
              <input
                type="number"
                min={0}
                max={100}
                name="review_approval_chance"
                value={form.review_approval_chance}
                onChange={(e) => set("review_approval_chance", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label={isBusinessOwner ? "Agent to KYC" : "Agent to check with client"}>
            <textarea
              name="review_agent_notes"
              value={form.review_agent_notes}
              onChange={(e) => set("review_agent_notes", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>

          <button
            type="submit"
            disabled={pending}
            className="text-xs rounded-md bg-neutral-900 text-white px-3 py-1.5 font-medium hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Review"}
          </button>
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        </form>
      )}

      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-neutral-500">Preview</span>
          <button type="button" onClick={handleCopy} className="text-xs rounded-md border border-neutral-300 px-2 py-1 font-medium hover:bg-neutral-100">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="text-xs text-neutral-800 whitespace-pre-wrap font-sans">{preview}</pre>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
