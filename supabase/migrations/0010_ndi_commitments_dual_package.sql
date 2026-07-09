-- Real DSR+NDI eligibility engine: existing commitments must be subtracted
-- before affordability is computed, NDI (minimum disposable income after
-- commitments + new instalment) is a second, independent ceiling banks
-- enforce alongside DSR, and each bank is evaluated at both a standard 90%
-- margin package and (where offered) a 100%/SJKP package with its own DSR
-- tiers, NDI floor, and income/SPA caps. See lib/mortgage/calc.ts.

alter table cases
  add column if not exists applicant_type text not null default 'single' check (applicant_type in ('single', 'joint')),
  add column if not exists property_location text not null default 'urban' check (property_location in ('urban', 'non_urban')),
  add column if not exists property_type text not null default 'completed' check (property_type in ('completed', 'under_construction'));

create table if not exists case_commitments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  user_id uuid,
  description text not null,
  monthly_amount numeric not null,
  created_at timestamptz not null default now()
);

alter table case_commitments enable row level security;
drop policy if exists "case_commitments_v1_all" on case_commitments;
create policy "case_commitments_v1_all" on case_commitments for all using (true) with check (true);

-- A case+bank now has up to two rows: one per financing package.
alter table loan_eligibilities
  add column if not exists package text not null default 'standard_90' check (package in ('standard_90', 'sjkp_100')),
  add column if not exists ndi_after numeric,
  add column if not exists capped_by text;

drop index if exists loan_eligibilities_case_bank_package_idx;
create unique index loan_eligibilities_case_bank_package_idx on loan_eligibilities (case_id, bank_id, package);
