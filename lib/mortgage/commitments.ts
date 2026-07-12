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

export function deriveCommitments(extractions: DocumentExtraction[], reportFileNames: Map<DocumentExtraction, string> = new Map()): CommitmentProposal {
  const reports = extractions.filter((x) => (x.credit_facilities?.length ?? 0) > 0);
  if (reports.length === 0) return { sourceLabel: null, lines: [], flags: [] };

  // Latest report wins — never mix two reports' facility lists.
  const latest = [...reports].sort((a, b) => (a.report_date ?? "").localeCompare(b.report_date ?? "")).pop()!;
  const fileName = reportFileNames.get(latest);
  const sourceLabel = `${fileName ?? "credit report"}${latest.report_date ? ` dated ${latest.report_date}` : ""}`;

  const lines: DerivedCommitment[] = [];
  const flags: string[] = [];

  for (const f of latest.credit_facilities!) {
    const label = `${f.facility_type} — ${f.lender}`;
    if (isRevolving(f.facility_type)) {
      if (f.outstanding_balance != null && f.outstanding_balance > 0) {
        lines.push({ description: `${label} (5% of outstanding ${f.outstanding_balance})`, monthly_amount: round2(f.outstanding_balance * REVOLVING_RATE) });
      } else if (f.outstanding_balance === 0) {
        // Zero balance card — no commitment.
      } else {
        flags.push(`${label}: outstanding balance not shown on the report — add its commitment manually.`);
      }
    } else if (f.instalment_amount != null && f.instalment_amount > 0) {
      lines.push({ description: label, monthly_amount: round2(f.instalment_amount) });
    } else if (f.outstanding_balance != null && f.outstanding_balance > 0) {
      flags.push(`${label}: outstanding ${f.outstanding_balance} but no instalment shown — add its commitment manually.`);
    }
    // Facilities with neither figure carry nothing to count.
  }

  return { sourceLabel, lines, flags };
}
