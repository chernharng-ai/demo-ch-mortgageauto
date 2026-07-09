-- Per-checklist-item sub-tracking (e.g. "Payslip" broken into months 4/5/6,
-- "Personal Income Tax" broken into Borang B/Be, E-Filing, Tax Receipt).
-- Sub-items key on (case_id, doc_name) rather than a specific document_items
-- row, since doc_name is shared across every bank's checklist row for that
-- case (see DocumentChecklist.tsx's doc-name grouping).

create table if not exists document_sub_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  doc_name text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'received', 'missing')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists document_sub_items_case_doc_idx on document_sub_items (case_id, doc_name);

alter table document_sub_items enable row level security;
drop policy if exists "document_sub_items_v1_all" on document_sub_items;
create policy "document_sub_items_v1_all" on document_sub_items for all using (true) with check (true);
