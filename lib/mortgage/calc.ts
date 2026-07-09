// Deterministic mortgage calculation engine — no AI involved.
// Formulas come from docs/INTELLIGENCE_LAYER.md, docs/DATA_MODEL.md, and the
// officer's "bank guideline" source sheet (see supabase/migrations/0010).
//
// A bank approves a loan only if BOTH DSR (debt service ratio) and NDI (net
// disposable income after all commitments + the new instalment) clear the
// bank's floor — whichever constraint allows the smaller loan wins. Every
// bank is evaluated at up to two financing packages: the standard 90%
// margin, and (where the bank offers it) 100%/SJKP financing, which usually
// carries its own DSR tiers, NDI floor, and income/SPA caps.

export type IncomeRules = Record<string, Record<string, number>>;
export type ApplicantType = "single" | "joint";
export type PropertyLocation = "urban" | "non_urban";
export type PropertyType = "completed" | "under_construction";
export type FinancingPackage = "standard_90" | "sjkp_100";

/** One income bracket: applies `dsr` when monthly eligible income <= `max` (null = "and above"). */
export interface DsrTier {
  max: number | null;
  dsr: number;
}

export interface NdiFloor {
  single?: number | null;
  joint?: number | null;
  urban_single?: number | null;
  urban_joint?: number | null;
  non_urban_single?: number | null;
  non_urban_joint?: number | null;
  below_300k?: number | null;
  above_300k?: number | null;
}

export interface SjkpParams {
  available: boolean;
  dsr_tiers?: DsrTier[] | null;
  dsr_tiers_by_property_price?: { below_300k: number; above_300k: number } | null;
  ndi_floor?: { single: number | null; joint: number | null } | null;
  max_income?: number | null;
  max_spa?: number | null;
}

export interface BankCalcParams {
  dsr_limit?: number;
  dsr_tiers?: DsrTier[];
  dsr_tiers_non_urban?: DsrTier[];
  dsr_tiers_under_construction?: DsrTier[];
  ndi_floor?: NdiFloor;
  sjkp?: SjkpParams;
  stress_rate: number;
  tenure_max_years?: number;
  income_rules: IncomeRules;
  bank_code?: string;
  notes?: string;
  /** Full verbatim underwriting reference (DSR, NDI, bonus/ASB formulas, etc.) — see app/banks/GuidelineReference.tsx for labels. */
  guideline?: Record<string, string | null>;
}

function pickDsrTiers(calcParams: BankCalcParams, propertyType: PropertyType, propertyLocation: PropertyLocation): DsrTier[] | undefined {
  if (propertyType === "under_construction" && calcParams.dsr_tiers_under_construction) {
    return calcParams.dsr_tiers_under_construction;
  }
  if (propertyLocation === "non_urban" && calcParams.dsr_tiers_non_urban) {
    return calcParams.dsr_tiers_non_urban;
  }
  return calcParams.dsr_tiers;
}

/** Resolves the applicable DSR ceiling for this income — tiered brackets take priority over a flat dsr_limit. */
export function resolveDsrLimit(eligibleIncome: number, tiers: DsrTier[] | undefined, flatLimit?: number): number | null {
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
    const tier = sorted.find((t) => t.max === null || eligibleIncome <= t.max);
    return tier ? tier.dsr : sorted[sorted.length - 1].dsr;
  }
  return flatLimit ?? null;
}

/** Resolves the NDI floor for this applicant/location shape. `propertyPriceHint` disambiguates below/above-300k tiers when known (e.g. mid-SJKP-resolution); falls back to the more conservative (higher) floor when not. */
function resolveNdiFloor(ndi: NdiFloor | undefined | null, applicantType: ApplicantType, propertyLocation: PropertyLocation, propertyPriceHint: number | null): number | null {
  if (!ndi) return null;
  if (ndi.single != null || ndi.joint != null) {
    return applicantType === "joint" ? ndi.joint ?? null : ndi.single ?? null;
  }
  if (ndi.urban_single != null) {
    return propertyLocation === "urban"
      ? applicantType === "joint" ? ndi.urban_joint ?? null : ndi.urban_single ?? null
      : applicantType === "joint" ? ndi.non_urban_joint ?? null : ndi.non_urban_single ?? null;
  }
  if (ndi.below_300k != null) {
    if (propertyPriceHint != null) return propertyPriceHint > 300000 ? ndi.above_300k ?? null : ndi.below_300k ?? null;
    return Math.max(ndi.below_300k ?? 0, ndi.above_300k ?? 0);
  }
  return null;
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

function affordabilityToLoan(instalment: number, stressRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  const r = stressRate / 12;
  const pvFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
  return Math.max(0, instalment * pvFactor);
}

export interface PackageEligibilityResult {
  available: boolean;
  max_loan_amount: number;
  monthly_instalment: number;
  dsr_ratio: number;
  ndi_after: number | null;
  capped_by: "dsr" | "ndi" | "spa_cap" | null;
  unavailable_reason?: string;
}

/**
 * Max loan a bank will finance for this income + package, stress-tested at
 * the bank's stress_rate over its longest available tenure. DSR and NDI are
 * both checked; whichever ceiling permits the smaller instalment wins (per
 * the officer's underwriting rule: "take whichever lower"). Not tied to any
 * specific property — this is the headline affordability ceiling.
 */
export function computePackageEligibility(
  eligibleIncome: number,
  existingCommitments: number,
  applicantType: ApplicantType,
  propertyLocation: PropertyLocation,
  propertyType: PropertyType,
  calcParams: BankCalcParams,
  pkg: FinancingPackage,
): PackageEligibilityResult {
  const notAvailable = (reason: string): PackageEligibilityResult => ({
    available: false,
    max_loan_amount: 0,
    monthly_instalment: 0,
    dsr_ratio: 0,
    ndi_after: null,
    capped_by: null,
    unavailable_reason: reason,
  });

  const maxTenure = calcParams.tenure_max_years ?? 35;
  const sjkp = calcParams.sjkp;

  if (pkg === "sjkp_100") {
    if (!sjkp || !sjkp.available) return notAvailable("Bank does not offer 100%/SJKP financing.");
    if (sjkp.max_income != null && eligibleIncome > sjkp.max_income) {
      return notAvailable(`Income exceeds this bank's SJKP cap of RM ${sjkp.max_income.toLocaleString()}.`);
    }
  }

  let dsrLimit: number | null;
  let propertyPriceHint: number | null = null;

  if (pkg === "sjkp_100" && sjkp?.dsr_tiers_by_property_price) {
    // Two-pass: try the above-300k rate, see if the resulting loan (== implied
    // price at 100% margin) actually clears 300k; otherwise use the below-300k rate.
    const aboveDsr = sjkp.dsr_tiers_by_property_price.above_300k;
    const trialInstalment = Math.max(0, eligibleIncome * aboveDsr - existingCommitments);
    const trialLoan = affordabilityToLoan(trialInstalment, calcParams.stress_rate, maxTenure);
    dsrLimit = trialLoan > 300000 ? aboveDsr : sjkp.dsr_tiers_by_property_price.below_300k;
    propertyPriceHint = trialLoan;
  } else if (pkg === "sjkp_100") {
    const tiers = sjkp?.dsr_tiers ?? pickDsrTiers(calcParams, propertyType, propertyLocation);
    dsrLimit = resolveDsrLimit(eligibleIncome, tiers, calcParams.dsr_limit);
  } else {
    const tiers = pickDsrTiers(calcParams, propertyType, propertyLocation);
    dsrLimit = resolveDsrLimit(eligibleIncome, tiers, calcParams.dsr_limit);
  }

  if (dsrLimit == null) return notAvailable("No DSR configuration for this bank.");

  const dsrCappedInstalment = Math.max(0, eligibleIncome * dsrLimit - existingCommitments);

  const ndiSource = pkg === "sjkp_100" && sjkp?.ndi_floor ? sjkp.ndi_floor : calcParams.ndi_floor;
  const ndiFloor = resolveNdiFloor(ndiSource, applicantType, propertyLocation, propertyPriceHint);
  const ndiCappedInstalment = ndiFloor != null ? Math.max(0, eligibleIncome - existingCommitments - ndiFloor) : Infinity;

  const cappedByDsrOrNdi: "dsr" | "ndi" = ndiCappedInstalment < dsrCappedInstalment ? "ndi" : "dsr";
  const affordableInstalment = Math.min(dsrCappedInstalment, ndiCappedInstalment);

  let maxLoanAmount = affordabilityToLoan(affordableInstalment, calcParams.stress_rate, maxTenure);
  let finalInstalment = affordableInstalment;
  let cappedBy: "dsr" | "ndi" | "spa_cap" = cappedByDsrOrNdi;

  if (pkg === "sjkp_100" && sjkp?.max_spa != null && maxLoanAmount > sjkp.max_spa) {
    maxLoanAmount = sjkp.max_spa;
    // Loan is capped below what income would otherwise support — the instalment
    // actually needed to service the capped loan is lower than affordableInstalment.
    const n = maxTenure * 12;
    const r = calcParams.stress_rate / 12;
    const pvFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
    finalInstalment = maxLoanAmount / pvFactor;
    cappedBy = "spa_cap";
  }

  const ndiAfter = eligibleIncome - existingCommitments - finalInstalment;
  const dsrRatio = eligibleIncome > 0 ? (existingCommitments + finalInstalment) / eligibleIncome : 0;

  return {
    available: true,
    max_loan_amount: round2(maxLoanAmount),
    monthly_instalment: round2(finalInstalment),
    dsr_ratio: round4(dsrRatio),
    ndi_after: round2(ndiAfter),
    capped_by: cappedBy,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
