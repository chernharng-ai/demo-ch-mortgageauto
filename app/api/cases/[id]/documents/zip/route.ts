import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CaseDocument, Client } from "@/lib/mortgage/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const supabase = await createClient();

  const [{ data: caseRow }, { data: caseDocuments }] = await Promise.all([
    supabase.from("cases").select("clients(full_name)").eq("id", caseId).single<{ clients: Client }>(),
    supabase.from("case_documents").select("*").eq("case_id", caseId).returns<CaseDocument[]>(),
  ]);

  if (!caseDocuments || caseDocuments.length === 0) {
    return NextResponse.json({ error: "No documents uploaded for this case yet." }, { status: 404 });
  }

  const zip = new JSZip();

  for (const doc of caseDocuments) {
    const { data: blob, error } = await supabase.storage.from("client-documents").download(doc.file_path);
    if (error || !blob) continue;
    zip.file(doc.file_name, await blob.arrayBuffer());
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const clientSlug = (caseRow?.clients?.full_name ?? "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${clientSlug}-documents.zip"`,
    },
  });
}
