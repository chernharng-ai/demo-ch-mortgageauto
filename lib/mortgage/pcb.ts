// Malaysian PCB (Potongan Cukai Bulanan / monthly tax deduction) — derives
// nett-of-tax income from gross salary, matching what a real payslip's Net
// Pay line would show. Sourced from the officer's "PCB CALCULATION FORMULA"
// reference sheet: flat RM9,000 personal relief, EPF relief capped at
// RM5,000/year (= 11% of the first RM45,454.55 annual income), and the
// standard resident individual progressive tax brackets. The sheet's own
// "Annual Tax" reference column was confirmed by the officer to be buggy
// (its values don't reconcile with its own bracket table) — this uses the
// standard cumulative-bracket calculation instead.

export interface TaxBracket {
  /** Upper bound of this bracket (inclusive), null = no upper bound. */
  max: number | null;
  rate: number;
  /** Total tax owed if income were exactly at this bracket's lower bound. */
  cumulativeBelow: number;
}

const PERSONAL_RELIEF = 9000;
const EPF_RELIEF_CAP = 5000;
const EPF_EMPLOYEE_RATE = 0.11;

// RM0-5,000: 0%, 5,001-20,000: 1%, 20,001-35,000: 3%, 35,001-50,000: 8%,
// 50,001-70,000: 14%, 70,001-100,000: 21%, 100,001-250,000: 24%,
// 250,001-400,000: 24.5%, 400,001-600,000: 25%, 600,001-1,000,000: 26%, above: 28%.
const TAX_BRACKETS: TaxBracket[] = [
  { max: 5000, rate: 0, cumulativeBelow: 0 },
  { max: 20000, rate: 0.01, cumulativeBelow: 0 },
  { max: 35000, rate: 0.03, cumulativeBelow: 150 },
  { max: 50000, rate: 0.08, cumulativeBelow: 600 },
  { max: 70000, rate: 0.14, cumulativeBelow: 1800 },
  { max: 100000, rate: 0.21, cumulativeBelow: 4600 },
  { max: 250000, rate: 0.24, cumulativeBelow: 10900 },
  { max: 400000, rate: 0.245, cumulativeBelow: 46900 },
  { max: 600000, rate: 0.25, cumulativeBelow: 83650 },
  { max: 1000000, rate: 0.26, cumulativeBelow: 133650 },
  { max: null, rate: 0.28, cumulativeBelow: 237650 },
];

/** Annual resident-individual income tax on chargeable income, via the standard cumulative-bracket method. */
export function computeAnnualTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0;
  const bracket = TAX_BRACKETS.find((b) => b.max === null || chargeableIncome <= b.max);
  const lowerBound = TAX_BRACKETS[TAX_BRACKETS.indexOf(bracket!) - 1]?.max ?? 0;
  const tax = bracket!.cumulativeBelow + (chargeableIncome - lowerBound) * bracket!.rate;
  return Math.max(0, tax);
}

export interface PcbResult {
  annualGross: number;
  epfReliefAnnual: number;
  chargeableIncome: number;
  annualTax: number;
  monthlyPcb: number;
  monthlyEpfContribution: number;
  nettMonthlyIncome: number;
}

/** Derives nett-of-tax monthly income from gross monthly salary — gross minus the employee's actual EPF contribution minus PCB. */
export function computeNettIncome(monthlyGross: number): PcbResult {
  const annualGross = monthlyGross * 12;
  const epfReliefAnnual = Math.min(annualGross * EPF_EMPLOYEE_RATE, EPF_RELIEF_CAP);
  const chargeableIncome = Math.max(0, annualGross - PERSONAL_RELIEF - epfReliefAnnual);
  const annualTax = computeAnnualTax(chargeableIncome);
  const monthlyPcb = annualTax / 12;
  const monthlyEpfContribution = monthlyGross * EPF_EMPLOYEE_RATE;
  const nettMonthlyIncome = monthlyGross - monthlyEpfContribution - monthlyPcb;

  return {
    annualGross: round2(annualGross),
    epfReliefAnnual: round2(epfReliefAnnual),
    chargeableIncome: round2(chargeableIncome),
    annualTax: round2(annualTax),
    monthlyPcb: round2(monthlyPcb),
    monthlyEpfContribution: round2(monthlyEpfContribution),
    nettMonthlyIncome: round2(nettMonthlyIncome),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
