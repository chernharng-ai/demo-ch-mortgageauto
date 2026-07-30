-- Why AI reading failed for a document, shown to the officer so a locked
-- or corrupted PDF is a flagged problem (e.g. "password-protected — ask the
-- client for the password"), never a silent one.
alter table case_documents add column if not exists ai_extraction_error text;
