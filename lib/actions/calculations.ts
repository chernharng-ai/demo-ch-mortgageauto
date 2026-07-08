"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { computeEligibleIncome, computeLoanEligibility, type BankCalcParams } from "@/lib/mortgage/calc";
import type { Bank, Case, Client, IncomeCalculation, IncomeEntry, LoanEligibility } from "@/lib/mortgage/types";

export interface RunCalculationState {
  error?: string;
  success?: boolean;
}

/**
 * Named tools from docs/AGENTIC_LAYER.md, run together on "Run Calculation":
 * run_income_calculation(case_id, bank_id) then run_loan_eligibility(case_id, bank_id)
 * for every configured bank. Low-risk auto-execute — coded rules, no AI.
 */
export async function runCalculations(
  caseId: string,
  _prevState: RunCalculationState,
): Promise<RunCalculationState> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("*, clients(*)")
    .eq("id", caseId)
    .single<Case & { clients: Client }>();

  if (caseError || !caseRow) {
    return { error: "Case not found." };
  }

  const { data: incomeEntries } = await supabase
    .from("income_entries")
    .select("*")
    .eq("case_id", caseId)
    .returns<IncomeEntry[]>();

  if (!incomeEntries || incomeEntries.length === 0) {
    return { error: "Add income entries first." };
  }

  const { data: banks } = await supabase.from("banks").select("*").returns<Bank[]>();

  if (!banks || banks.length === 0) {
    return { error: "Bank configuration incomplete — contact admin." };
  }

  const client = caseRow.clients;
  const calculatedBy = user?.email ?? "Team Member";

  for (const bank of banks) {
    const calcParams = bank.calc_params as BankCalcParams;
    const hasDsr = calcParams?.dsr_limit || (calcParams?.dsr_tiers && calcParams.dsr_tiers.length > 0);
    if (!hasDsr || !calcParams?.stress_rate || !calcParams?.income_rules) {
      continue; // skip mis-configured bank (e.g. OCBC has no guideline data yet) rather than failing the whole run
    }

    // Preserve the prior result in the audit trail before it's replaced.
    const { data: priorCalc } = await supabase
      .from("income_calculations")
      .select("*")
      .eq("case_id", caseId)
      .eq("bank_id", bank.id)
      .maybeSingle<IncomeCalculation>();
    const { data: priorEligibility } = await supabase
      .from("loan_eligibilities")
      .select("*")
      .eq("case_id", caseId)
      .eq("bank_id", bank.id)
      .maybeSingle<LoanEligibility>();

    const eligibleIncome = computeEligibleIncome(incomeEntries, client.employment_type, calcParams.income_rules);
    const result = computeLoanEligibility(eligibleIncome, caseRow.property_value, caseRow.loan_tenure_years, calcParams);

    // run_income_calculation: replace prior result for this case+bank
    await supabase.from("income_calculations").delete().eq("case_id", caseId).eq("bank_id", bank.id);
    await supabase.from("income_calculations").insert({
      case_id: caseId,
      user_id: user?.id ?? null,
      bank_id: bank.id,
      eligible_income: eligibleIncome,
      method_snapshot: { bank: bank.name, ...calcParams },
      calculated_by: calculatedBy,
    });

    // run_loan_eligibility: replace prior result for this case+bank
    await supabase.from("loan_eligibilities").delete().eq("case_id", caseId).eq("bank_id", bank.id);
    await supabase.from("loan_eligibilities").insert({
      case_id: caseId,
      user_id: user?.id ?? null,
      bank_id: bank.id,
      max_loan_amount: result.max_loan_amount,
      monthly_instalment: result.monthly_instalment,
      dsr_ratio: result.dsr_ratio,
      eligibility_status: result.eligibility_status,
    });

    await supabase.from("audit_logs").insert({
      case_id: caseId,
      user_id: user?.id ?? null,
      action: "calculation_run",
      performed_by: calculatedBy,
      before_value: priorCalc || priorEligibility ? { income_calculation: priorCalc, loan_eligibility: priorEligibility } : null,
      after_value: {
        bank: bank.name,
        eligible_income: eligibleIncome,
        max_loan_amount: result.max_loan_amount,
        eligibility_status: result.eligibility_status,
      },
    });
  }

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}
