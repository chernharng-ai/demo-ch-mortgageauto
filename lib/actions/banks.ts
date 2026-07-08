"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface UpdateBankState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

export async function updateBank(
  bankId: string,
  _prevState: UpdateBankState,
  formData: FormData,
): Promise<UpdateBankState> {
  const calcParamsRaw = String(formData.get("calc_params") ?? "");
  const docRequirementsRaw = String(formData.get("doc_requirements") ?? "");

  const fieldErrors: Record<string, string> = {};

  let calcParams: unknown;
  try {
    calcParams = JSON.parse(calcParamsRaw);
  } catch {
    fieldErrors.calc_params = "Not valid JSON.";
  }

  const docRequirements = docRequirementsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (docRequirements.length === 0) {
    fieldErrors.doc_requirements = "Add at least one required document.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("banks")
    .update({ calc_params: calcParams, doc_requirements: docRequirements })
    .eq("id", bankId);

  if (error) {
    return { error: `Could not save bank: ${error.message}` };
  }

  revalidatePath("/banks");
  revalidatePath("/");
  return { success: true };
}
