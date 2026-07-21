// Auto-fills the Case Review Note from everything the app has already
// computed — the officer only types true judgment calls (risk level,
// approval chance, agent instructions). Saved edits always win; these are
// live defaults shown when a field hasn't been set manually.

import type { CaseCommitment, IncomeEntry, LoanEligibility, Bank } from "./types";
import type { ConsolidatedIncomeProposal } from "./consolidate";
import type { CommitmentProposal } from "./commitments";
import type { TallyResult } from "./tally";

export interface ReviewAutoFill {
  age: number | null;
  gross_income: string | null;
  nett_income: string | null;
  max_allowed_commitment: number | null;
  commitment_breakdown: string | null;
  attention: string | null;
  bank_eligible_notes: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Age from a Malaysian IC number (YYMMDD-PB-XXXX) as at the application date. */
export function ageFromIc(icNumber: string | null, applicationDate: string): number | null {
  if (!icNumber) return null;
  const digits = icNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const appYear = Number(applicationDate.slice(0, 4));
  const year = yy > appYear % 100 ? 1900 + yy : 2000 + yy;
  let age = appYear - year;
  const appMonth = Number(applicationDate.slice(5, 7));
  const appDay = Number(applicationDate.slice(8, 10));
  if (appMonth < mm || (appMonth === mm && appDay < dd)) age--;
  return age > 0 && age < 100 ? age : null;
}

export function buildReviewAutoFill(input: {
  icNumber: string | null;
  applicationDate: string;
  incomeEntries: IncomeEntry[];
  commitments: CaseCommitment[];
  eligibilities: LoanEligibility[];
  banks: Bank[];
  incomeProposal: ConsolidatedIncomeProposal;
  commitmentProposal: CommitmentProposal;
  tally: TallyResult;
}): ReviewAutoFill {
  const monthly = (e: IncomeEntry) => (e.frequency === "annual" ? e.gross_amount / 12 : e.gross_amount);

  const grossIncome = round2(input.incomeEntries.reduce((s, e) => s + monthly(e), 0));
  const nettIncome = round2(
    input.incomeEntries.reduce((s, e) => {
      const base = e.nett_amount != null ? e.nett_amount : monthly(e);
      return s + base;
    }, 0),
  );
  const maxAllowed = round2(nettIncome * 0.5);
  const commitmentTotal = round2(input.commitments.reduce((s, c) => s + Number(c.monthly_amount), 0));

  // Commitment breakdown in the officer's format — one CF line each + total.
  const commitmentBreakdown =
    input.commitments.length > 0
      ? [...input.commitments.map((c) => `${c.description.split(" · from ")[0]} = ${fmt(Number(c.monthly_amount))}`), `Total = ${fmt(commitmentTotal)}`].join("\n")
      : null;

  // Attention: everything the pipeline flagged, plus the headline affordability problem.
  const attention: string[] = [];
  if (commitmentTotal > maxAllowed && maxAllowed > 0) {
    attention.push(`Commitment ${fmt(commitmentTotal)} EXCEEDS max allowed ${fmt(maxAllowed)} ‼️ — settlement/restructuring needed before submission.`);
  }
  attention.push(...input.commitmentProposal.flags.map((f) => `- ${f}`));
  attention.push(...input.incomeProposal.flags.map((f) => `- ${f}`));
  if (input.tally.ic.status !== "ok") attention.push(`- IC: ${input.tally.ic.detail}`);
  if (input.tally.epf.statementType.status !== "ok") attention.push(`- EPF: ${input.tally.epf.statementType.detail}`);
  for (const m of input.tally.epf.months.filter((m) => m.status === "fail")) {
    attention.push(`- EPF tally month ${m.payslipMonth}: mismatch — check payslip vs statement.`);
  }
  for (const m of input.tally.salary.months.filter((m) => m.status !== "ok")) {
    attention.push(`- Salary crediting month ${m.payslipMonth}: ${m.detail}`);
  }

  // Bank eligible: ranked 90% results (non-zero first), with SJKP where offered.
  const bankName = (id: string) => input.banks.find((b) => b.id === id)?.name ?? "?";
  const std = input.eligibilities
    .filter((e) => e.package === "standard_90")
    .sort((a, b) => b.max_loan_amount - a.max_loan_amount);
  const sjkpById = new Map(input.eligibilities.filter((e) => e.package === "sjkp_100").map((e) => [e.bank_id, e]));
  const nonZero = std.filter((e) => e.max_loan_amount > 0);
  const lines = nonZero.slice(0, 5).map((e) => {
    const sjkp = sjkpById.get(e.bank_id);
    const sjkpText = sjkp && sjkp.max_loan_amount > 0 ? ` (SJKP ${fmt(sjkp.max_loan_amount)})` : "";
    return `- ${bankName(e.bank_id)} : RM ${fmt(e.max_loan_amount)}${sjkpText}`;
  });
  if (std.length > nonZero.length) {
    const zeroCount = std.length - nonZero.length;
    lines.push(`- ${zeroCount} other bank${zeroCount === 1 ? "" : "s"} : RM 0 at current commitments`);
  }
  const bankEligibleNotes = lines.length > 0 ? lines.join("\n") : null;

  return {
    age: ageFromIc(input.icNumber, input.applicationDate),
    gross_income: grossIncome > 0 ? fmt(grossIncome) : null,
    nett_income: nettIncome > 0 ? fmt(nettIncome) : null,
    max_allowed_commitment: maxAllowed > 0 ? maxAllowed : null,
    commitment_breakdown: commitmentBreakdown,
    attention: attention.length > 0 ? attention.join("\n") : null,
    bank_eligible_notes: bankEligibleNotes,
  };
}
