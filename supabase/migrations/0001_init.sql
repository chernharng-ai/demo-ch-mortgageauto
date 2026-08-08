create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  is_active boolean default true
);

create table if not exists template_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  template_id uuid not null references templates(id) on delete cascade,
  field_key text not null,
  field_label text not null,
  field_type text not null default 'text',
  is_required boolean default true,
  sort_order int default 0
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  template_id uuid not null references templates(id),
  client_name text,
  agent_name text,
  agent_agency text,
  raw_input text not null,
  source_format text,
  status text default 'pending',
  completeness_score numeric default 0
);

create table if not exists tally_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  submission_id uuid not null references submissions(id) on delete cascade,
  template_field_id uuid not null references template_fields(id) on delete cascade,
  extracted_value text,
  source text,
  confidence numeric,
  review_status text default 'unreviewed',
  unique(submission_id, template_field_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb
);

-- The case-review baseline (0000) also creates audit_logs, with a different
-- shape (case_id / before_value / after_value). When that table already
-- exists the create above is a no-op, so add the tally columns explicitly —
-- both modules then share one superset audit_logs table.
alter table audit_logs add column if not exists entity_type text;
alter table audit_logs add column if not exists entity_id uuid;
alter table audit_logs add column if not exists details jsonb;

alter table templates enable row level security;
alter table template_fields enable row level security;
alter table submissions enable row level security;
alter table tally_entries enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "templates_v1_read" on templates;
create policy "templates_v1_read" on templates for select using (true);
drop policy if exists "templates_v1_write" on templates;
create policy "templates_v1_write" on templates for all using (true) with check (true);

drop policy if exists "template_fields_v1_read" on template_fields;
create policy "template_fields_v1_read" on template_fields for select using (true);
drop policy if exists "template_fields_v1_write" on template_fields;
create policy "template_fields_v1_write" on template_fields for all using (true) with check (true);

drop policy if exists "submissions_v1_read" on submissions;
create policy "submissions_v1_read" on submissions for select using (true);
drop policy if exists "submissions_v1_write" on submissions;
create policy "submissions_v1_write" on submissions for all using (true) with check (true);

drop policy if exists "tally_entries_v1_read" on tally_entries;
create policy "tally_entries_v1_read" on tally_entries for select using (true);
drop policy if exists "tally_entries_v1_write" on tally_entries;
create policy "tally_entries_v1_write" on tally_entries for all using (true) with check (true);

drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into templates (id, name, description, is_active) values
  ('a1000000-0000-0000-0000-000000000001', 'Standard Mortgage Loan Application v1', 'Canonical field set for residential mortgage loan application', true)
on conflict (id) do nothing;

insert into template_fields (id, template_id, field_key, field_label, field_type, is_required, sort_order) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'applicant_name', 'Applicant Full Name', 'text', true, 1),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'nric', 'NRIC / MyKad No.', 'text', true, 2),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'date_of_birth', 'Date of Birth', 'date', true, 3),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'marital_status', 'Marital Status', 'text', true, 4),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'monthly_income', 'Monthly Gross Income (RM)', 'number', true, 5),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'employer_name', 'Employer Name', 'text', true, 6),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'employment_duration', 'Employment Duration (months)', 'number', false, 7),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'property_address', 'Property Address', 'text', true, 8),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'property_type', 'Property Type', 'text', true, 9),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'purchase_price', 'Purchase Price (RM)', 'number', true, 10),
  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', 'loan_amount', 'Loan Amount (RM)', 'number', true, 11),
  ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', 'loan_tenure', 'Loan Tenure (years)', 'number', true, 12),
  ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000001', 'contact_number', 'Contact Number', 'text', true, 13),
  ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000001', 'email', 'Email Address', 'text', true, 14),
  ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000001', 'epf_balance', 'EPF Account Balance (RM)', 'number', false, 15)
on conflict (id) do nothing;

insert into submissions (id, template_id, client_name, agent_name, agent_agency, raw_input, source_format, status, completeness_score) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Lim Wei Jian', 'Sara Tan', 'IQI Realty', 'Client: Lim Wei Jian, IC: 880214-14-5566, DOB: 14/02/1988, Married, Income RM8500, Employer: Shell Malaysia, Property: No 12 Jalan Indah 4, Taman Indah, Condominium, Price RM680000, Loan RM544000, Tenure 30 years, HP: 012-3456789, Email: limwj@gmail.com', 'whatsapp', 'reviewed', 80),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Ng Hui Ling', 'Jason Lee', 'ERA Realty', 'Name: Ng Hui Ling. NRIC 910705-08-1234. Phone 011-2233445. Buying condo at 5A Persiaran Ampang, asking RM520k. Loan 90% 25yr. Single. Buyer monthly salary RM6200.', 'email', 'pending', 53),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Arjun Kumar', 'Meera Raj', 'PropNex', 'Arjun Kumar a/k Santhosh, IC 850330-71-0099, born 30 March 1985, married, income RM12500/month, works at Petronas 4 years, house at 88 Lorong Delima, terrace, purchase RM950000, financing RM760000 30yr, mobile 019-8877665, email arjun.k@outlook.com, EPF RM210000', 'pdf-copy', 'finalized', 100)
on conflict (id) do nothing;

insert into tally_entries (id, submission_id, template_field_id, extracted_value, source, confidence, review_status) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Lim Wei Jian', 'rule-match', 0.95, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', '880214-14-5566', 'rule-match', 0.95, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', '14/02/1988', 'rule-match', 0.90, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'Married', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', '8500', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006', 'Shell Malaysia', 'rule-match', 0.80, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000008', 'No 12 Jalan Indah 4, Taman Indah', 'rule-match', 0.70, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000009', 'Condominium', 'rule-match', 0.75, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000010', '680000', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000011', '544000', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000012', '30', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000013', '012-3456789', 'rule-match', 0.90, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000014', 'limwj@gmail.com', 'rule-match', 0.90, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000015', null, 'missing', 0, 'missing'),
  ('d1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Ng Hui Ling', 'rule-match', 0.95, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '910705-08-1234', 'rule-match', 0.90, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000018', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', '6200', 'rule-match', 0.80, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000008', '5A Persiaran Ampang', 'rule-match', 0.60, 'uncertain'),
  ('d1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 'condo', 'rule-match', 0.60, 'uncertain'),
  ('d1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000010', '520000', 'rule-match', 0.80, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000011', '468000', 'rule-match', 0.70, 'uncertain'),
  ('d1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000012', '25', 'rule-match', 0.85, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000013', '011-2233445', 'rule-match', 0.90, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'Single', 'rule-match', 0.75, 'confirmed'),
  ('d1000000-0000-0000-0000-000000000026', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', null, 'missing', 0, 'missing')
on conflict (id) do nothing;

insert into audit_logs (id, action, entity_type, entity_id, details) values
  ('e1000000-0000-0000-0000-000000000001', 'tally_run', 'submission', 'c1000000-0000-0000-0000-000000000001', '{"fields_matched": 13, "fields_missing": 2, "score": 80}'),
  ('e1000000-0000-0000-0000-000000000002', 'tally_run', 'submission', 'c1000000-0000-0000-0000-000000000002', '{"fields_matched": 8, "fields_missing": 7, "score": 53}'),
  ('e1000000-0000-0000-0000-000000000003', 'submission_finalized', 'submission', 'c1000000-0000-0000-0000-000000000003', '{"score": 100, "finalized_by": "demo_officer"}')
on conflict (id) do nothing;