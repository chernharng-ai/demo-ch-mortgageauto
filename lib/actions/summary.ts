"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { generateCaseSummary } from "@/lib/mortgage/assist";
import type { Bank, Case, Client, DocumentItem, IncomeCalculation, LoanEligibility } from "@/lib/mortgage/types";

export interface SummaryState {
  error?: string;
}

/**
 * Medium-risk assist (docs/AGENTIC_LAYER.md): drafts an eligibility narrative
 * from the case's existing calculation results. Templated text, not a call to
 * an external AI model — shown as a draft; the officer must accept it.
 */
export async function generateSummary(caseId: string, _prevState: SummaryState): Promise<SummaryState> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("cases")
    .select("*, clients(*)")
    .eq("id", caseId)
    .single<Case & { clients: Client }>();

  if (!caseRow) {
    return { error: "Case not found." };
  }

  const [{ data: documentItems }, { data: banks }, { data: incomeCalculations }, { data: loanEligibilities }] = await Promise.all([
    supabase.from("document_items").select("*").eq("case_id", caseId).returns<DocumentItem[]>(),
    supabase.from("banks").select("*").returns<Bank[]>(),
    supabase.from("income_calculations").select("*").eq("case_id", caseId).returns<IncomeCalculation[]>(),
    supabase.from("loan_eligibilities").select("*").eq("case_id", caseId).returns<LoanEligibility[]>(),
  ]);

  const docs = documentItems ?? [];
  const completeness = docs.length > 0 ? Math.round((docs.filter((d) => d.status === "received").length / docs.length) * 100) : 0;

  const results = (incomeCalculations ?? [])
    .map((calc) => {
      const eligibility = (loanEligibilities ?? []).find((e) => e.bank_id === calc.bank_id);
      const bank = (banks ?? []).find((b) => b.id === calc.bank_id);
      if (!eligibility || !bank) return null;
      return {
        bankName: bank.name,
        eligibleIncome: calc.eligible_income,
        maxLoanAmount: eligibility.max_loan_amount,
        dsrRatio: eligibility.dsr_ratio,
        eligibilityStatus: eligibility.eligibility_status,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const summary = generateCaseSummary({
    clientName: caseRow.clients.full_name,
    employmentType: caseRow.clients.employment_type,
    propertyValue: caseRow.property_value,
    docCompleteness: completeness,
    results,
  });

  await supabase.from("cases").update({ ai_summary: summary, ai_summary_status: "draft" }).eq("id", caseId);

  await supabase.from("audit_logs").insert({
    case_id: caseId,
    user_id: user?.id ?? null,
    action: "summary_generated",
    performed_by: user?.email ?? "Team Member",
    before_value: null,
    after_value: { summary },
  });

  revalidatePath(`/cases/${caseId}`);
  return {};
}

export async function setSummaryStatus(caseId: string, status: "accepted" | "dismissed") {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("cases").update({ ai_summary_status: status }).eq("id", caseId);

  await supabase.from("audit_logs").insert({
    case_id: caseId,
    user_id: user?.id ?? null,
    action: "summary_" + status,
    performed_by: user?.email ?? "Team Member",
    before_value: null,
    after_value: { status },
  });

  revalidatePath(`/cases/${caseId}`);
}
