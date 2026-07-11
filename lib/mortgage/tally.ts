// Cross-document tally checks the officer runs before bank submission —
// deterministic comparisons over the AI-extracted fields, no AI here.
//
// EPF rule (from the officer): a payslip's EPF deduction is credited to the
// EPF account the FOLLOWING month — Jan 26 payslip deduction appears as the
// Feb 26 contribution row on the EPF details statement. Every figure the
// bank officer can see must tally independently: the employee share, the
// employer share, AND the combined total — one wrong number anywhere is
// grounds for the bank to reject the application.

import type { DocumentExtraction, EpfContributionRow } from "./extraction";

export interface TallyDocument {
  original_file_name: string;
  matched_doc_name: string | null;
  ai_extracted_data: DocumentExtraction | null;
}

export type TallyStatus = "ok" | "warn" | "fail";

export interface EpfComponentCheck {
  label: "employee" | "employer" | "total";
  payslipAmount: number | null;
  statementAmount: number | null;
  status: TallyStatus;
  detail: string;
}

export interface EpfMonthTally {
  payslipMonth: string;
  payslipFile: string;
  expectedStatementMonth: string;
  checks: EpfComponentCheck[];
  status: TallyStatus;
  detail: string | null;
}

export interface TallyResult {
  ic: { status: TallyStatus; detail: string };
  epf: {
    status: TallyStatus;
    /** Banks only accept the DETAILS statement showing the employee/employer breakdown per transaction — a summary/totals-only statement is the wrong document and must be re-requested from the client. */
    statementType: { status: TallyStatus; detail: string };
    months: EpfMonthTally[];
    detail: string | null;
  };
}

/** True when an EPF statement extraction shows the employee/employer breakdown on every contribution row — i.e. it's the details statement banks require, not a summary. */
export function epfStatementHasSplit(x: DocumentExtraction): boolean {
  const rows = x.epf_contributions ?? [];
  return rows.length > 0 && rows.every((r) => r.employee_amount != null && r.employer_amount != null);
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

function worst(statuses: TallyStatus[]): TallyStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "ok";
}

function compareFigure(label: EpfComponentCheck["label"], payslipAmount: number | null, statementAmount: number | null): EpfComponentCheck | null {
  // Statement doesn't print this figure — a format limitation, not a
  // discrepancy; the officer can't cross-check it either. Skip.
  if (statementAmount == null) return null;
  if (payslipAmount == null) {
    return { label, payslipAmount, statementAmount, status: "warn", detail: `${label}: not visible on payslip — statement shows ${statementAmount}.` };
  }
  const match = Math.abs(payslipAmount - statementAmount) <= EPF_TOLERANCE;
  return {
    label,
    payslipAmount,
    statementAmount,
    status: match ? "ok" : "fail",
    detail: match ? `${label}: ${payslipAmount} = ${statementAmount}` : `${label}: payslip ${payslipAmount} but statement ${statementAmount}`,
  };
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

  // Statement type gate: banks only accept the DETAILS statement showing the
  // employee/employer breakdown per transaction. A summary/totals-only
  // statement is the wrong document — flag it so the officer re-requests.
  const epfDocs = documents.filter(isEpfStatement);
  let statementType: TallyResult["epf"]["statementType"];
  if (epfDocs.length === 0) {
    statementType = { status: "warn", detail: "No EPF statement uploaded yet." };
  } else if (epfDocs.some((d) => epfStatementHasSplit(d.ai_extracted_data!))) {
    statementType = { status: "ok", detail: "Details statement — employee/employer breakdown shown." };
  } else {
    statementType = {
      status: "fail",
      detail: "Wrong statement type — this shows totals only. Banks need the DETAILS statement with the employee/employer breakdown; ask the client for the correct one.",
    };
  }

  // EPF: payslip month M deductions should appear on statement month M+1, figure by figure.
  // A 2-year statement has the same month number twice (Feb 25 and Feb 26) —
  // payslips carry no year, so tally against the most recent year's row.
  const contributionRows = documents.filter(isEpfStatement).flatMap((d) => d.ai_extracted_data?.epf_contributions ?? []);
  const statementByMonth = new Map<string, EpfContributionRow>();
  for (const row of contributionRows) {
    const key = String(Number(row.month));
    const existing = statementByMonth.get(key);
    if (!existing || Number(row.year) > Number(existing.year)) {
      statementByMonth.set(key, row);
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
    const payslipTotal = employee != null && employer != null ? employee + employer : null;
    const row = statementByMonth.get(expectedStatementMonth) ?? null;

    if (employee == null && employer == null) {
      months.push({
        payslipMonth,
        payslipFile: doc.original_file_name,
        expectedStatementMonth,
        checks: [],
        status: "warn",
        detail: "No EPF figures visible on this payslip.",
      });
      continue;
    }

    if (!row) {
      months.push({
        payslipMonth,
        payslipFile: doc.original_file_name,
        expectedStatementMonth,
        checks: [],
        status: contributionRows.length === 0 ? "warn" : "fail",
        detail:
          contributionRows.length === 0
            ? "No EPF statement contributions extracted yet."
            : `No contribution row for month ${expectedStatementMonth} on the EPF statement.`,
      });
      continue;
    }

    // The statement's total may be printed, or derivable from its own split.
    const statementTotal = row.total_amount ?? (row.employee_amount != null && row.employer_amount != null ? row.employee_amount + row.employer_amount : null);

    const checks = [
      compareFigure("employee", employee, row.employee_amount),
      compareFigure("employer", employer, row.employer_amount),
      compareFigure("total", payslipTotal, statementTotal),
    ].filter((c): c is EpfComponentCheck => c !== null);

    months.push({
      payslipMonth,
      payslipFile: doc.original_file_name,
      expectedStatementMonth,
      checks,
      status: checks.length === 0 ? "warn" : worst(checks.map((c) => c.status)),
      detail: checks.length === 0 ? "Statement row has no figures comparable to this payslip — verify manually." : null,
    });
  }

  months.sort((a, b) => Number(a.payslipMonth) - Number(b.payslipMonth));

  let epfStatus: TallyStatus;
  let epfDetail: string | null = null;
  if (months.length === 0) {
    epfStatus = statementType.status === "fail" ? "fail" : "warn";
    epfDetail = "No payslips with a readable month to tally against the EPF statement.";
  } else {
    epfStatus = worst([statementType.status, ...months.map((m) => m.status)]);
  }

  return { ic, epf: { status: epfStatus, statementType, months, detail: epfDetail } };
}
