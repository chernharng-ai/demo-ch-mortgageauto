// Assembles the officer's copy-pasteable case review note. The two layouts
// (business owner / salary earner) mirror the exact format the officer
// already writes by hand — most fields are their own judgment calls (CCRIS
// reads, trade reference checks, bank-specific SPA math) that live outside
// this app's data model, so they're captured as plain text and inserted
// verbatim rather than re-derived.

import type { Case, Client, DocStatus, DocumentItem } from "./types";

export interface DocChecklistGroup {
  docName: string;
  status: DocStatus;
}

export function buildDocChecklistGroups(items: DocumentItem[]): DocChecklistGroup[] {
  const names = [...new Set(items.map((i) => i.doc_name))];
  return names.map((docName) => {
    const groupItems = items.filter((i) => i.doc_name === docName);
    return { docName, status: groupItems[0]?.status ?? "pending" };
  });
}

function icon(status: DocStatus) {
  return status === "received" ? "✅" : "⚠️";
}

function line(label: string, value: string | number | null | undefined) {
  return `${label} : ${value ?? ""}`;
}

export function generateReviewNote(caseRow: Case, client: Client, docGroups: DocChecklistGroup[]): string {
  const docChecklist = docGroups.map((g) => `- ${g.docName} ${icon(g.status)}`).join("\n");

  if (caseRow.review_client_type === "salary_earner") {
    return [
      `*Client Name :* ${client.full_name}${client.ic_number ? ` (${client.ic_number})` : ""}`,
      "",
      `*Doc Link :* ${caseRow.review_doc_link ?? ""}`,
      "",
      "*Info :* ",
      `~ Age : ${caseRow.review_age ?? ""}`,
      `~ Residential Address : ${caseRow.review_residential_address ?? ""}`,
      `~ Working Address : ${caseRow.review_working_address ?? ""}`,
      "",
      `*Gross Income :* ${caseRow.review_gross_income ?? ""}`,
      `*Nett Income :* ${caseRow.review_nett_income ?? ""}`,
      `*Max Allowed Commitment :* ${caseRow.review_max_allowed_commitment ?? ""}`,
      `*Commitment (CCRISS + Payslip + NCLI) :* ${caseRow.review_commitment_breakdown ?? ""}`,
      "",
      "*Attention:* ",
      caseRow.review_attention ?? "",
      "",
      "*Bank Eligible :* ",
      caseRow.review_bank_eligible_notes ?? "",
      "",
      `*Risk Level :* ${caseRow.review_risk_level ?? ""}`,
      `*Approval Chance :* ${caseRow.review_approval_chance != null ? `${caseRow.review_approval_chance}%` : ""}`,
      "",
      "*Agent To Check With Client :* ",
      caseRow.review_agent_notes ?? "",
      "",
      "*Document Checklist :*",
      docChecklist,
      "",
      "*Symbols*",
      "✅ - Provided ",
      "⚠️ - Pending ",
      "❌ - Client mention they do not have it",
    ].join("\n");
  }

  // business_owner (default)
  return [
    line("Client Name", client.full_name),
    "",
    line("Doc link", caseRow.review_doc_link),
    "",
    line("Age", caseRow.review_age),
    "",
    line("Attn", ""),
    caseRow.review_attention ?? "",
    "",
    line("GMI", caseRow.review_gross_income),
    "",
    line("NMI", caseRow.review_nett_income),
    "",
    line("Commitment", caseRow.review_commitment_breakdown),
    "",
    line("Project", caseRow.review_project),
    "",
    "Bank Eligible : ",
    "",
    caseRow.review_bank_eligible_notes ?? "",
    "",
    "",
    line("Risk Level", caseRow.review_risk_level),
    line("Approval Chance", caseRow.review_approval_chance != null ? `${caseRow.review_approval_chance} %` : ""),
    "",
    line("Agent To KYC", ""),
    caseRow.review_agent_notes ?? "",
    "",
    "Pending Doc :",
    "",
    docChecklist,
  ].join("\n");
}
