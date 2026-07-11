// The officer's real document collection checklist — richer than the
// 6-item list generated from each bank's doc_requirements (which reflects
// what banks formally require, not everything actually collected from the
// client). This is inserted as case-specific items (document_items with
// bank_id null) alongside the bank-driven checklist, not a replacement —
// some overlap with bank items is expected and fine to remove manually.

export interface ChecklistTemplateInput {
  employmentType: string;
  financingScheme: "bank_loan" | "lppsa";
  propertyType: "completed" | "under_construction";
  isOverseas: boolean;
  hasRentalIncome: boolean;
  needsSiteVisit: boolean;
}

const SALARY_EARNER_DOCS = [
  "Latest 3 months payslip (6 months if OT / incentive / commission income)",
  "Latest 3/6 months bank statement showing salary crediting",
  "Latest 2 years EPF statement",
  "Proof of saving",
  "Latest 2 years EA form / bonus slip",
  "Employment letter & confirmation letter (below 1 year staff)",
  "Employment verification letter (for Malay bank)",
  "CTOS report",
  "Experian report",
  "Client info",
  "Booking form",
  "Applicant's IC",
];

const SELF_EMPLOYED_DOCS = [
  "Latest 6 months company bank statement",
  "Latest 2 years income tax statement (full set)",
  "Company SSM (full set)",
  "Backup liquidity (savings / FD / unit trust / share)",
  "CTOS report",
  "Experian report",
  "Client info",
  "Booking form",
  "Applicant's IC",
];

const OVERSEAS_EXTRA_DOCS = ["Income tax", "Credit bureau report", "Employment verification letter", "Working permit (front and back)"];

const SUBSALES_EXTRA_DOCS = ["Copy of vendor SPA", "Title copy", "Lawyer loan quotation (if financing legal fees)"];

const SITE_VISIT_DOCS = [
  "Site visit — road signboard",
  "Site visit — building photo",
  "Site visit — company signboard with unit number",
  "Site visit — main entrance",
  "Site visit — right view of main entrance",
  "Site visit — left view of main entrance",
  "Site visit — internal area (x3)",
  "Site visit — equipment / workshop (if any)",
];

const RENTAL_INCOME_DOCS = ["6 months bank statement showing rental crediting", "Tenancy agreement with stamping", "SPA of the rented house"];

const LPPSA_DOCS = [
  "IC",
  "Latest payslip",
  "Land search",
  "Draft SPA",
  "Owner SPA till principal SPA (for unperfected unit / master title property)",
  "Bank redemption letter (owner's balance loan)",
  "Booking form",
];

function isSelfEmployed(employmentType: string): boolean {
  return employmentType.replace(/-/g, "_") === "self_employed";
}

/** Builds the doc_name list this case should collect, based on employment type and case flags. */
export function buildChecklistTemplate(input: ChecklistTemplateInput): string[] {
  if (input.financingScheme === "lppsa") {
    return [...LPPSA_DOCS];
  }

  const docs = [...(isSelfEmployed(input.employmentType) ? SELF_EMPLOYED_DOCS : SALARY_EARNER_DOCS)];

  if (input.isOverseas && !isSelfEmployed(input.employmentType)) docs.push(...OVERSEAS_EXTRA_DOCS);
  if (input.propertyType === "completed") docs.push(...SUBSALES_EXTRA_DOCS);
  if (input.needsSiteVisit) docs.push(...SITE_VISIT_DOCS);
  if (input.hasRentalIncome) docs.push(...RENTAL_INCOME_DOCS);

  return docs;
}

/**
 * Which month chips (as month numbers, e.g. ["4","5","6"]) a monthly income
 * document item should expect, counting back from the last complete month
 * before the application date. Per the officer's rule: 3 months for fixed
 * salary, 6 when the client has variable income (OT/incentive/commission) —
 * except items that are explicitly 6-month regardless (company bank
 * statement, rental crediting). Returns [] for items with no monthly period
 * (IC, EPF, tax forms, credit reports…).
 */
export function expectedPeriodLabels(docName: string, applicationDate: string, hasVariableIncome: boolean): string[] {
  const name = docName.toLowerCase();
  const isMonthly = name.includes("payslip") || name.includes("bank statement");
  if (!isMonthly) return [];

  const alwaysSixMonths = name.includes("6 months") && !name.includes("3/6");
  const monthsNeeded = alwaysSixMonths || hasVariableIncome ? 6 : 3;

  // Parse "YYYY-MM-DD" directly — new Date() would shift across timezones.
  const appMonth = Number(applicationDate.slice(5, 7)); // 1-based
  const labels: string[] = [];
  for (let i = 1; i <= monthsNeeded; i++) {
    const month = ((appMonth - 1 - i + 12) % 12) + 1;
    labels.unshift(String(month));
  }
  return labels;
}
