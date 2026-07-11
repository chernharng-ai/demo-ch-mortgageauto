"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { suggestIncomeType, isAnomalousAmount } from "@/lib/mortgage/assist";
import { consolidatePayslipIncome } from "@/lib/mortgage/consolidate";
import { runCalculations } from "./calculations";
import type { DocumentExtraction } from "@/lib/mortgage/extraction";
import type { IncomeType } from "@/lib/mortgage/types";

export interface AddIncomeState {
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
}

export async function addIncomeEntry(
  caseId: string,
  _prevState: AddIncomeState,
  formData: FormData,
): Promise<AddIncomeState> {
  const user = await getCurrentUser();

  const incomeType = String(formData.get("income_type") ?? "").trim();
  const grossAmountRaw = String(formData.get("gross_amount") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "monthly");
  const supportingDoc = String(formData.get("supporting_doc") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!incomeType) fieldErrors.income_type = "Income type is required.";

  const grossAmount = Number(grossAmountRaw);
  if (!grossAmountRaw || Number.isNaN(grossAmount) || grossAmount <= 0) {
    fieldErrors.gross_amount = "Enter a valid amount greater than 0.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();

  // Rule-based suggestion from the free-text description (see lib/mortgage/assist.ts).
  // review_status records whether the officer's chosen type matched, or overrode, it.
  const suggestion = suggestIncomeType(supportingDoc);
  const reviewStatus = !suggestion ? "unreviewed" : suggestion.type === incomeType ? "accepted" : "overridden";

  const { error } = await supabase.from("income_entries").insert({
    case_id: caseId,
    user_id: user?.id ?? null,
    income_type: incomeType,
    gross_amount: grossAmount,
    frequency,
    supporting_doc: supportingDoc || null,
    ai_suggested_type: suggestion?.type ?? null,
    ai_suggested_type_source: suggestion?.source ?? null,
    ai_suggested_type_confidence: suggestion?.confidence ?? null,
    ai_suggested_type_review_status: reviewStatus,
  });

  if (error) {
    return { error: `Could not save income entry: ${error.message}` };
  }

  revalidatePath(`/cases/${caseId}`);

  const warning = await checkAnomaly(supabase, caseId, incomeType as IncomeType, grossAmount, frequency);
  return warning ? { warning } : {};
}

/** Flags if this amount is >2x the client's prior-case average for the same income type (docs/INTELLIGENCE_LAYER.md). */
async function checkAnomaly(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  incomeType: IncomeType,
  grossAmount: number,
  frequency: string,
): Promise<string | null> {
  const { data: caseRow } = await supabase.from("cases").select("client_id").eq("id", caseId).single();
  if (!caseRow) return null;

  const { data: otherCases } = await supabase.from("cases").select("id").eq("client_id", caseRow.client_id).neq("id", caseId);
  const otherCaseIds = (otherCases ?? []).map((c) => c.id);
  if (otherCaseIds.length === 0) return null;

  const { data: priorEntries } = await supabase
    .from("income_entries")
    .select("gross_amount, frequency")
    .in("case_id", otherCaseIds)
    .eq("income_type", incomeType);

  const priorMonthly = (priorEntries ?? []).map((e) => (e.frequency === "annual" ? e.gross_amount / 12 : e.gross_amount));
  const thisMonthly = frequency === "annual" ? grossAmount / 12 : grossAmount;

  if (isAnomalousAmount(thisMonthly, priorMonthly)) {
    return `This ${incomeType} amount is more than 2x this client's average from prior cases — double-check before running the calculation.`;
  }
  return null;
}

export async function deleteIncomeEntry(entryId: string, caseId: string) {
  const supabase = await createClient();
  await supabase.from("income_entries").delete().eq("id", entryId);
  revalidatePath(`/cases/${caseId}`);
}

/**
 * Auto-derives this case's income from the stored payslip extractions
 * (lib/mortgage/consolidate.ts) — runs automatically after uploads so the
 * whole review is hands-off, and can be re-triggered from the UI. Always
 * recomputes server-side, and REPLACES previous document-derived entries so
 * re-running can't double-count; manually typed entries are left untouched.
 * Returns the number of income lines derived.
 */
export async function applyConsolidatedIncome(caseId: string): Promise<number> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: caseRow }, { data: docs }] = await Promise.all([
    supabase.from("cases").select("application_date, has_variable_income").eq("id", caseId).single(),
    supabase.from("case_documents").select("ai_extracted_data").eq("case_id", caseId),
  ]);
  if (!caseRow) return 0;

  const extractions = (docs ?? []).map((d) => d.ai_extracted_data as DocumentExtraction | null).filter((x): x is DocumentExtraction => x !== null);
  const proposal = consolidatePayslipIncome(extractions, caseRow.application_date, caseRow.has_variable_income);
  if (proposal.lines.length === 0) return 0;

  await supabase
    .from("income_entries")
    .delete()
    .eq("case_id", caseId)
    .in("ai_suggested_type_source", ["claude_vision_extraction", "payslip_consolidation"]);

  await supabase.from("income_entries").insert(
    proposal.lines.map((line) => ({
      case_id: caseId,
      user_id: user?.id ?? null,
      income_type: line.income_type,
      gross_amount: line.gross_amount,
      nett_amount: line.nett_amount,
      frequency: line.frequency,
      supporting_doc: line.label,
      ai_suggested_type: line.income_type,
      ai_suggested_type_source: "payslip_consolidation",
      ai_suggested_type_confidence: null,
      ai_suggested_type_review_status: "accepted",
    })),
  );

  revalidatePath(`/cases/${caseId}`);
  return proposal.lines.length;
}

/** Full autopilot step: derive income from documents, then run the DSR+NDI bank comparison — used after every upload and from the UI's re-run button. */
export async function rederiveAndCalculate(caseId: string) {
  const derived = await applyConsolidatedIncome(caseId);
  if (derived > 0) {
    await runCalculations(caseId, {});
  }
}

/** Confirms one AI-extracted income line (see lib/mortgage/extraction.ts) as a real income entry — officer-initiated, never automatic. */
export async function addIncomeEntryFromExtraction(
  caseId: string,
  incomeType: IncomeType,
  grossAmount: number,
  frequency: "monthly" | "annual",
  sourceLabel: string,
) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  await supabase.from("income_entries").insert({
    case_id: caseId,
    user_id: user?.id ?? null,
    income_type: incomeType,
    gross_amount: grossAmount,
    frequency,
    supporting_doc: sourceLabel,
    ai_suggested_type: incomeType,
    ai_suggested_type_source: "claude_vision_extraction",
    ai_suggested_type_confidence: null,
    ai_suggested_type_review_status: "accepted",
  });

  revalidatePath(`/cases/${caseId}`);
}
