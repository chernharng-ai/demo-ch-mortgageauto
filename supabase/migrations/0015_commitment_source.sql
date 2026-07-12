-- Commitments can now be auto-derived from the client's credit report
-- (CTOS/Experian CCRIS section). Track where each row came from so the
-- autopilot can replace its own rows on re-derivation without ever
-- touching the officer's manually entered ones.

alter table case_commitments
  add column if not exists source text not null default 'manual' check (source in ('manual', 'credit_report'));
