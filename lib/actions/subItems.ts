"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocStatus } from "@/lib/mortgage/types";

/** Adds a sub-item under a checklist entry, e.g. "4" under "3 months payslip", or "Borang B/Be" under "Personal Income Tax". */
export async function addSubItem(caseId: string, docName: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("document_sub_items")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("doc_name", docName);

  await supabase.from("document_sub_items").insert({
    case_id: caseId,
    doc_name: docName,
    label: trimmed,
    sort_order: count ?? 0,
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function setSubItemStatus(subItemId: string, caseId: string, status: DocStatus) {
  const supabase = await createClient();
  await supabase.from("document_sub_items").update({ status }).eq("id", subItemId);
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteSubItem(subItemId: string, caseId: string) {
  const supabase = await createClient();
  await supabase.from("document_sub_items").delete().eq("id", subItemId);
  revalidatePath(`/cases/${caseId}`);
}
