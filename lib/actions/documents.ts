"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { extractDocumentData, classifyByFilename, buildStorageFileName, type DocumentExtraction } from "@/lib/mortgage/extraction";
import { buildChecklistTemplate, expectedPeriodLabels } from "@/lib/mortgage/checklistTemplate";
import { epfStatementHasSplit } from "@/lib/mortgage/tally";
import { rederiveAndCalculate } from "./income";

/**
 * The autopilot step, per the officer: uploading documents should review
 * everything by itself — derive the case income from the payslips read so
 * far, then run the full DSR+NDI bank comparison, no manual clicks. A
 * failure here never breaks the upload itself.
 */
async function autoDeriveAndCalculate(caseId: string) {
  try {
    await rederiveAndCalculate(caseId);
  } catch (err) {
    console.error(`Auto income/calculation failed for case ${caseId}:`, err);
  }
}
import type { Case, Client } from "@/lib/mortgage/types";

export interface BulkUploadResult {
  caseDocumentId: string;
  originalFileName: string;
  matchedDocName: string | null;
  extraction: DocumentExtraction | null;
  error?: string;
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function guessMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_MIME_TYPES[ext]) || "application/octet-stream";
}

/**
 * A totals-only EPF statement is the WRONG document — banks require the
 * details statement with the employee/employer breakdown. Such an upload
 * must not tick the checklist item or its year chip; the item stays ⚠️ so
 * the officer knows to re-request the correct statement from the client.
 */
function isWrongEpfStatement(extraction: DocumentExtraction | null): boolean {
  return extraction?.document_type === "epf_statement" && !epfStatementHasSplit(extraction);
}

/**
 * Ticks the period chip (2✅ 3✅ …) for a multi-month/multi-year checklist
 * item when the AI reads which month/year an uploaded document covers —
 * creates the sub-item if it doesn't exist, marks it received if it does.
 */
async function tickPeriodSubItem(supabase: Awaited<ReturnType<typeof createClient>>, caseId: string, docName: string, periodLabel: string) {
  const label = periodLabel.trim();
  if (!label) return;

  const { data: existing } = await supabase
    .from("document_sub_items")
    .select("id")
    .eq("case_id", caseId)
    .eq("doc_name", docName)
    .eq("label", label)
    .maybeSingle();

  if (existing) {
    await supabase.from("document_sub_items").update({ status: "received" }).eq("id", existing.id);
  } else {
    // Numeric labels (months/years) sort naturally in the chip row.
    const numeric = Number(label);
    await supabase.from("document_sub_items").insert({
      case_id: caseId,
      doc_name: docName,
      label,
      status: "received",
      sort_order: Number.isFinite(numeric) ? numeric : 0,
    });
  }
}

/**
 * Drop-zone entry point: takes every file dropped on a case at once, and for
 * each one — uploads it to storage, renames it, asks Claude to classify +
 * extract income (falling back to filename keyword matching for file types
 * vision can't read), records it in case_documents, and — if it matched a
 * checklist item — marks every bank's row for that doc_name as received.
 * Extraction is always a draft; nothing here writes to income_entries.
 */
export async function bulkUploadDocuments(caseId: string, formData: FormData): Promise<BulkUploadResult[]> {
  const user = await getCurrentUser();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return [];

  const supabase = await createClient();

  const [{ data: caseRow }, { data: items }] = await Promise.all([
    supabase.from("cases").select("clients(full_name)").eq("id", caseId).single<{ clients: { full_name: string } }>(),
    supabase.from("document_items").select("doc_name").eq("case_id", caseId),
  ]);

  const clientName = caseRow?.clients?.full_name ?? "client";
  const candidateDocNames = [...new Set((items ?? []).map((i) => i.doc_name))];

  const results: BulkUploadResult[] = [];

  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) {
      results.push({ caseDocumentId: "", originalFileName: file.name, matchedDocName: null, extraction: null, error: "File is too large (max 15MB)." });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Drag-and-drop doesn't always populate File.type reliably — fall back to
    // the extension so a PDF/image dropped without a browser-detected MIME
    // type still reaches the vision API instead of silently skipping it.
    const mimeType = file.type || guessMimeTypeFromFileName(file.name);

    let extraction: DocumentExtraction | null = null;
    try {
      extraction = await extractDocumentData(buffer, mimeType, candidateDocNames);
    } catch (err) {
      console.error(`Document extraction failed for "${file.name}" (${mimeType}):`, err);
      extraction = null;
    }

    const matchedDocName = extraction?.matched_doc_name ?? classifyByFilename(file.name, candidateDocNames);
    const storageFileName = buildStorageFileName(clientName, matchedDocName ?? "unclassified", file.name);
    const storagePath = `${caseId}/${storageFileName}`;

    const { error: uploadError } = await supabase.storage.from("client-documents").upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      results.push({ caseDocumentId: "", originalFileName: file.name, matchedDocName: null, extraction: null, error: `Upload failed: ${uploadError.message}` });
      continue;
    }

    const { data: caseDoc, error: insertError } = await supabase
      .from("case_documents")
      .insert({
        case_id: caseId,
        user_id: user?.id ?? null,
        file_path: storagePath,
        file_name: storageFileName,
        original_file_name: file.name,
        mime_type: mimeType,
        matched_doc_name: matchedDocName,
        ai_extracted_data: extraction,
        ai_extraction_status: extraction ? "done" : "unavailable",
      })
      .select("id")
      .single();

    if (insertError || !caseDoc) {
      results.push({ caseDocumentId: "", originalFileName: file.name, matchedDocName, extraction, error: "Saved the file but couldn't record it." });
      continue;
    }

    if (matchedDocName && !isWrongEpfStatement(extraction)) {
      await supabase
        .from("document_items")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("case_id", caseId)
        .eq("doc_name", matchedDocName);

      if (extraction?.period_label) {
        await tickPeriodSubItem(supabase, caseId, matchedDocName, extraction.period_label);
      }
    }

    results.push({ caseDocumentId: caseDoc.id, originalFileName: file.name, matchedDocName, extraction });
  }

  await autoDeriveAndCalculate(caseId);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");

  return results;
}

/** Re-runs AI classification + extraction on a file already in storage — no re-upload needed, e.g. after a fix to the extraction pipeline. */
export async function retryExtraction(caseDocumentId: string, caseId: string) {
  const supabase = await createClient();

  const [{ data: caseDoc }, { data: items }] = await Promise.all([
    supabase.from("case_documents").select("file_path, mime_type, original_file_name").eq("id", caseDocumentId).single(),
    supabase.from("document_items").select("doc_name").eq("case_id", caseId),
  ]);

  if (!caseDoc) return;

  const candidateDocNames = [...new Set((items ?? []).map((i) => i.doc_name))];

  const { data: blob, error: downloadError } = await supabase.storage.from("client-documents").download(caseDoc.file_path);
  if (downloadError || !blob) return;

  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = caseDoc.mime_type || guessMimeTypeFromFileName(caseDoc.original_file_name);

  let extraction: DocumentExtraction | null = null;
  try {
    extraction = await extractDocumentData(buffer, mimeType, candidateDocNames);
  } catch (err) {
    console.error(`Retry extraction failed for "${caseDoc.original_file_name}" (${mimeType}):`, err);
    extraction = null;
  }

  const matchedDocName = extraction?.matched_doc_name ?? classifyByFilename(caseDoc.original_file_name, candidateDocNames);

  await supabase
    .from("case_documents")
    .update({
      matched_doc_name: matchedDocName,
      ai_extracted_data: extraction,
      ai_extraction_status: extraction ? "done" : "unavailable",
    })
    .eq("id", caseDocumentId);

  if (matchedDocName && !isWrongEpfStatement(extraction)) {
    await supabase
      .from("document_items")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("case_id", caseId)
      .eq("doc_name", matchedDocName);

    if (extraction?.period_label) {
      await tickPeriodSubItem(supabase, caseId, matchedDocName, extraction.period_label);
    }
  }

  await autoDeriveAndCalculate(caseId);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

/** Officer manually assigns a file the AI couldn't classify to a checklist item. */
export async function assignDocumentMatch(caseDocumentId: string, caseId: string, docName: string) {
  const supabase = await createClient();

  const { data: caseDoc } = await supabase.from("case_documents").select("ai_extracted_data").eq("id", caseDocumentId).single();
  const extraction = (caseDoc?.ai_extracted_data as DocumentExtraction | null) ?? null;

  await supabase.from("case_documents").update({ matched_doc_name: docName }).eq("id", caseDocumentId);

  if (!isWrongEpfStatement(extraction)) {
    await supabase
      .from("document_items")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("case_id", caseId)
      .eq("doc_name", docName);

    if (extraction?.period_label) {
      await tickPeriodSubItem(supabase, caseId, docName, extraction.period_label);
    }
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

/** Manual override — resets every bank's row for a checklist item back to pending, e.g. after a misclassification. */
export async function resetDocumentGroupStatus(caseId: string, docName: string, status: "pending" | "received" | "missing") {
  const supabase = await createClient();
  await supabase
    .from("document_items")
    .update({ status, received_at: status === "received" ? new Date().toISOString() : null })
    .eq("case_id", caseId)
    .eq("doc_name", docName);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

/** Adds a case-specific checklist item not tied to any bank's requirements, e.g. "Client Info" or "Prop Doc". */
export async function addChecklistItem(caseId: string, docName: string) {
  const trimmed = docName.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  await supabase.from("document_items").insert({
    case_id: caseId,
    bank_id: null,
    doc_name: trimmed,
    status: "pending",
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

/** Removes every row for a case-specific checklist item (bank_id is null — bank-required items can't be removed this way). */
export async function deleteChecklistItem(caseId: string, docName: string) {
  const supabase = await createClient();
  await supabase.from("document_items").delete().eq("case_id", caseId).eq("doc_name", docName).is("bank_id", null);
  await supabase.from("document_sub_items").delete().eq("case_id", caseId).eq("doc_name", docName);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

/** Updates the case-type flags that drive the checklist template and (for property type) the DSR tier lookup. */
export async function updateCaseChecklistProfile(
  caseId: string,
  financingScheme: "bank_loan" | "lppsa",
  applicationDate: string,
  isOverseas: boolean,
  hasRentalIncome: boolean,
  needsSiteVisit: boolean,
  hasVariableIncome: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("cases")
    .update({
      financing_scheme: financingScheme,
      application_date: applicationDate,
      is_overseas: isOverseas,
      has_rental_income: hasRentalIncome,
      needs_site_visit: needsSiteVisit,
      has_variable_income: hasVariableIncome,
    })
    .eq("id", caseId);

  revalidatePath(`/cases/${caseId}`);
}

/**
 * Inserts the officer's real document-collection checklist for this case
 * (salary-earner/self-employed base list + overseas/subsales/site-visit/
 * rental extras, or the LPPSA list) as case-specific items — additive to
 * the bank-driven checklist, skipping any doc_name already present so
 * re-running after changing a flag doesn't duplicate existing rows.
 */
export async function generateChecklistFromTemplate(caseId: string) {
  const supabase = await createClient();

  const { data: caseRow } = await supabase.from("cases").select("*, clients(*)").eq("id", caseId).single<Case & { clients: Client }>();
  if (!caseRow) return;

  const { data: existing } = await supabase.from("document_items").select("doc_name").eq("case_id", caseId);
  const existingNames = new Set((existing ?? []).map((i) => i.doc_name));

  const template = buildChecklistTemplate({
    employmentType: caseRow.clients.employment_type,
    financingScheme: caseRow.financing_scheme,
    propertyType: caseRow.property_type,
    isOverseas: caseRow.is_overseas,
    hasRentalIncome: caseRow.has_rental_income,
    needsSiteVisit: caseRow.needs_site_visit,
  });

  const toInsert = template
    .filter((docName) => !existingNames.has(docName))
    .map((docName) => ({ case_id: caseId, bank_id: null, doc_name: docName, status: "pending" as const }));

  if (toInsert.length > 0) {
    await supabase.from("document_items").insert(toInsert);
  }

  // Pre-seed the expected month chips (1⚠️ 2⚠️ …) on every monthly income
  // item — bank-driven and template alike — so missing months are visible at
  // a glance. Months already ticked (or manually added) are left untouched.
  const allDocNames = [...new Set([...existingNames, ...template])];
  const { data: existingSubs } = await supabase.from("document_sub_items").select("doc_name, label").eq("case_id", caseId);
  const existingChips = new Set((existingSubs ?? []).map((s) => `${s.doc_name}|${s.label}`));

  const chipsToInsert = allDocNames.flatMap((docName) =>
    expectedPeriodLabels(docName, caseRow.application_date, caseRow.has_variable_income)
      .filter((label) => !existingChips.has(`${docName}|${label}`))
      .map((label) => ({
        case_id: caseId,
        doc_name: docName,
        label,
        status: "pending" as const,
        sort_order: Number(label),
      })),
  );

  if (chipsToInsert.length > 0) {
    await supabase.from("document_sub_items").insert(chipsToInsert);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}
