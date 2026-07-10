"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import { extractDocumentData, classifyByFilename, buildStorageFileName, type DocumentExtraction } from "@/lib/mortgage/extraction";

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

    if (matchedDocName) {
      await supabase
        .from("document_items")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("case_id", caseId)
        .eq("doc_name", matchedDocName);
    }

    results.push({ caseDocumentId: caseDoc.id, originalFileName: file.name, matchedDocName, extraction });
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");

  return results;
}

/** Officer manually assigns a file the AI couldn't classify to a checklist item. */
export async function assignDocumentMatch(caseDocumentId: string, caseId: string, docName: string) {
  const supabase = await createClient();

  await supabase.from("case_documents").update({ matched_doc_name: docName }).eq("id", caseDocumentId);
  await supabase
    .from("document_items")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("case_id", caseId)
    .eq("doc_name", docName);

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
