// Derives the client's existing monthly commitments from the credit
// report's CCRIS facility list — the same arithmetic the officer does by
// hand in their review notes ("1809 hl + 388.90 cc + 2984 hp + …"):
//
//   - loans (hire purchase, housing, personal, PTPTN, …): the monthly
//     instalment amount as reported
//   - credit cards / overdrafts: 5% of the outstanding balance — the
//     standard banking convention for revolving credit in DSR workings
//
// When both CTOS and Experian are uploaded, only the LATEST report (by its
// printed report date) is used, so facilities are never double counted.
// A facility whose needed figure isn't shown is flagged, never guessed.

import type { DocumentExtraction } from "./extraction";

export interface DerivedCommitment {
  description: string;
  monthly_amount: number;
}

export interface CommitmentProposal {
  sourceLabel: string | null;
  lines: DerivedCommitment[];
  flags: string[];
}

const REVOLVING_RATE = 0.05;

function isRevolving(facilityType: string): boolean {
  const t = facilityType.toLowerCase();
  return t.includes("credit card") || t.includes("card") || t.includes("overdraft");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-MY", { maximumFractionDigits: 2 });
}

/** Same facility kind at the same lender lists as ONE CF line, balances summed and shown as "a + b = total" — the officer's review-note convention. */
export function deriveCommitments(extractions: DocumentExtraction[], reportFileNames: Map<DocumentExtraction, string> = new Map()): CommitmentProposal {
  const reports = extractions.filter((x) => (x.credit_facilities?.length ?? 0) > 0);
  if (reports.length === 0) return { sourceLabel: null, lines: [], flags: [] };

  // Latest report wins — never mix two reports' facility lists.
  const latest = [...reports].sort((a, b) => (a.report_date ?? "").localeCompare(b.report_date ?? "")).pop()!;
  const fileName = reportFileNames.get(latest);
  const sourceLabel = `${fileName ?? "credit report"}${latest.report_date ? ` dated ${latest.report_date}` : ""}`;

  const flags: string[] = [];

  // Group by facility kind + lender, preserving report order.
  const groups = new Map<string, { facilityType: string; lender: string; instalments: number[]; outstandings: number[]; limits: number[] }>();
  for (const f of latest.credit_facilities!) {
    const label = `${f.facility_type} — ${f.lender}`;
    if (isRevolving(f.facility_type)) {
      if (f.outstanding_balance == null) {
        flags.push(`${label}: outstanding balance not shown on the report — add its commitment manually.`);
        continue;
      }
      if (f.outstanding_balance === 0) continue; // zero-balance card — no commitment
    } else if (f.instalment_amount == null || f.instalment_amount <= 0) {
      if (f.outstanding_balance != null && f.outstanding_balance > 0) {
        flags.push(`${label}: outstanding ${fmt(f.outstanding_balance)} but no instalment shown — add its commitment manually.`);
      }
      continue;
    }
    const key = `${f.facility_type.trim().toLowerCase()}|${f.lender.trim().toLowerCase()}`;
    const g = groups.get(key) ?? { facilityType: f.facility_type, lender: f.lender, instalments: [], outstandings: [], limits: [] };
    if (f.instalment_amount != null && f.instalment_amount > 0) g.instalments.push(f.instalment_amount);
    if (f.outstanding_balance != null && f.outstanding_balance > 0) g.outstandings.push(f.outstanding_balance);
    if (f.credit_limit != null && f.credit_limit > 0) g.limits.push(f.credit_limit);
    groups.set(key, g);
  }

  const lines: DerivedCommitment[] = [];
  let cf = 0;
  for (const g of groups.values()) {
    cf++;
    const outstandingTotal = g.outstandings.reduce((a, b) => a + b, 0);
    const outstandingText =
      g.outstandings.length > 1 ? `${g.outstandings.map(fmt).join(" + ")} = ${fmt(outstandingTotal)}` : g.outstandings.length === 1 ? fmt(outstandingTotal) : "n/a";
    if (isRevolving(g.facilityType)) {
      // Usage % against the approved limit — above 60% is a red flag banks
      // scrutinise ("CC MAX USAGE" in the guideline sheet), so mark it ‼️.
      const limitTotal = g.limits.reduce((a, b) => a + b, 0);
      let usageText = "";
      if (limitTotal > 0) {
        const usage = (outstandingTotal / limitTotal) * 100;
        usageText = ` ; usage ${Math.round(usage * 10) / 10}%${usage > 60 ? " ‼️" : ""}`;
        if (usage > 60) {
          flags.push(`CF ${cf} ${g.facilityType} — ${g.lender}: usage ${Math.round(usage * 10) / 10}% is above 60% ‼️ — ask client to reduce before submission.`);
        }
      } else {
        usageText = " ; usage n/a (limit not shown)";
      }
      lines.push({
        description: `CF ${cf} : ${g.facilityType} — ${g.lender} ; outstanding ${outstandingText} (5%)${usageText}`,
        monthly_amount: round2(outstandingTotal * REVOLVING_RATE),
      });
    } else {
      lines.push({
        description: `CF ${cf} : ${g.facilityType} — ${g.lender} ; outstanding ${outstandingText}`,
        monthly_amount: round2(g.instalments.reduce((a, b) => a + b, 0)),
      });
    }
  }

  return { sourceLabel, lines, flags };
}
