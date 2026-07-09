"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { computeEligibleIncome, computePackageEligibility, type BankCalcParams, type FinancingPackage } from "@/lib/mortgage/calc";
import type { Bank, Case, CaseCommitment, Client, IncomeEntry, LoanEligibility } from "@/lib/mortgage/types";

export interface RunCalculationState {
  error?: string;
  success?: boolean;
}

const PACKAGES: FinancingPackage[] = ["standard_90", "sjkp_100"];

/**
 * Named tools from docs/AGENTIC_LAYER.md, run together on "Run Calculation":
 * run_income_calculation(case_id, bank_id) then run_loan_eligibility(case_id, bank_id, package)
 * for every configured bank and both financing packages. Low-risk auto-execute — coded rules, no AI.
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

  const [{ data: incomeEntries }, { data: commitments }, { data: banks }] = await Promise.all([
    supabase.from("income_entries").select("*").eq("case_id", caseId).returns<IncomeEntry[]>(),
    supabase.from("case_commitments").select("*").eq("case_id", caseId).returns<CaseCommitment[]>(),
    supabase.from("banks").select("*").returns<Bank[]>(),
  ]);

  if (!incomeEntries || incomeEntries.length === 0) {
    return { error: "Add income entries first." };
  }

  if (!banks || banks.length === 0) {
    return { error: "Bank configuration incomplete — contact admin." };
  }

  const client = caseRow.clients;
  const calculatedBy = user?.email ?? "Team Member";
  const existingCommitments = (commitments ?? []).reduce((sum, c) => sum + c.monthly_amount, 0);

  for (const bank of banks) {
    const calcParams = bank.calc_params as BankCalcParams;
    const hasDsr = calcParams?.dsr_limit || (calcParams?.dsr_tiers && calcParams.dsr_tiers.length > 0);
    if (!hasDsr || !calcParams?.stress_rate || !calcParams?.income_rules) {
      continue; // skip mis-configured bank (e.g. OCBC has no guideline data yet) rather than failing the whole run
    }

    const eligibleIncome = computeEligibleIncome(incomeEntries, client.employment_type, calcParams.income_rules);

    await supabase.from("income_calculations").delete().eq("case_id", caseId).eq("bank_id", bank.id);
    await supabase.from("income_calculations").insert({
      case_id: caseId,
      user_id: user?.id ?? null,
      bank_id: bank.id,
      eligible_income: eligibleIncome,
      method_snapshot: { bank: bank.name, ...calcParams },
      calculated_by: calculatedBy,
    });

    for (const pkg of PACKAGES) {
      const { data: prior } = await supabase
        .from("loan_eligibilities")
        .select("*")
        .eq("case_id", caseId)
        .eq("bank_id", bank.id)
        .eq("package", pkg)
        .maybeSingle<LoanEligibility>();

      const result = computePackageEligibility(
        eligibleIncome,
        existingCommitments,
        caseRow.applicant_type,
        caseRow.property_location,
        caseRow.property_type,
        calcParams,
        pkg,
      );

      await supabase.from("loan_eligibilities").delete().eq("case_id", caseId).eq("bank_id", bank.id).eq("package", pkg);

      if (!result.available) continue;

      await supabase.from("loan_eligibilities").insert({
        case_id: caseId,
        user_id: user?.id ?? null,
        bank_id: bank.id,
        package: pkg,
        max_loan_amount: result.max_loan_amount,
        monthly_instalment: result.monthly_instalment,
        dsr_ratio: result.dsr_ratio,
        ndi_after: result.ndi_after,
        capped_by: result.capped_by,
      });

      await supabase.from("audit_logs").insert({
        case_id: caseId,
        user_id: user?.id ?? null,
        action: "calculation_run",
        performed_by: calculatedBy,
        before_value: prior ?? null,
        after_value: {
          bank: bank.name,
          package: pkg,
          eligible_income: eligibleIncome,
          existing_commitments: existingCommitments,
          max_loan_amount: result.max_loan_amount,
          capped_by: result.capped_by,
        },
      });
    }
  }

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function addCommitment(caseId: string, description: string, monthlyAmount: number) {
  const supabase = await createClient();
  await supabase.from("case_commitments").insert({ case_id: caseId, description, monthly_amount: monthlyAmount });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteCommitment(commitmentId: string, caseId: string) {
  const supabase = await createClient();
  await supabase.from("case_commitments").delete().eq("id", commitmentId);
  revalidatePath(`/cases/${caseId}`);
}

export async function updateCaseProfile(
  caseId: string,
  applicantType: "single" | "joint",
  propertyLocation: "urban" | "non_urban",
  propertyType: "completed" | "under_construction",
) {
  const supabase = await createClient();
  await supabase
    .from("cases")
    .update({ applicant_type: applicantType, property_location: propertyLocation, property_type: propertyType })
    .eq("id", caseId);
  revalidatePath(`/cases/${caseId}`);
}
