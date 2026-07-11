// Auto-derives the case's income from payslip extractions — no manual
// "Add" clicks. The officer's rules, verbatim:
//
//   - Basic pay: take the LATEST month's basic, then compute nett the way
//     BANKS do — the standard Malaysian payroll formulas (EPF Third
//     Schedule, SOCSO/EIS tables, PCB), NOT the deductions printed on the
//     payslip. (Gross is kept too — gross-basis banks bracket on gross.)
//   - Fixed allowances (same amount on every payslip): counted once;
//     each bank's own allowance multiplier applies in the calc engine.
//   - Variable income (OT / commission / incentive / non-fixed
//     allowances): average over the expected 3- or 6-month window
//     (6 when the client has variable income), counting back from the
//     application date. A missing month inside the window is FLAGGED —
//     some banks won't take variable income with gaps.

import type { DocumentExtraction } from "./extraction";
import type { IncomeType } from "./types";
import { expectedPeriodLabels } from "./checklistTemplate";
import { nettBasicPay } from "./payroll";

export interface ConsolidatedIncomeLine {
  income_type: IncomeType;
  gross_amount: number;
  nett_amount: number | null;
  frequency: "monthly";
  label: string;
}

export interface ConsolidatedIncomeProposal {
  monthsUsed: string[];
  lines: ConsolidatedIncomeLine[];
  flags: string[];
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthName(m: string): string {
  return MONTH_NAMES[Number(m)] ?? m;
}

export function consolidatePayslipIncome(
  extractions: DocumentExtraction[],
  applicationDate: string,
  hasVariableIncome: boolean,
): ConsolidatedIncomeProposal {
  const flags: string[] = [];

  // One extraction per payslip month — if two files cover the same month, the later one in the list wins.
  const byMonth = new Map<string, DocumentExtraction>();
  for (const x of extractions) {
    if (x.document_type === "payslip" && x.period_label) {
      byMonth.set(String(Number(x.period_label)), x);
    }
  }
  if (byMonth.size === 0) return { monthsUsed: [], lines: [], flags: [] };

  // Expected window (3 or 6 months back from the application date), in
  // chronological order — drives both "latest month" and the missing-month flags.
  const window = expectedPeriodLabels("3 months payslip", applicationDate, hasVariableIncome);
  const presentInWindow = window.filter((m) => byMonth.has(m));
  const missingInWindow = window.filter((m) => !byMonth.has(m));
  for (const m of missingInWindow) {
    flags.push(`${monthName(m)} payslip missing from the ${window.length}-month window — some banks may not take variable income with a gap.`);
  }

  // Months actually used: window months present; if the client's slips fall
  // entirely outside the window (stale documents), use whatever exists and flag it.
  const monthsUsed = presentInWindow.length > 0 ? presentInWindow : [...byMonth.keys()].sort((a, b) => Number(a) - Number(b));
  if (presentInWindow.length === 0) {
    flags.push("No payslip falls inside the expected window counting back from the application date — using the months on hand; check document freshness.");
  }

  const slips = monthsUsed.map((m) => byMonth.get(m)!);
  const latestMonth = monthsUsed[monthsUsed.length - 1];
  const latest = byMonth.get(latestMonth)!;
  const lines: ConsolidatedIncomeLine[] = [];

  // Basic pay: latest month's basic; nett computed the way banks do — the
  // standard payroll formulas (EPF Third Schedule, SOCSO/EIS tables, PCB),
  // not the deductions printed on the slip.
  const latestBasic = latest.detected_income.filter((l) => l.income_type === "basic").reduce((sum, l) => sum + l.gross_amount, 0);
  if (latestBasic > 0) {
    const breakdown = nettBasicPay(latestBasic);
    lines.push({
      income_type: "basic",
      gross_amount: round2(latestBasic),
      nett_amount: breakdown.nettBasic,
      frequency: "monthly",
      label: `Basic pay — latest month (${monthName(latestMonth)}), nett by standard payroll calc (EPF ${breakdown.epf}, SOCSO ${breakdown.socso}, EIS ${breakdown.eis}, PCB ${breakdown.pcb})`,
    });
  } else {
    flags.push(`No basic salary line found on the latest payslip (${monthName(latestMonth)}).`);
  }

  // Fixed allowances: an amount that appears on EVERY payslip used is fixed.
  const allowanceAmountsPerSlip = slips.map((s) => s.detected_income.filter((l) => l.income_type === "allowance").map((l) => l.gross_amount));
  const fixedAllowances = (allowanceAmountsPerSlip[0] ?? []).filter((amount) => allowanceAmountsPerSlip.every((amounts) => amounts.includes(amount)));
  for (const amount of fixedAllowances) {
    lines.push({
      income_type: "allowance",
      gross_amount: round2(amount),
      nett_amount: null,
      frequency: "monthly",
      label: `Fixed allowance (same on all ${monthsUsed.length} payslips) — bank multiplier applies`,
    });
  }

  // Variable income: per-month sum of commission + other + non-fixed
  // allowances, averaged over the months present in the window.
  const variablePerMonth = slips.map((s) =>
    s.detected_income.reduce((sum, l) => {
      if (l.income_type === "commission" || l.income_type === "other") return sum + l.gross_amount;
      if (l.income_type === "allowance" && !fixedAllowances.includes(l.gross_amount)) return sum + l.gross_amount;
      return sum;
    }, 0),
  );
  const variableAverage = variablePerMonth.reduce((a, b) => a + b, 0) / monthsUsed.length;
  if (variableAverage > 0) {
    lines.push({
      income_type: "commission",
      gross_amount: round2(variableAverage),
      nett_amount: null,
      frequency: "monthly",
      label: `Variable income (OT/commission/incentive) — average of ${monthsUsed.length} months — bank multiplier applies`,
    });
  }

  return { monthsUsed, lines, flags };
}
