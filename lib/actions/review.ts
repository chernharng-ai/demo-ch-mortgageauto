"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReviewClientType } from "@/lib/mortgage/types";

export interface UpdateReviewState {
  error?: string;
}

function strOrNull(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

function intOrNull(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function updateCaseReview(caseId: string, _prevState: UpdateReviewState, formData: FormData): Promise<UpdateReviewState> {
  const supabase = await createClient();

  const clientType = String(formData.get("review_client_type") ?? "business_owner") as ReviewClientType;

  const { error } = await supabase
    .from("cases")
    .update({
      review_client_type: clientType,
      review_doc_link: strOrNull(formData, "review_doc_link"),
      review_age: intOrNull(formData, "review_age"),
      review_residential_address: strOrNull(formData, "review_residential_address"),
      review_working_address: strOrNull(formData, "review_working_address"),
      review_attention: strOrNull(formData, "review_attention"),
      review_gross_income: strOrNull(formData, "review_gross_income"),
      review_nett_income: strOrNull(formData, "review_nett_income"),
      review_max_allowed_commitment: intOrNull(formData, "review_max_allowed_commitment"),
      review_commitment_breakdown: strOrNull(formData, "review_commitment_breakdown"),
      review_project: strOrNull(formData, "review_project"),
      review_bank_eligible_notes: strOrNull(formData, "review_bank_eligible_notes"),
      review_risk_level: strOrNull(formData, "review_risk_level"),
      review_approval_chance: intOrNull(formData, "review_approval_chance"),
      review_agent_notes: strOrNull(formData, "review_agent_notes"),
    })
    .eq("id", caseId);

  if (error) {
    return { error: `Could not save review note: ${error.message}` };
  }

  revalidatePath(`/cases/${caseId}`);
  return {};
}
