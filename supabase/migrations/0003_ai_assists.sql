-- Sprint 4 — Intelligence Assists. Adds the AI-suggestion fields from
-- docs/DATA_MODEL.md to income_entries, plus a draft summary on cases.
-- Suggestions are rule-based heuristics (see lib/mortgage/assist.ts), not
-- calls to a third-party AI API — docs/SECURITY.md requires an explicit
-- data-handling review before client data leaves this system, which hasn't
-- happened, so no external AI call is made here.

alter table income_entries
  add column if not exists ai_suggested_type text,
  add column if not exists ai_suggested_type_source text,
  add column if not exists ai_suggested_type_confidence numeric,
  add column if not exists ai_suggested_type_review_status text not null default 'unreviewed';

alter table cases
  add column if not exists ai_summary text,
  add column if not exists ai_summary_status text not null default 'none';

-- income_entries had insert/delete auth policies from 0002 but no update
-- policy — needed now so officers can accept/override a suggestion after
-- the entry is created.
drop policy if exists "income_entries_update_auth" on income_entries;
create policy "income_entries_update_auth" on income_entries for update
  using (auth.uid() is not null) with check (auth.uid() is not null);
