-- Structured case review note: the officer's real workflow is a specific,
-- copy-pasteable note sent to their loan agent. Business-owner and
-- salary-earner clients use different layouts (see lib/mortgage/reviewNote.ts).
-- Most fields here are officer judgment calls (CCRIS reads, trade reference
-- checks, risk assessment) that live outside this app's data model — they're
-- captured as plain text/number fields rather than modeled structurally.

alter table cases
  add column if not exists review_client_type text,
  add column if not exists review_doc_link text,
  add column if not exists review_age int,
  add column if not exists review_residential_address text,
  add column if not exists review_working_address text,
  add column if not exists review_attention text,
  add column if not exists review_gross_income text,
  add column if not exists review_nett_income text,
  add column if not exists review_max_allowed_commitment numeric,
  add column if not exists review_commitment_breakdown text,
  add column if not exists review_project text,
  add column if not exists review_bank_eligible_notes text,
  add column if not exists review_risk_level text,
  add column if not exists review_approval_chance int,
  add column if not exists review_agent_notes text;
