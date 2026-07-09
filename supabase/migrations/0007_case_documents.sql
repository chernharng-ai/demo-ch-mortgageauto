-- Bulk document upload: every file dropped onto a case lands here first,
-- independent of which checklist item it ends up matching. This lets the
-- app classify N files from one drop, download them all as a zip, and keep
-- a record of anything the AI couldn't confidently match to a checklist item.

create table if not exists case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  user_id uuid,
  file_path text not null,
  file_name text not null,
  original_file_name text not null,
  mime_type text,
  matched_doc_name text,
  ai_extracted_data jsonb,
  ai_extraction_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists case_documents_case_id_idx on case_documents (case_id);

alter table case_documents enable row level security;

-- Matches the app's current fully-open state (see 0005_temporary_reopen.sql).
drop policy if exists "case_documents_v1_all" on case_documents;
create policy "case_documents_v1_all" on case_documents for all using (true) with check (true);
