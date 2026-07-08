const LABELS: Record<string, string> = {
  dsr: "DSR (Debt Service Ratio)",
  sjkp_100pct_financing: "SJKP / 100% Financing (First Home)",
  ndi: "NDI (Net Disposable Income) Minimum",
  urban_listing: "Urban Area Listing",
  bonus: "Bonus Income Calculation",
  asb: "ASB Income Calculation",
  variable_income: "Variable Income (Commission/Allowance/OT)",
  rental_income: "Rental Income Calculation",
  sgd_income: "SGD Income Calculation",
  cbs_grade: "CBS Grade Requirement",
  self_employed_by_tax: "Self-Employed — by Income Tax",
  self_employed_by_bank_statement: "Self-Employed — by Bank Statement",
  tax_needed: "Tax Documents Needed",
  trade_reference: "Trade Reference",
  credit_bureau: "Credit Bureau Source",
  master_title_over_10_years: "Master Title >10 Years",
  ptptn: "PTPTN Handling",
  min_age: "Minimum Age",
  epf_problem: "EPF Problem Handling",
  legal_fees_and_valuation_fees: "Legal & Valuation Fees Financing",
  no_bank_statement: "No Bank Statement",
  clean_ccris: "Clean CCRIS Requirement",
  cc_max_usage: "Credit Card Max Usage",
  new_employment: "New Employment Handling",
  perkeso_income: "PERKESO Income Accepted",
  pencen_income: "Pension Income Accepted",
  dual_income: "Dual Income Accepted",
  part_time: "Part-Time Income Accepted",
  part_time_income_calculation: "Part-Time Income Calculation",
  legal_case: "Legal Case Handling",
  max_cashout_for_refinance: "Max Cash-Out for Refinance",
  refinance_co_tenure: "Refinance Cash-Out Tenure",
  housing_loan_tenure: "Housing Loan Tenure",
  using_perfios_system: "Uses Perfios System",
};

export default function GuidelineReference({ guideline }: { guideline: Record<string, string | null> | undefined }) {
  if (!guideline) {
    return <p className="text-sm text-neutral-500">No guideline reference data for this bank yet.</p>;
  }

  const entries = Object.entries(guideline).filter(([, value]) => value != null && value !== "");

  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">No guideline reference data for this bank yet.</p>;
  }

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border border-neutral-200 p-2.5">
          <dt className="text-xs font-semibold text-neutral-500 mb-1">{LABELS[key] ?? key}</dt>
          <dd className="text-xs text-neutral-800 whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
