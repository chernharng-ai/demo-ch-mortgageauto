// Standard Malaysian statutory payroll deductions — how BANKS recompute
// nett basic pay, per the officer: they do not copy the payslip's printed
// deductions, they apply the statutory formulas to the basic pay.
// Tables ground-truthed against payroll.my (SOCSO/EIS contribution tables)
// and the KWSP Third Schedule banding convention.

import { computeNettIncome } from "./pcb";

/**
 * EPF employee contribution (11%) per the KWSP Third Schedule convention:
 * wages ≤ RM5,000 are banded in RM20 steps, RM5,000–20,000 in RM100 steps,
 * with the contribution computed on the band's upper limit and rounded UP
 * to the next ringgit. Above RM20,000 it's the exact percentage, rounded up.
 */
export function epfEmployee(wage: number): number {
  if (wage <= 0) return 0;
  if (wage <= 5000) return Math.ceil(0.11 * (Math.ceil(wage / 20) * 20));
  if (wage <= 20000) return Math.ceil(0.11 * (Math.ceil(wage / 100) * 100));
  return Math.ceil(0.11 * wage);
}

/**
 * SOCSO employee share (Category 1): 0.5% of the RM100 wage band's midpoint,
 * capped at the RM6,000 ceiling (RM29.75). Matches the official table, e.g.
 * RM2,900–3,000 → 14.75, RM5,700–5,800 → 28.75, above RM6,000 → 29.75.
 */
export function socsoEmployee(wage: number): number {
  if (wage <= 0) return 0;
  if (wage > 6000) return 29.75;
  const midpoint = Math.ceil(wage / 100) * 100 - 50;
  return Math.round(0.005 * midpoint * 100) / 100;
}

/**
 * EIS/SIP employee share: 0.2% of the RM100 wage band's midpoint, capped at
 * the RM6,000 ceiling (RM11.90). E.g. RM2,900–3,000 → 5.90, above RM6,000 → 11.90.
 */
export function eisEmployee(wage: number): number {
  if (wage <= 0) return 0;
  if (wage > 6000) return 11.9;
  const midpoint = Math.ceil(wage / 100) * 100 - 50;
  return Math.round(0.002 * midpoint * 100) / 100;
}

export interface NettBasicBreakdown {
  grossBasic: number;
  epf: number;
  socso: number;
  eis: number;
  pcb: number;
  nettBasic: number;
}

/** Nett basic pay the standard-payroll way: basic − EPF − SOCSO − EIS − PCB, each from the statutory formulas (PCB per the officer's reference sheet). */
export function nettBasicPay(grossBasic: number): NettBasicBreakdown {
  const epf = epfEmployee(grossBasic);
  const socso = socsoEmployee(grossBasic);
  const eis = eisEmployee(grossBasic);
  const pcb = computeNettIncome(grossBasic).monthlyPcb;
  const nettBasic = Math.round((grossBasic - epf - socso - eis - pcb) * 100) / 100;
  return { grossBasic, epf, socso, eis, pcb, nettBasic: Math.max(0, nettBasic) };
}
