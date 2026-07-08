"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Bank } from "@/lib/mortgage/types";

export interface CreateCaseState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createCase(
  _prevState: CreateCaseState,
  formData: FormData,
): Promise<CreateCaseState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const icNumber = String(formData.get("ic_number") ?? "").trim();
  const employmentType = String(formData.get("employment_type") ?? "employed");
  const employerName = String(formData.get("employer_name") ?? "").trim();
  const propertyValueRaw = String(formData.get("property_value") ?? "").trim();
  const loanTenureRaw = String(formData.get("loan_tenure_years") ?? "30").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Client name is required.";

  const propertyValue = propertyValueRaw ? Number(propertyValueRaw) : null;
  if (propertyValueRaw && (Number.isNaN(propertyValue) || (propertyValue ?? 0) < 0)) {
    fieldErrors.property_value = "Enter a valid property value.";
  }

  const loanTenureYears = Number(loanTenureRaw) || 30;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      full_name: fullName,
      ic_number: icNumber || null,
      employment_type: employmentType,
      employer_name: employerName || null,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    return { error: `Could not create client: ${clientError?.message ?? "unknown error"}` };
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .insert({
      client_id: client.id,
      status: "draft",
      property_value: propertyValue,
      loan_tenure_years: loanTenureYears,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (caseError || !caseRow) {
    return { error: `Could not create case: ${caseError?.message ?? "unknown error"}` };
  }

  await generateDocumentChecklist(caseRow.id);

  revalidatePath("/");
  redirect(`/cases/${caseRow.id}`);
}

/** Low-risk auto-execute tool (docs/AGENTIC_LAYER.md): builds the per-bank
 * document checklist from each bank's doc_requirements the moment a case is created. */
export async function generateDocumentChecklist(caseId: string) {
  const supabase = await createClient();

  const { data: banks } = await supabase
    .from("banks")
    .select("id, doc_requirements")
    .returns<Pick<Bank, "id" | "doc_requirements">[]>();

  if (!banks || banks.length === 0) return;

  const rows = banks.flatMap((bank) =>
    (bank.doc_requirements ?? []).map((docName) => ({
      case_id: caseId,
      bank_id: bank.id,
      doc_name: docName,
      status: "pending" as const,
    })),
  );

  if (rows.length > 0) {
    await supabase.from("document_items").insert(rows);
  }
}

export async function updateDocumentStatus(
  itemId: string,
  caseId: string,
  status: "pending" | "received" | "missing",
) {
  const supabase = await createClient();
  await supabase
    .from("document_items")
    .update({
      status,
      received_at: status === "received" ? new Date().toISOString() : null,
    })
    .eq("id", itemId);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function updateCaseStatus(
  caseId: string,
  status: "draft" | "in-review" | "approved" | "rejected",
) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("cases")
    .select("status")
    .eq("id", caseId)
    .single();

  await supabase.from("cases").update({ status }).eq("id", caseId);

  await supabase.from("audit_logs").insert({
    case_id: caseId,
    action: "status_change",
    performed_by: "Team Member",
    before_value: before ?? null,
    after_value: { status },
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function updateCaseNotes(caseId: string, notes: string) {
  const supabase = await createClient();
  await supabase.from("cases").update({ notes }).eq("id", caseId);
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteCase(caseId: string) {
  const supabase = await createClient();
  // FKs are NOT ON DELETE CASCADE — clear dependents before the case row itself.
  await Promise.all([
    supabase.from("income_calculations").delete().eq("case_id", caseId),
    supabase.from("loan_eligibilities").delete().eq("case_id", caseId),
    supabase.from("document_items").delete().eq("case_id", caseId),
    supabase.from("income_entries").delete().eq("case_id", caseId),
    supabase.from("audit_logs").delete().eq("case_id", caseId),
  ]);
  await supabase.from("cases").delete().eq("id", caseId);
  revalidatePath("/");
  redirect("/");
}
