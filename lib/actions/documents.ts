"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractDocumentData, buildStorageFileName, type DocumentExtraction } from "@/lib/mortgage/extraction";

export interface UploadDocumentState {
  error?: string;
  extraction?: DocumentExtraction;
}

/**
 * Uploads a client document against a checklist item, renames it to a
 * traceable convention, marks the item received, and — if AI extraction is
 * configured — asks Claude's vision API to read income figures off it. The
 * result is returned as a draft only; nothing here writes to income_entries.
 */
export async function uploadDocument(
  itemId: string,
  caseId: string,
  _prevState: UploadDocumentState,
  formData: FormData,
): Promise<UploadDocumentState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { error: "File is too large (max 15MB)." };
  }

  const supabase = await createClient();

  const { data: item } = await supabase.from("document_items").select("doc_name").eq("id", itemId).single();
  if (!item) {
    return { error: "Document checklist item not found." };
  }

  const { data: caseRow } = await supabase.from("cases").select("clients(full_name)").eq("id", caseId).single<{ clients: { full_name: string } }>();
  const clientName = caseRow?.clients?.full_name ?? "client";

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const storageFileName = buildStorageFileName(clientName, item.doc_name, file.name);
  const storagePath = `${caseId}/${storageFileName}`;

  const { error: uploadError } = await supabase.storage.from("client-documents").upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  await supabase
    .from("document_items")
    .update({
      status: "received",
      received_at: new Date().toISOString(),
      file_path: storagePath,
      file_name: storageFileName,
      ai_extraction_status: "pending",
    })
    .eq("id", itemId);

  let extraction: DocumentExtraction | null = null;
  try {
    extraction = await extractDocumentData(buffer, mimeType);
  } catch {
    extraction = null;
  }

  await supabase
    .from("document_items")
    .update({
      ai_extracted_data: extraction,
      ai_extraction_status: extraction ? "done" : "unavailable",
    })
    .eq("id", itemId);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");

  return extraction ? { extraction } : {};
}
