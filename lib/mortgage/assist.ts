// Intelligence Layer (docs/INTELLIGENCE_LAYER.md, Sprint 4) — deterministic,
// rule-based heuristics, NOT calls to a third-party AI API. docs/SECURITY.md
// requires an explicit data-handling review before client data leaves this
// system, which hasn't happened, so nothing here talks to an external model.

import type { IncomeType } from "./types";

export const AI_SUGGESTION_SOURCE = "rule_based_keyword_match";

const KEYWORD_RULES: { pattern: RegExp; type: IncomeType; confidence: number }[] = [
  { pattern: /commission/i, type: "commission", confidence: 0.8 },
  { pattern: /rent|tenancy|sewa/i, type: "rental", confidence: 0.8 },
  { pattern: /profit|business|self.?employ|invoice/i, type: "net_profit", confidence: 0.7 },
  { pattern: /bonus|allowance|claim|transport|meal/i, type: "allowance", confidence: 0.6 },
  { pattern: /payslip|salary|basic|gaji|ea form/i, type: "basic", confidence: 0.7 },
];

export interface IncomeTypeSuggestion {
  type: IncomeType;
  confidence: number;
  source: string;
}

/** Suggests an income_type from free-text supporting-doc description. */
export function suggestIncomeType(description: string): IncomeTypeSuggestion | null {
  const text = description.trim();
  if (!text) return null;

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      return { type: rule.type, confidence: rule.confidence, source: AI_SUGGESTION_SOURCE };
    }
  }
  return null;
}

/** Flags an income amount as anomalous if it's more than 2x the client's prior-case average for the same income type. */
export function isAnomalousAmount(amount: number, priorAmounts: number[]): boolean {
  if (priorAmounts.length === 0) return false;
  const average = priorAmounts.reduce((sum, n) => sum + n, 0) / priorAmounts.length;
  if (average <= 0) return false;
  return amount > average * 2;
}

export interface CaseSummaryInput {
  clientName: string;
  employmentType: string;
  propertyValue: number | null;
  docCompleteness: number;
  results: {
    bankName: string;
    eligibleIncome: number;
    maxLoanAmount: number;
    dsrRatio: number;
    eligibilityStatus: string;
  }[];
}

function formatMYR(n: number): string {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

/** Builds a templated draft narrative from calculation results — no external AI call. */
export function generateCaseSummary(input: CaseSummaryInput): string {
  const { clientName, employmentType, docCompleteness, results } = input;

  if (results.length === 0) {
    return `${clientName} (${employmentType}) has not yet had a calculation run. Add income entries and run the calculation to generate an eligibility summary.`;
  }

  const best = [...results].sort((a, b) => b.maxLoanAmount - a.maxLoanAmount)[0];
  const eligibleBanks = results.filter((r) => r.eligibilityStatus === "eligible");

  const lines = [
    `${clientName} is ${employmentType} with an eligible income of ${formatMYR(best.eligibleIncome)}/month per ${best.bankName}'s method.`,
    `The strongest offer is from ${best.bankName}: max loan ${formatMYR(best.maxLoanAmount)} at a ${(best.dsrRatio * 100).toFixed(1)}% DSR (${best.eligibilityStatus}).`,
    eligibleBanks.length > 1
      ? `${eligibleBanks.length} of ${results.length} configured banks currently show as eligible.`
      : eligibleBanks.length === 1
        ? `Only ${eligibleBanks[0].bankName} currently shows as eligible.`
        : `No bank currently shows as eligible at the requested property value — consider a lower-value property or additional income.`,
    docCompleteness < 100
      ? `Document checklist is ${docCompleteness}% complete — chase outstanding items before submission.`
      : `Document checklist is fully complete.`,
  ];

  return lines.join(" ");
}
