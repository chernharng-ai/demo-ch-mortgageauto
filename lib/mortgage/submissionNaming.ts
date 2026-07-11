// The officer's bank-submission file naming convention — used when zipping
// a case's documents so the folder is ready to forward as-is:
//
//   payslip of month N            → P{N}        (P1 = Jan payslip)
//   bank statement of month N     → B{N}
//   EPF details statement year YY → EPF {YY}
//   EA form year YY               → EA {YY}
//   CTOS report                   → 1.CTOS (MM-DD-YYYY)
//   Experian report               → 1.EXP(MM-DD-YYYY)
//   IC (front & back)             → IC
//   Employment verification       → EVL
//   Offer / confirmation letter   → EOL
//   Booking form                  → 2.Booking Form
//
// Dates use MM-DD-YYYY ("/" is a path separator inside zips). Anything not
// covered keeps its stored file name.

import type { DocumentExtraction } from "./extraction";

export interface NamableDocument {
  file_path: string;
  file_name: string;
  original_file_name: string;
  matched_doc_name: string | null;
  ai_extracted_data: DocumentExtraction | null;
  created_at: string;
}

function formatDate(iso: string): string {
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  const yyyy = iso.slice(0, 4);
  return `${mm}-${dd}-${yyyy}`;
}

function extension(doc: NamableDocument): string {
  const fromPath = doc.file_path.includes(".") ? doc.file_path.split(".").pop() : null;
  return fromPath ? `.${fromPath}` : "";
}

/** The base name (no extension) per the convention, or null when nothing applies. */
function baseName(doc: NamableDocument): string | null {
  const x = doc.ai_extracted_data;
  const haystack = `${doc.matched_doc_name ?? ""} ${doc.original_file_name}`.toLowerCase();

  if (x?.document_type === "payslip" && x.period_label) return `P${Number(x.period_label)}`;
  if (x?.document_type === "bank_statement" && x.period_label) return `B${Number(x.period_label)}`;
  if (x?.document_type === "epf_statement") return x.period_label ? `EPF ${x.period_label}` : "EPF";
  if (x?.document_type === "ic") return "IC";

  if (haystack.includes("ctos")) return `1.CTOS (${formatDate(doc.created_at)})`;
  if (haystack.includes("experian") || haystack.includes("exp report")) return `1.EXP(${formatDate(doc.created_at)})`;
  if (x?.document_type === "tax_form" || haystack.includes("ea form")) return x?.period_label ? `EA ${x.period_label}` : "EA";
  if (haystack.includes("verification")) return "EVL";
  if (haystack.includes("offer letter") || haystack.includes("confirmation letter")) return "EOL";
  if (haystack.includes("booking form")) return "2.Booking Form";

  return null;
}

/** Submission file names for a set of documents, deduplicated with " (2)", " (3)"… suffixes when two files map to the same name. */
export function submissionFileNames(documents: NamableDocument[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Map<string, number>();

  for (const doc of documents) {
    const base = baseName(doc);
    if (!base) {
      names.set(doc.file_path, doc.file_name);
      continue;
    }
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const unique = count === 1 ? base : `${base} (${count})`;
    names.set(doc.file_path, `${unique}${extension(doc)}`);
  }

  return names;
}
