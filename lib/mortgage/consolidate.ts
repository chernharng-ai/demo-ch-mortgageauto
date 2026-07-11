// Turns a stack of monthly payslip extractions into ONE clean income
// proposal — instead of the officer clicking "Add" on near-identical lines
// from every payslip (and accidentally counting the same basic salary five
// times), this consolidates the way banks actually take income:
//
//   - basic salary: the value consistent across the payslips, counted once
//   - fixed allowances: amounts identical on every payslip, counted once
//   - everything that varies (commission, OT, incentive, non-fixed
//     allowances): summed per month, then averaged across the months —
//     the "average of N months" convention; each bank's own variable-income
//     multiplier is applied later by the calc engine's income_rules.

import type { DocumentExtraction } from "./extraction";
import type { IncomeType } from "./types";

export interface ConsolidatedIncomeLine {
  income_type: IncomeType;
  gross_amount: number;
  frequency: "monthly";
  label: string;
}

export interface ConsolidatedIncomeProposal {
  monthsUsed: string[];
  lines: ConsolidatedIncomeLine[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The most frequent value in a list (ties broken by the larger value, conservative for basic salary consistency checks). */
function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export function consolidatePayslipIncome(extractions: DocumentExtraction[]): ConsolidatedIncomeProposal {
  // One extraction per payslip month — if two files cover the same month, the later one in the list wins.
  const byMonth = new Map<string, DocumentExtraction>();
  for (const x of extractions) {
    if (x.document_type === "payslip" && x.period_label) {
      byMonth.set(String(Number(x.period_label)), x);
    }
  }
  const months = [...byMonth.keys()].sort((a, b) => Number(a) - Number(b));
  if (months.length === 0) return { monthsUsed: [], lines: [] };

  const slips = months.map((m) => byMonth.get(m)!);
  const lines: ConsolidatedIncomeLine[] = [];

  // Basic salary: the consistent value across the slips, counted once.
  const basics = slips.map((s) => s.detected_income.filter((l) => l.income_type === "basic").reduce((sum, l) => sum + l.gross_amount, 0)).filter((v) => v > 0);
  if (basics.length > 0) {
    const basic = mode(basics);
    const consistent = basics.every((v) => v === basic);
    lines.push({
      income_type: "basic",
      gross_amount: round2(basic),
      frequency: "monthly",
      label: consistent ? `Basic salary (same across ${basics.length} payslips)` : `Basic salary (most common of ${basics.length} payslips — amounts vary, double-check)`,
    });
  }

  // Fixed allowances: an amount that appears on EVERY payslip is fixed; anything else is variable.
  const allowanceAmountsPerSlip = slips.map((s) => s.detected_income.filter((l) => l.income_type === "allowance").map((l) => l.gross_amount));
  const fixedAllowances = (allowanceAmountsPerSlip[0] ?? []).filter((amount) => allowanceAmountsPerSlip.every((amounts) => amounts.includes(amount)));
  for (const amount of fixedAllowances) {
    lines.push({
      income_type: "allowance",
      gross_amount: round2(amount),
      frequency: "monthly",
      label: `Fixed allowance (same on all ${months.length} payslips)`,
    });
  }

  // Variable income: per-month sum of commission + other + non-fixed allowances, averaged across the months.
  const variablePerMonth = slips.map((s) =>
    s.detected_income.reduce((sum, l) => {
      if (l.income_type === "commission" || l.income_type === "other") return sum + l.gross_amount;
      if (l.income_type === "allowance" && !fixedAllowances.includes(l.gross_amount)) return sum + l.gross_amount;
      return sum;
    }, 0),
  );
  const variableAverage = variablePerMonth.reduce((a, b) => a + b, 0) / months.length;
  if (variableAverage > 0) {
    lines.push({
      income_type: "commission",
      gross_amount: round2(variableAverage),
      frequency: "monthly",
      label: `Variable income (OT/commission/incentive) — average of ${months.length} months`,
    });
  }

  return { monthsUsed: months, lines };
}
