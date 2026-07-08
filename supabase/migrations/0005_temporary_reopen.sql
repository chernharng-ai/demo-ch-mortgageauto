-- TEMPORARY: reopen write access without requiring auth, reverting the
-- Sprint 3 (0002/0003) RLS lockdown back to permissive policies. Schema,
-- profiles/roles, and the auth trigger are left intact — only the write
-- policies change — so the lockdown can be restored later by re-applying
-- the policy statements from 0002_lockdown.sql and 0003_ai_assists.sql.
--
-- Also fixes a real bug found while doing this: 0002 dropped
-- "document_items_v1_write" but only replaced it with an UPDATE policy,
-- leaving document_items with NO insert policy at all — new cases created
-- by a signed-in user since Sprint 3 would have silently failed to
-- generate their document checklist (generateDocumentChecklist's insert
-- was silently blocked by RLS). This migration restores full CRUD there.

drop policy if exists "banks_insert_admin" on banks;
drop policy if exists "banks_update_admin" on banks;
drop policy if exists "banks_delete_admin" on banks;
create policy "banks_v1_write" on banks for all using (true) with check (true);

drop policy if exists "clients_insert_auth" on clients;
drop policy if exists "clients_update_owner_or_privileged" on clients;
drop policy if exists "clients_delete_owner_or_privileged" on clients;
create policy "clients_v1_write" on clients for all using (true) with check (true);

drop policy if exists "cases_insert_auth" on cases;
drop policy if exists "cases_update_owner_or_privileged" on cases;
drop policy if exists "cases_delete_owner_or_privileged" on cases;
create policy "cases_v1_write" on cases for all using (true) with check (true);

drop policy if exists "income_entries_insert_auth" on income_entries;
drop policy if exists "income_entries_delete_auth" on income_entries;
drop policy if exists "income_entries_update_auth" on income_entries;
create policy "income_entries_v1_write" on income_entries for all using (true) with check (true);

drop policy if exists "document_items_update_auth" on document_items;
create policy "document_items_v1_write" on document_items for all using (true) with check (true);

drop policy if exists "income_calculations_insert_auth" on income_calculations;
drop policy if exists "income_calculations_delete_auth" on income_calculations;
create policy "income_calculations_v1_write" on income_calculations for all using (true) with check (true);

drop policy if exists "loan_eligibilities_insert_auth" on loan_eligibilities;
drop policy if exists "loan_eligibilities_delete_auth" on loan_eligibilities;
create policy "loan_eligibilities_v1_write" on loan_eligibilities for all using (true) with check (true);

drop policy if exists "audit_logs_select_scoped" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_insert_auth" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for insert with check (true);
