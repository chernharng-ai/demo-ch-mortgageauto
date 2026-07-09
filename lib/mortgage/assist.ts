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
  docCompleteness: number;
  results: {
    bankName: string;
    eligibleIncome: number;
    maxLoanAmount: number;
    dsrRatio: number;
  }[];
}

function formatMYR(n: number): string {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

/** Builds a templated draft narrative from calculation results — no external AI call. */
export function generateCaseSummary(input: CaseSummaryInput): string {
  const { clientName, employmentType, docCompleteness, results } = input;

  if (results.length === 0) {
    return `${clientName} (${employmentType}) has not yet had a calculation run. Add income entries and run the calculation to rank max loan eligibility across every bank.`;
  }

  const ranked = [...results].sort((a, b) => b.maxLoanAmount - a.maxLoanAmount);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const lines = [
    `${clientName} is ${employmentType} with an eligible income of ${formatMYR(best.eligibleIncome)}/month per ${best.bankName}'s method.`,
    `Highest max loan eligibility is with ${best.bankName}: ${formatMYR(best.maxLoanAmount)} at a ${(best.dsrRatio * 100).toFixed(1)}% DSR.`,
    ranked.length > 1
      ? `Compared across ${ranked.length} banks, eligibility ranges from ${formatMYR(worst.maxLoanAmount)} (${worst.bankName}) to ${formatMYR(best.maxLoanAmount)} (${best.bankName}).`
      : `Only ${best.bankName} was compared.`,
    docCompleteness < 100
      ? `Document checklist is ${docCompleteness}% complete — chase outstanding items before submission.`
      : `Document checklist is fully complete.`,
  ];

  return lines.join(" ");
}
