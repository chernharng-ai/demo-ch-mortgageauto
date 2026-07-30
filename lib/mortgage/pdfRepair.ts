// Malaysian client documents routinely arrive as PDFs Claude's parser
// rejects: bank statements and credit reports are password-protected
// (the password is almost always the client's IC number or a fragment of
// it), and portal "print to PDF" exports (Experian via Qt) prepend junk
// bytes before the %PDF header and break the xref offsets.
//
// This module repairs both cases automatically so the officer never has
// to unlock a file by hand:
//   1. strip any junk bytes before the %PDF header
//   2. open with MuPDF (which tolerates and repairs broken xrefs)
//   3. if encrypted, try IC-derived password candidates
//   4. re-save as a clean, unencrypted PDF for the vision API
//
// If the file is encrypted and no candidate unlocks it, PdfLockedError is
// thrown so the UI can tell the officer to get the password from the
// client — a flagged failure, never a silent one.

export class PdfLockedError extends Error {
  constructor() {
    super("Password-protected PDF — could not unlock with the client's IC. Ask the client for the PDF password.");
    this.name = "PdfLockedError";
  }
}

/** Password candidates for Malaysian bank/credit-agency PDFs, derived from the client IC (most portals use the full 12 digits). */
export function icPasswordCandidates(icNumber: string | null): string[] {
  if (!icNumber) return [];
  const digits = icNumber.replace(/\D/g, "");
  if (digits.length < 4) return [];
  const candidates = new Set<string>();
  candidates.add(digits); // full IC, no dashes — the overwhelming default
  if (digits.length === 12) {
    candidates.add(`${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`); // dashed form
    candidates.add(digits.slice(0, 6)); // birth date YYMMDD
    candidates.add(digits.slice(-4)); // last 4
    candidates.add(digits.slice(-6)); // last 6
    candidates.add(digits.slice(-8)); // last 8
  }
  return [...candidates];
}

function stripLeadingJunk(buffer: Buffer): Buffer {
  const idx = buffer.subarray(0, 4096).indexOf("%PDF");
  return idx > 0 ? buffer.subarray(idx) : buffer;
}

/**
 * Returns a buffer safe to send to the vision API. Non-PDFs pass through
 * untouched; PDFs are repaired/decrypted when needed. Throws PdfLockedError
 * when the PDF is encrypted and no candidate password unlocks it. Any other
 * repair failure falls back to the original bytes (never makes things worse).
 */
export async function prepareForExtraction(buffer: Buffer, mimeType: string, passwordCandidates: string[]): Promise<Buffer> {
  if (mimeType !== "application/pdf") return buffer;

  const trimmed = stripLeadingJunk(buffer);

  let mupdf: typeof import("mupdf");
  try {
    mupdf = await import("mupdf");
  } catch (err) {
    console.error("mupdf failed to load — sending PDF as-is:", err);
    return trimmed;
  }

  try {
    const doc = mupdf.Document.openDocument(trimmed, "application/pdf");

    if (doc.needsPassword()) {
      const unlocked = passwordCandidates.some((pw) => doc.authenticatePassword(pw) !== 0);
      if (!unlocked) throw new PdfLockedError();
    }

    const pdf = doc as import("mupdf").PDFDocument;
    // Re-save clean + unencrypted. Option support varies by version — try
    // the strongest form first, fall back gracefully.
    for (const options of ["garbage=2,decrypt=yes", "garbage=2,encrypt=none", "garbage=2", ""]) {
      try {
        const out = pdf.saveToBuffer(options);
        return Buffer.from(out.asUint8Array());
      } catch {
        continue;
      }
    }
    return trimmed;
  } catch (err) {
    if (err instanceof PdfLockedError) throw err;
    console.error("PDF repair failed — sending PDF as-is:", err);
    return trimmed;
  }
}
