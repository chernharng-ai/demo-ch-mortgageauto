-- Actual nett amount for an income line, when derivable from documents —
-- for basic salary this is the latest payslip's basic MINUS the real
-- deductions printed on it (EPF employee + SOCSO + EIS + PCB), per the
-- officer's rule. Gross-basis banks keep using gross_amount; nett-basis
-- DSR brackets and the NDI check use nett_amount when present (falling
-- back to the PCB formula estimate when not).

alter table income_entries
  add column if not exists nett_amount numeric;
