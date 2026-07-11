// Cross-document tally checks the officer runs before bank submission —
// deterministic comparisons over the AI-extracted fields, no AI here.
//
// EPF rule (from the officer): a payslip's EPF deduction is credited to the
// EPF account the FOLLOWING month — Jan 26 payslip deduction appears as the
// Feb 26 contribution row on the EPF details statement. The statement's
// contribution amount is employer + employee combined, so the comparison is
// payslip (employee deduction + employer contribution) vs next month's
// statement row.

import type { DocumentExtraction } from "./extraction";

export interface TallyDocument {
  original_file_name: string;
  matched_doc_name: string | null;
  ai_extracted_data: DocumentExtraction | null;
}

export type TallyStatus = "ok" | "warn" | "fail";

export interface EpfMonthTally {
  payslipMonth: string;
  payslipFile: string;
  payslipEmployee: number | null;
  payslipEmployer: number | null;
  expectedStatementMonth: string;
  statementAmount: number | null;
  status: TallyStatus;
  detail: string;
}

export interface TallyResult {
  ic: { status: TallyStatus; detail: string };
  epf: {
    status: TallyStatus;
    months: EpfMonthTally[];
    detail: string | null;
  };
}

/** Amounts within RM2 are treated as matching — statements round differently than payslips. */
const EPF_TOLERANCE = 2;

function isPayslip(doc: TallyDocument): boolean {
  return doc.ai_extracted_data?.document_type === "payslip";
}

function isEpfStatement(doc: TallyDocument): boolean {
  return doc.ai_extracted_data?.document_type === "epf_statement";
}

function isIc(doc: TallyDocument): boolean {
  return doc.ai_extracted_data?.document_type === "ic";
}

export function runDocumentTally(documents: TallyDocument[]): TallyResult {
  // IC: both sides must be present.
  const icDocs = documents.filter(isIc);
  let ic: TallyResult["ic"];
  if (icDocs.length === 0) {
    ic = { status: "fail", detail: "No IC uploaded." };
  } else if (icDocs.some((d) => d.ai_extracted_data?.ic_front_and_back === true)) {
    ic = { status: "ok", detail: "IC front and back both present." };
  } else {
    ic = { status: "warn", detail: "IC uploaded but only one side is visible — need both front and back." };
  }

  // EPF: payslip month M deduction should appear as statement month M+1 contribution.
  // A 2-year statement has the same month number twice (Feb 25 and Feb 26) —
  // payslips carry no year, so tally against the most recent year's row.
  const contributionRows = documents.filter(isEpfStatement).flatMap((d) => d.ai_extracted_data?.epf_contributions ?? []);
  const statementByMonth = new Map<string, { amount: number; year: number }>();
  for (const row of contributionRows) {
    const key = String(Number(row.month));
    const year = Number(row.year);
    const existing = statementByMonth.get(key);
    if (!existing || year > existing.year) {
      statementByMonth.set(key, { amount: row.amount, year });
    }
  }

  const months: EpfMonthTally[] = [];
  for (const doc of documents.filter(isPayslip)) {
    const x = doc.ai_extracted_data!;
    if (!x.period_label) continue;
    const payslipMonth = String(Number(x.period_label));
    const expectedStatementMonth = String((Number(payslipMonth) % 12) + 1);
    const employee = x.epf_employee_deduction;
    const employer = x.epf_employer_contribution;
    const statementAmount = statementByMonth.get(expectedStatementMonth)?.amount ?? null;

    let status: TallyStatus;
    let detail: string;
    if (employee == null) {
      status = "warn";
      detail = "No EPF deduction visible on this payslip.";
    } else if (statementAmount == null) {
      status = contributionRows.length === 0 ? "warn" : "fail";
      detail =
        contributionRows.length === 0
          ? "No EPF statement contributions extracted yet."
          : `No contribution row for month ${expectedStatementMonth} on the EPF statement.`;
    } else if (employer != null) {
      const expected = employee + employer;
      status = Math.abs(expected - statementAmount) <= EPF_TOLERANCE ? "ok" : "fail";
      detail =
        status === "ok"
          ? `Payslip ${employee} + ${employer} = ${expected} matches statement ${statementAmount}.`
          : `Payslip ${employee} + ${employer} = ${expected} but statement shows ${statementAmount}.`;
    } else {
      // Employer portion not on the slip — check the employee share is at least contained in the total.
      status = statementAmount > employee - EPF_TOLERANCE ? "warn" : "fail";
      detail =
        status === "warn"
          ? `Employer portion not on payslip — statement total ${statementAmount} vs employee deduction ${employee}; verify manually.`
          : `Statement total ${statementAmount} is LESS than the employee deduction ${employee} alone.`;
    }

    months.push({ payslipMonth, payslipFile: doc.original_file_name, payslipEmployee: employee, payslipEmployer: employer, expectedStatementMonth, statementAmount, status, detail });
  }

  months.sort((a, b) => Number(a.payslipMonth) - Number(b.payslipMonth));

  let epfStatus: TallyStatus;
  let epfDetail: string | null = null;
  if (months.length === 0) {
    epfStatus = "warn";
    epfDetail = "No payslips with a readable month to tally against the EPF statement.";
  } else if (months.some((m) => m.status === "fail")) {
    epfStatus = "fail";
  } else if (months.some((m) => m.status === "warn")) {
    epfStatus = "warn";
  } else {
    epfStatus = "ok";
  }

  return { ic, epf: { status: epfStatus, months, detail: epfDetail } };
}
