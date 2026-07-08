create table if not exists banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  calc_params jsonb not null default '{}',
  doc_requirements jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table banks enable row level security;
drop policy if exists "banks_v1_read" on banks;
create policy "banks_v1_read" on banks for select using (true);
drop policy if exists "banks_v1_write" on banks;
create policy "banks_v1_write" on banks for all using (true) with check (true);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  full_name text not null,
  ic_number text,
  employment_type text not null default 'employed',
  employer_name text,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
drop policy if exists "clients_v1_read" on clients;
create policy "clients_v1_read" on clients for select using (true);
drop policy if exists "clients_v1_write" on clients;
create policy "clients_v1_write" on clients for all using (true) with check (true);

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id uuid references clients(id),
  status text not null default 'draft',
  property_value numeric,
  loan_tenure_years int not null default 30,
  notes text,
  created_at timestamptz not null default now()
);

alter table cases enable row level security;
drop policy if exists "cases_v1_read" on cases;
create policy "cases_v1_read" on cases for select using (true);
drop policy if exists "cases_v1_write" on cases;
create policy "cases_v1_write" on cases for all using (true) with check (true);

create table if not exists income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  case_id uuid references cases(id),
  income_type text not null,
  gross_amount numeric not null,
  frequency text not null default 'monthly',
  supporting_doc text,
  created_at timestamptz not null default now()
);

alter table income_entries enable row level security;
drop policy if exists "income_entries_v1_read" on income_entries;
create policy "income_entries_v1_read" on income_entries for select using (true);
drop policy if exists "income_entries_v1_write" on income_entries;
create policy "income_entries_v1_write" on income_entries for all using (true) with check (true);

create table if not exists income_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  case_id uuid references cases(id),
  bank_id uuid references banks(id),
  eligible_income numeric not null,
  method_snapshot jsonb not null default '{}',
  calculated_by text,
  created_at timestamptz not null default now()
);

alter table income_calculations enable row level security;
drop policy if exists "income_calculations_v1_read" on income_calculations;
create policy "income_calculations_v1_read" on income_calculations for select using (true);
drop policy if exists "income_calculations_v1_write" on income_calculations;
create policy "income_calculations_v1_write" on income_calculations for all using (true) with check (true);

create table if not exists loan_eligibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  case_id uuid references cases(id),
  bank_id uuid references banks(id),
  max_loan_amount numeric not null,
  monthly_instalment numeric not null,
  dsr_ratio numeric not null,
  eligibility_status text not null default 'eligible',
  created_at timestamptz not null default now()
);

alter table loan_eligibilities enable row level security;
drop policy if exists "loan_eligibilities_v1_read" on loan_eligibilities;
create policy "loan_eligibilities_v1_read" on loan_eligibilities for select using (true);
drop policy if exists "loan_eligibilities_v1_write" on loan_eligibilities;
create policy "loan_eligibilities_v1_write" on loan_eligibilities for all using (true) with check (true);

create table if not exists document_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  case_id uuid references cases(id),
  bank_id uuid references banks(id),
  doc_name text not null,
  status text not null default 'pending',
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table document_items enable row level security;
drop policy if exists "document_items_v1_read" on document_items;
create policy "document_items_v1_read" on document_items for select using (true);
drop policy if exists "document_items_v1_write" on document_items;
create policy "document_items_v1_write" on document_items for all using (true) with check (true);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  case_id uuid,
  action text not null,
  performed_by text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into banks (id, name, calc_params, doc_requirements) values
(
  '11111111-1111-1111-1111-111111111111',
  'Maybank',
  '{"dsr_limit": 0.70, "stress_rate": 0.065, "tenure_max_years": 35, "income_rules": {"employed": {"basic": 1.0, "allowance": 0.5, "commission": 0.5, "rental": 0.8}, "self_employed": {"net_profit": 0.7}, "commission": {"basic": 1.0, "commission": 0.5}}}',
  '["3 months payslip", "6 months bank statement", "EA Form / Income Tax", "IC (front & back)", "Offer Letter", "EPF Statement"]'
),
(
  '22222222-2222-2222-2222-222222222222',
  'CIMB Bank',
  '{"dsr_limit": 0.65, "stress_rate": 0.060, "tenure_max_years": 35, "income_rules": {"employed": {"basic": 1.0, "allowance": 0.5, "commission": 0.5, "rental": 0.7}, "self_employed": {"net_profit": 0.7}, "commission": {"basic": 1.0, "commission": 0.5}}}',
  '["3 months payslip", "6 months bank statement", "Income Tax BE Form", "IC (front & back)", "EPF Statement"]'
),
(
  '33333333-3333-3333-3333-333333333333',
  'RHB Bank',
  '{"dsr_limit": 0.70, "stress_rate": 0.063, "tenure_max_years": 35, "income_rules": {"employed": {"basic": 1.0, "allowance": 0.6, "commission": 0.5, "rental": 0.8}, "self_employed": {"net_profit": 0.75}, "commission": {"basic": 1.0, "commission": 0.5}}}',
  '["3 months payslip", "6 months bank statement", "Income Tax BE Form", "IC (front & back)", "Offer Letter"]'
)
on conflict (id) do nothing;

insert into clients (id, full_name, ic_number, employment_type, employer_name) values
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Ahmad bin Ali',
  '850101-14-5678',
  'employed',
  'Petronas'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Siti Rahayu binti Hassan',
  '900215-10-1234',
  'employed',
  'Maybank Berhad'
)
on conflict (id) do nothing;

insert into cases (id, client_id, status, property_value, loan_tenure_years, notes) values
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'in-review',
  550000,
  30,
  'First property purchase. Client has stable income with 5 years tenure at current employer.'
),
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'draft',
  420000,
  35,
  'Second property. Existing home loan commitment RM 1,200/month.'
)
on conflict (id) do nothing;

insert into income_entries (case_id, income_type, gross_amount, frequency, supporting_doc) values
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'basic', 7500, 'monthly', '3 months payslip'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'allowance', 1500, 'monthly', 'Offer letter allowance clause'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'basic', 5800, 'monthly', '3 months payslip'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'allowance', 800, 'monthly', 'Offer letter'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'rental', 1200, 'monthly', 'Tenancy agreement')
on conflict do nothing;

insert into document_items (case_id, bank_id, doc_name, status, received_at) values
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '3 months payslip', 'received', now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '6 months bank statement', 'received', now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'EA Form / Income Tax', 'pending', null),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'IC (front & back)', 'received', now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Offer Letter', 'missing', null),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '3 months payslip', 'received', now()),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '6 months bank statement', 'pending', null),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'IC (front & back)', 'received', now())
on conflict do nothing;

insert into income_calculations (case_id, bank_id, eligible_income, method_snapshot, calculated_by) values
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  8250,
  '{"bank": "Maybank", "dsr_limit": 0.70, "rules_applied": {"basic": 1.0, "allowance": 0.5}}',
  'Demo Officer'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '22222222-2222-2222-2222-222222222222',
  8250,
  '{"bank": "CIMB Bank", "dsr_limit": 0.65, "rules_applied": {"basic": 1.0, "allowance": 0.5}}',
  'Demo Officer'
)
on conflict do nothing;

insert into loan_eligibilities (case_id, bank_id, max_loan_amount, monthly_instalment, dsr_ratio, eligibility_status) values
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  520000,
  2838,
  0.344,
  'eligible'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '22222222-2222-2222-2222-222222222222',
  480000,
  2648,
  0.321,
  'eligible'
)
on conflict do nothing;