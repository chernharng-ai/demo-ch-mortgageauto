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

/** One salary-like incoming credit off a bank statement — used to tally that the payslip's nett pay (and any advance) was actually credited, and on what date. */
export interface SalaryCredit {
  date: string;
  amount: number;
  description: string;
}

/** One credit facility off a CTOS/Experian report's CCRIS section — used to auto-derive the client's existing monthly commitments. */
export interface CreditFacility {
  facility_type: string;
  lender: string;
  instalment_amount: number | null;
  outstanding_balance: number | null;
  /** Approved credit limit (cards/overdrafts) — drives the usage % check. */
  credit_limit: number | null;
}

/** One contribution row off an EPF details statement. Statements may show the employer/employee split, just a combined total, or both — capture whatever is printed so each figure can be tallied against the payslip separately. */
export interface EpfContributionRow {
  month: string;
  year: string;
  employee_amount: number | null;
  employer_amount: number | null;
  total_amount: number | null;
}

export interface DocumentExtraction {
  document_type: string;
  detected_income: ExtractedIncomeLine[];
  employer_name: string | null;
  client_name_on_document: string | null;
  notes: string | null;
  matched_doc_name: string | null;
  /** Short period tag for multi-month/multi-year checklist items — month number ("2" for a Feb payslip) or 2-digit year ("26" for a 2026 EPF statement). Drives the auto-ticked sub-item chips (2✅ 3✅ …). */
  period_label: string | null;
  /** Payslip only: the employee's EPF/KWSP deduction shown on the slip. Null on other documents. */
  epf_employee_deduction: number | null;
  /** Payslip only: the employer's EPF/KWSP contribution if shown. Null otherwise. */
  epf_employer_contribution: number | null;
  /** Payslip only: the employee's SOCSO/PERKESO deduction. Null otherwise. */
  socso_deduction: number | null;
  /** Payslip only: the employee's EIS/SIP deduction. Null otherwise. */
  eis_deduction: number | null;
  /** Payslip only: the PCB/MTD income tax deduction. Null otherwise. */
  pcb_deduction: number | null;
  /** Payslip only: the NETT PAY / take-home amount printed on the slip. Null otherwise. */
  nett_pay: number | null;
  /** Payslip only: a salary advance amount if the slip shows one (mid-month advance paid separately). Null otherwise. */
  salary_advance: number | null;
  /** Bank statement only: incoming credits that look like salary/payroll/advance payments, each with the credit date. Null on other documents. */
  salary_credits: SalaryCredit[] | null;
  /** EPF details statement only: every monthly contribution row visible. Null on other documents. Used to tally against payslip deductions (one-month lag). */
  epf_contributions: EpfContributionRow[] | null;
  /** IC only: true when BOTH front and back sides are visible in the document, false when only one side is. Null on non-IC documents. */
  ic_front_and_back: boolean | null;
  /** Credit reports (CTOS/Experian) only: the report/order date printed on the document as YYYY-MM-DD — tells the officer whether a fresh report is needed before submission. Null on other documents. */
  report_date: string | null;
  /** Credit reports only: every outstanding credit facility on the CCRIS/banking section — used to auto-derive the client's existing monthly commitments. Null on other documents. */
  credit_facilities: CreditFacility[] | null;
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
        description:
          "Which checklist item this document belongs to, by document CATEGORY — e.g. any payslip files under the payslip item even if the item asks for 3 months and this is one month. Null only when no checklist item is of this document's kind.",
        anyOf: [{ type: "string", enum: candidateDocNames }, { type: "null" }],
      },
      period_label: {
        description:
          "The period this document covers, as the shortest natural tag: the month number for a monthly document ('2' for a February payslip or bank statement), the 2-digit year for a yearly document ('26' for a 2026 EPF or tax statement). Null for documents with no period (IC, booking form, credit report).",
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      payslip_figures: {
        description:
          "Payslips only (null on any other document type): the key figures printed on the slip. For any figure NOT printed on the slip, use -1 (meaning 'not shown') — never guess.",
        anyOf: [
          {
            type: "object",
            properties: {
              epf_employee: { type: "number", description: "Employee EPF/KWSP deduction, or -1 if not shown." },
              epf_employer: { type: "number", description: "Employer EPF/KWSP contribution, or -1 if not shown." },
              socso: { type: "number", description: "Employee SOCSO/PERKESO deduction, or -1 if not shown." },
              eis: { type: "number", description: "Employee EIS/SIP deduction, or -1 if not shown." },
              pcb: { type: "number", description: "PCB/MTD monthly income tax deduction, or -1 if not shown." },
              nett_pay: { type: "number", description: "NETT PAY / take-home amount, or -1 if not shown." },
              salary_advance: { type: "number", description: "Salary advance paid separately (e.g. mid-month), or -1 if none shown." },
            },
            required: ["epf_employee", "epf_employer", "socso", "eis", "pcb", "nett_pay", "salary_advance"],
            additionalProperties: false,
          },
          { type: "null" },
        ],
      },
      salary_credits: {
        description:
          "Bank statements only: EVERY deposit / incoming credit transaction row (money IN — the DEPOSIT/SIMPANAN column, NOT withdrawals), with the credit date as YYYY-MM-DD, the exact amount, and the description plus any additional details as printed. List them all; do not filter or judge which ones are salary. Null on other documents.",
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Credit date, YYYY-MM-DD." },
                amount: { type: "number" },
                description: { type: "string" },
              },
              required: ["date", "amount", "description"],
              additionalProperties: false,
            },
          },
          { type: "null" },
        ],
      },
      epf_contributions: {
        description:
          "EPF details statements only: EVERY monthly contribution row visible, each with the month number it was credited ('2' for February) and 2-digit year ('26'). Copy each printed figure into its own field: the employee share, the employer share, and the combined total — use null for any figure the statement does not print separately. Null on any other document type.",
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                month: { type: "string", description: "Month number the contribution was credited, '1'-'12'." },
                year: { type: "string", description: "2-digit year, e.g. '26'." },
                employee_amount: { type: "number", description: "Employee share as printed, or -1 if not shown separately." },
                employer_amount: { type: "number", description: "Employer share as printed, or -1 if not shown separately." },
                total_amount: { type: "number", description: "Combined total as printed, or -1 if only the split is shown." },
              },
              required: ["month", "year", "employee_amount", "employer_amount", "total_amount"],
              additionalProperties: false,
            },
          },
          { type: "null" },
        ],
      },
      ic_front_and_back: {
        description: "IC documents only: true when BOTH the front and back of the IC are visible, false when only one side is. Null on non-IC documents.",
        anyOf: [{ type: "boolean" }, { type: "null" }],
      },
      report_date: {
        description:
          "Credit reports (CTOS/Experian) only: the report/order date printed on the document header, as YYYY-MM-DD (e.g. a CTOS 'Date: 2026-05-15 16:53:24' → '2026-05-15'; an Experian 'Order Date: 2026-06-29 01:28:22' → '2026-06-29'). Null on any other document type.",
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      credit_facilities: {
        description:
          "Credit reports (CTOS/Experian) only: EVERY outstanding credit facility listed in the CCRIS/banking payment records section — active loans, credit cards, overdrafts, PTPTN etc. For each: the facility type as printed (e.g. 'hire purchase', 'housing loan', 'credit card', 'personal loan', 'overdraft', 'ptptn'), the lender/bank name, the monthly instalment amount (-1 if not shown), and the outstanding balance (-1 if not shown). Exclude fully settled/closed facilities. Null on any other document type.",
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                facility_type: { type: "string" },
                lender: { type: "string" },
                instalment_amount: { type: "number", description: "Monthly instalment as printed, or -1 if not shown." },
                outstanding_balance: { type: "number", description: "Outstanding balance as printed, or -1 if not shown." },
                credit_limit: { type: "number", description: "Approved credit limit (cards/overdrafts) as printed, or -1 if not shown." },
              },
              required: ["facility_type", "lender", "instalment_amount", "outstanding_balance", "credit_limit"],
              additionalProperties: false,
            },
          },
          { type: "null" },
        ],
      },
    },
    required: [
      "document_type",
      "detected_income",
      "employer_name",
      "client_name_on_document",
      "notes",
      "matched_doc_name",
      "period_label",
      "payslip_figures",
      "salary_credits",
      "epf_contributions",
      "ic_front_and_back",
      "report_date",
      "credit_facilities",
    ],
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
        "document (e.g. an IC), return an empty detected_income array. Also file the document under the checklist item it " +
        `belongs to, by category: ${candidateDocNames.map((n) => `"${n}"`).join(", ")}. Match on document KIND, not quantity — ` +
        "a single month's payslip still files under a '3 months payslip' item (use notes to flag that more months are needed). " +
        "Return matched_doc_name as exactly one of those strings, or null only if no item is of this document's kind. " +
        "Also return period_label: the month number for a monthly document (e.g. '5' for May), the 2-digit year for a yearly one (e.g. '26' for 2026), or null if the document has no period. " +
        "On a payslip, fill payslip_figures with every figure printed (EPF employee deduction, employer EPF contribution, SOCSO, EIS, PCB, NETT PAY, salary advance) — use -1 for any figure the slip does not print. " +
        "On a bank statement, list EVERY deposit/incoming credit row — money in only, straight off the deposit column, no filtering (date, exact amount, description including additional details as printed). " +
        "On an EPF details statement, list every monthly contribution row (month credited, year, employee share, employer share, total — use -1 for any figure not printed). " +
        "On an IC, report whether both front and back are visible. " +
        "On a credit report (CTOS/Experian), extract the report/order date printed on the header as report_date (YYYY-MM-DD), and list EVERY outstanding credit facility from the CCRIS/banking section (type, lender, monthly instalment, outstanding balance, and for cards/overdrafts the approved credit limit — use -1 for figures not shown; exclude settled facilities).",
    },
  ];

  // One malformed response must not silently drop a document's data (a
  // silent null here previously masked a real extraction failure) — log
  // loudly and retry once before giving up.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.create({
      // Sonnet, not Haiku: Haiku misread bank-statement table columns (missed
      // obvious salary credits, picked a withdrawal as a credit) — the officer's
      // zero-mistake standard is worth the extra fraction of a sen per document.
      model: "claude-sonnet-5",
      // Bank statements/credit reports can carry many rows on top of the
      // other fields — leave generous headroom so the JSON never truncates
      // (a full CTOS extraction has been observed to exceed 4096).
      max_tokens: 8192,
      output_config: { format: { type: "json_schema", schema: buildExtractionSchema(candidateDocNames) } },
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      console.error(`Extraction attempt ${attempt}: no text block (stop_reason: ${response.stop_reason})`);
      continue;
    }

    try {
      return normalizeRawExtraction(JSON.parse(textBlock.text));
    } catch (err) {
      console.error(
        `Extraction attempt ${attempt}: JSON parse failed (stop_reason: ${response.stop_reason}, length: ${textBlock.text.length}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return null;
}

/** -1 is the schema's sentinel for "not printed on the document" (the structured-output API caps union-typed fields, so nested figures can't be nullable). */
function unsentinel(v: number | null | undefined): number | null {
  return v == null || v === -1 ? null : v;
}

/** Maps the raw schema shape (nested payslip_figures, -1 sentinels) onto the flat DocumentExtraction interface the rest of the app consumes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRawExtraction(raw: any): DocumentExtraction {
  const pf = raw.payslip_figures ?? null;
  return {
    document_type: raw.document_type,
    detected_income: raw.detected_income ?? [],
    employer_name: raw.employer_name ?? null,
    client_name_on_document: raw.client_name_on_document ?? null,
    notes: raw.notes ?? null,
    matched_doc_name: raw.matched_doc_name ?? null,
    period_label: raw.period_label ?? null,
    epf_employee_deduction: unsentinel(pf?.epf_employee),
    epf_employer_contribution: unsentinel(pf?.epf_employer),
    socso_deduction: unsentinel(pf?.socso),
    eis_deduction: unsentinel(pf?.eis),
    pcb_deduction: unsentinel(pf?.pcb),
    nett_pay: unsentinel(pf?.nett_pay),
    salary_advance: unsentinel(pf?.salary_advance),
    salary_credits: raw.salary_credits ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    epf_contributions: raw.epf_contributions
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.epf_contributions.map((r: any) => ({
          month: r.month,
          year: r.year,
          employee_amount: unsentinel(r.employee_amount),
          employer_amount: unsentinel(r.employer_amount),
          total_amount: unsentinel(r.total_amount),
        }))
      : null,
    ic_front_and_back: raw.ic_front_and_back ?? null,
    report_date: raw.report_date ?? null,
    credit_facilities: raw.credit_facilities
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.credit_facilities.map((f: any) => ({
          facility_type: f.facility_type,
          lender: f.lender,
          instalment_amount: unsentinel(f.instalment_amount),
          outstanding_balance: unsentinel(f.outstanding_balance),
          credit_limit: unsentinel(f.credit_limit),
        }))
      : null,
  };
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
