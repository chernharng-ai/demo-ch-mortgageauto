"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import type { Bank } from "@/lib/mortgage/types";

export interface CreateCaseState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

// NOTE: auth is temporarily not required (RLS reopened via
// supabase/migrations/0005_temporary_reopen.sql) — user is still looked up
// so actions stay attributed to whoever's signed in, but nothing blocks on it.

export async function createCase(
  _prevState: CreateCaseState,
  formData: FormData,
): Promise<CreateCaseState> {
  const user = await getCurrentUser();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const icNumber = String(formData.get("ic_number") ?? "").trim();
  const employmentType = String(formData.get("employment_type") ?? "employed");
  const employerName = String(formData.get("employer_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Client name is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user?.id ?? null,
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
      user_id: user?.id ?? null,
      client_id: client.id,
      status: "draft",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (caseError || !caseRow) {
    return { error: `Could not create case: ${caseError?.message ?? "unknown error"}` };
  }

  await generateDocumentChecklist(caseRow.id, user?.id ?? null);

  revalidatePath("/");
  redirect(`/cases/${caseRow.id}`);
}

/** Low-risk auto-execute tool (docs/AGENTIC_LAYER.md): builds the per-bank
 * document checklist from each bank's doc_requirements the moment a case is created. */
export async function generateDocumentChecklist(caseId: string, userId: string | null) {
  const supabase = await createClient();

  const { data: banks } = await supabase
    .from("banks")
    .select("id, doc_requirements")
    .returns<Pick<Bank, "id" | "doc_requirements">[]>();

  if (!banks || banks.length === 0) return;

  const rows = banks.flatMap((bank) =>
    (bank.doc_requirements ?? []).map((docName) => ({
      case_id: caseId,
      user_id: userId,
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
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("cases")
    .select("status")
    .eq("id", caseId)
    .single();

  await supabase.from("cases").update({ status }).eq("id", caseId);

  await supabase.from("audit_logs").insert({
    case_id: caseId,
    user_id: user?.id ?? null,
    action: "status_change",
    performed_by: user?.email ?? "Team Member",
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
  // audit_logs is append-only by design (no delete policy) and intentionally kept.
  await Promise.all([
    supabase.from("income_calculations").delete().eq("case_id", caseId),
    supabase.from("loan_eligibilities").delete().eq("case_id", caseId),
    supabase.from("document_items").delete().eq("case_id", caseId),
    supabase.from("income_entries").delete().eq("case_id", caseId),
  ]);
  await supabase.from("cases").delete().eq("id", caseId);
  revalidatePath("/");
  redirect("/");
}
