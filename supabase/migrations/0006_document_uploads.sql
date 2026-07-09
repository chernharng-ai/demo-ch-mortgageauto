-- Client document uploads: storage bucket + AI extraction fields.
-- Officers upload a payslip/bank statement/etc. against a checklist item; the
-- app renames the file, stores it, and asks Claude's vision API to extract
-- income figures as a *suggestion* the officer must confirm before it's
-- added as an income entry (docs/AGENTIC_LAYER.md medium-risk pattern).

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- Matches the app's current fully-open state (see 0005_temporary_reopen.sql).
drop policy if exists "client_documents_v1_all" on storage.objects;
create policy "client_documents_v1_all" on storage.objects for all
  using (bucket_id = 'client-documents')
  with check (bucket_id = 'client-documents');

alter table document_items
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists ai_extracted_data jsonb,
  add column if not exists ai_extraction_status text not null default 'none';
