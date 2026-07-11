-- Whether the client earns variable income (OT / incentive / commission) —
-- per the officer's checklist rule, this decides how many months of income
-- documents banks expect: 3 months for fixed salary, 6 for variable. Drives
-- the pre-seeded pending month chips (1⚠️ 2⚠️ …) on payslip / bank
-- statement checklist items so missing months are visible at a glance.

alter table cases
  add column if not exists has_variable_income boolean not null default false;
