import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submissionFileNames } from "@/lib/mortgage/submissionNaming";
import type { CaseDocument, Client } from "@/lib/mortgage/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const supabase = await createClient();

  const [{ data: caseRow }, { data: caseDocuments }] = await Promise.all([
    supabase.from("cases").select("clients(full_name)").eq("id", caseId).single<{ clients: Client }>(),
    supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at").returns<CaseDocument[]>(),
  ]);

  if (!caseDocuments || caseDocuments.length === 0) {
    return NextResponse.json({ error: "No documents uploaded for this case yet." }, { status: 404 });
  }

  const clientName = caseRow?.clients?.full_name ?? "client";
  // One folder inside the zip, named after the client, with every file
  // renamed to the officer's bank-submission convention (P2, B3, EPF 26,
  // 1.CTOS (MM-DD-YYYY), …) — ready to forward as-is.
  const names = submissionFileNames(caseDocuments);
  const zip = new JSZip();
  const folder = zip.folder(clientName)!;

  for (const doc of caseDocuments) {
    const { data: blob, error } = await supabase.storage.from("client-documents").download(doc.file_path);
    if (error || !blob) continue;
    folder.file(names.get(doc.file_path) ?? doc.file_name, await blob.arrayBuffer());
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const clientSlug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${clientSlug}-documents.zip"`,
    },
  });
}
