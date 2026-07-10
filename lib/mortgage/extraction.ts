// Document extraction via Claude's vision API. This is the one place in the
// app that sends client data to a third-party AI model — explicitly approved
// by the user (see docs/SECURITY.md's stop point on this). Extraction is
// always shown as a draft the officer must confirm before it becomes an
// income entry; nothing here writes to income_entries directly.

import Anthropic from "@anthropic-ai/sdk";
import type { IncomeType } from "./types";

const INCOME_TYPES = ["basic", "allowance", "commission", "rental", "net_profit", "other"] as const;

export interface ExtractedIncomeLine {
  income_type: IncomeType;
  gross_amount: number;
  frequency: "monthly" | "annual";
  confidence: number;
}

export interface DocumentExtraction {
  document_type: string;
  detected_income: ExtractedIncomeLine[];
  employer_name: string | null;
  client_name_on_document: string | null;
  notes: string | null;
  matched_doc_name: string | null;
}

function buildExtractionSchema(candidateDocNames: string[]) {
  return {
    type: "object",
    properties: {
      document_type: {
        type: "string",
        description: "What kind of document this is, e.g. payslip, bank_statement, ic, epf_statement, tax_form, offer_letter, other",
      },
      detected_income: {
        type: "array",
        description: "Any income figures visible on the document. Empty array if none (e.g. an IC or offer letter).",
        items: {
          type: "object",
          properties: {
            income_type: { type: "string", enum: INCOME_TYPES as unknown as string[] },
            gross_amount: { type: "number", description: "The gross figure as shown, before any bank multiplier." },
            frequency: { type: "string", enum: ["monthly", "annual"] },
            confidence: { type: "number", description: "0 to 1" },
          },
          required: ["income_type", "gross_amount", "frequency", "confidence"],
          additionalProperties: false,
        },
      },
      employer_name: { type: ["string", "null"] },
      client_name_on_document: { type: ["string", "null"] },
      notes: { type: ["string", "null"], description: "Anything the officer should double-check, e.g. blurry, multiple months shown, figures don't add up." },
      matched_doc_name: {
        description: "Which checklist item this document satisfies, chosen from the candidate list. Null if none fit.",
        anyOf: [{ type: "string", enum: candidateDocNames }, { type: "null" }],
      },
    },
    required: ["document_type", "detected_income", "employer_name", "client_name_on_document", "notes", "matched_doc_name"],
    additionalProperties: false,
  };
}

/**
 * Extracts income figures, document type, and the best-matching checklist
 * item from a payslip/bank statement/etc. Returns null if the file type
 * isn't supported for vision (caller should fall back to classifyByFilename).
 */
export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
  candidateDocNames: string[],
): Promise<DocumentExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const supportedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
  const isPdf = mimeType === "application/pdf";
  if (!supportedImage && !isPdf) return null;

  const client = new Anthropic({ apiKey });
  const base64 = fileBuffer.toString("base64");

  const content: Anthropic.ContentBlockParam[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } },
    {
      type: "text",
      text:
        "This is a mortgage applicant's supporting document. Identify the document type and extract any income figures shown, " +
        "using the exact numbers on the document (do not apply any bank-specific multiplier). If it's not an income-bearing " +
        "document (e.g. an IC), return an empty detected_income array. Also decide which item from this checklist the document " +
        `satisfies: ${candidateDocNames.map((n) => `"${n}"`).join(", ")}. Return matched_doc_name as exactly one of those strings, or null if none fit.`,
    },
  ];

  const response = await client.messages.create({
    // Haiku keeps this near-zero cost — reading numbers off a payslip
    // doesn't need Opus-tier reasoning.
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: buildExtractionSchema(candidateDocNames) } },
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return null;

  try {
    return JSON.parse(textBlock.text) as DocumentExtraction;
  } catch {
    return null;
  }
}

/**
 * Filename-based fallback classifier for file types the vision API doesn't
 * read (e.g. .docx) or when no API key is configured — keeps every dropped
 * file going through *some* classification instead of being left unmatched.
 */
export function classifyByFilename(originalFileName: string, candidateDocNames: string[]): string | null {
  const name = originalFileName.toLowerCase();
  let best: { docName: string; score: number } | null = null;

  for (const docName of candidateDocNames) {
    const words = docName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4);
    const score = words.filter((w) => name.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { docName, score };
    }
  }

  return best?.docName ?? null;
}

/** Renames an uploaded file to a consistent, traceable convention. */
export function buildStorageFileName(clientName: string, docName: string, originalFileName: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const ext = originalFileName.includes(".") ? originalFileName.split(".").pop() : "bin";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slug(clientName)}_${slug(docName)}_${timestamp}.${ext}`;
}
