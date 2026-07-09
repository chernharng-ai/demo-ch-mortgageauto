// Deterministic mortgage calculation engine — no AI involved.
// Formulas come from docs/INTELLIGENCE_LAYER.md and docs/DATA_MODEL.md.

export type IncomeRules = Record<string, Record<string, number>>;

/** One income bracket: applies `dsr` when monthly eligible income <= `max` (null = "and above"). */
export interface DsrTier {
  max: number | null;
  dsr: number;
}

export interface BankCalcParams {
  dsr_limit?: number;
  dsr_tiers?: DsrTier[];
  stress_rate: number;
  tenure_max_years?: number;
  income_rules: IncomeRules;
  bank_code?: string;
  notes?: string;
  /** Full verbatim underwriting reference (DSR, NDI, bonus/ASB formulas, etc.) — see app/banks/GuidelineReference.tsx for labels. */
  guideline?: Record<string, string | null>;
}

/** Resolves the applicable DSR ceiling for this income — tiered brackets take priority over a flat dsr_limit. */
export function resolveDsrLimit(eligibleIncome: number, calcParams: BankCalcParams): number | null {
  if (calcParams.dsr_tiers && calcParams.dsr_tiers.length > 0) {
    const sorted = [...calcParams.dsr_tiers].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
    const tier = sorted.find((t) => t.max === null || eligibleIncome <= t.max);
    return tier ? tier.dsr : sorted[sorted.length - 1].dsr;
  }
  return calcParams.dsr_limit ?? null;
}

export interface IncomeEntryLike {
  income_type: string;
  gross_amount: number;
  frequency: string;
}

function normalizeEmploymentType(employmentType: string): string {
  return employmentType.replace(/-/g, "_");
}

function monthlyAmount(entry: IncomeEntryLike): number {
  return entry.frequency === "annual" ? entry.gross_amount / 12 : entry.gross_amount;
}

/** Eligible income = sum of (monthly gross × bank multiplier for that income type). */
export function computeEligibleIncome(
  entries: IncomeEntryLike[],
  employmentType: string,
  incomeRules: IncomeRules,
): number {
  const rules = incomeRules[normalizeEmploymentType(employmentType)] ?? {};
  const total = entries.reduce((sum, entry) => {
    const multiplier = rules[entry.income_type] ?? 0;
    return sum + monthlyAmount(entry) * multiplier;
  }, 0);
  return round2(total);
}

export interface LoanEligibilityResult {
  max_loan_amount: number;
  monthly_instalment: number;
  dsr_ratio: number;
}

/**
 * Max loan a bank will finance for this income, stress-tested at the bank's
 * stress_rate over its longest available tenure — a pure affordability
 * ceiling, not tied to any specific property. This is the headline number
 * for "review all banks' max eligibility," not a yes/no on a target loan.
 */
export function computeLoanEligibility(
  eligibleIncome: number,
  loanTenureYears: number | null,
  calcParams: BankCalcParams,
): LoanEligibilityResult {
  const dsrLimit = resolveDsrLimit(eligibleIncome, calcParams) ?? 0;
  const maxTenure = calcParams.tenure_max_years ?? 35;
  const tenureYears = Math.min(loanTenureYears || maxTenure, maxTenure);
  const n = tenureYears * 12;
  const r = calcParams.stress_rate / 12;

  const pvFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
  const affordableInstalment = eligibleIncome * dsrLimit;
  const maxLoanAmount = Math.max(0, affordableInstalment * pvFactor);
  const monthlyInstalment = affordableInstalment;
  const dsrRatio = eligibleIncome > 0 ? monthlyInstalment / eligibleIncome : 0;

  return {
    max_loan_amount: round2(maxLoanAmount),
    monthly_instalment: round2(monthlyInstalment),
    dsr_ratio: round4(dsrRatio),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
