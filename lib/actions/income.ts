"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";

export interface AddIncomeState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function addIncomeEntry(
  caseId: string,
  _prevState: AddIncomeState,
  formData: FormData,
): Promise<AddIncomeState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to add income entries." };
  }

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
  const { error } = await supabase.from("income_entries").insert({
    case_id: caseId,
    user_id: user.id,
    income_type: incomeType,
    gross_amount: grossAmount,
    frequency,
    supporting_doc: supportingDoc || null,
  });

  if (error) {
    return { error: `Could not save income entry: ${error.message}` };
  }

  revalidatePath(`/cases/${caseId}`);
  return {};
}

export async function deleteIncomeEntry(entryId: string, caseId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.from("income_entries").delete().eq("id", entryId);
  revalidatePath(`/cases/${caseId}`);
}
