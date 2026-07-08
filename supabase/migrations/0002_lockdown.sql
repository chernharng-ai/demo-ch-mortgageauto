-- Sprint 3 — Lock It Down: profiles/roles + auth-gated write policies.
-- Reads stay open (dashboard remains viewable without login); writes now
-- require a signed-in user, per docs/TASKS.md Sprint 3 and docs/SECURITY.md.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member', -- member | reviewer | admin
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated" on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-provision a profile row whenever someone signs up. The account holder's
-- own email is seeded as admin so there's always at least one admin to manage
-- banks and view the full audit log; everyone else starts as a regular member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'main@millenniumgroups.com' then 'admin' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used inside RLS policies below. security definer + fixed search_path
-- so it can read profiles regardless of the caller's own row-level access.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- banks: shared reference config — admin only write. Reads stay open.
drop policy if exists "banks_v1_write" on banks;
create policy "banks_insert_admin" on banks for insert with check (public.current_user_role() = 'admin');
create policy "banks_update_admin" on banks for update using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "banks_delete_admin" on banks for delete using (public.current_user_role() = 'admin');

-- clients / cases: any signed-in member can create (and owns what they create);
-- editing/deleting is restricted to the owner or a reviewer/admin.
drop policy if exists "clients_v1_write" on clients;
create policy "clients_insert_auth" on clients for insert with check (auth.uid() is not null);
create policy "clients_update_owner_or_privileged" on clients for update
  using (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'))
  with check (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'));
create policy "clients_delete_owner_or_privileged" on clients for delete
  using (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'));

drop policy if exists "cases_v1_write" on cases;
create policy "cases_insert_auth" on cases for insert with check (auth.uid() is not null);
create policy "cases_update_owner_or_privileged" on cases for update
  using (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'))
  with check (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'));
create policy "cases_delete_owner_or_privileged" on cases for delete
  using (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'));

-- income_entries / document_items: collaborative case work — any signed-in
-- team member can add income lines or tick documents on any shared case.
drop policy if exists "income_entries_v1_write" on income_entries;
create policy "income_entries_insert_auth" on income_entries for insert with check (auth.uid() is not null);
create policy "income_entries_delete_auth" on income_entries for delete using (auth.uid() is not null);

drop policy if exists "document_items_v1_write" on document_items;
create policy "document_items_update_auth" on document_items for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- income_calculations / loan_eligibilities: written only by the named server
-- actions when a signed-in member runs a calculation.
drop policy if exists "income_calculations_v1_write" on income_calculations;
create policy "income_calculations_insert_auth" on income_calculations for insert with check (auth.uid() is not null);
create policy "income_calculations_delete_auth" on income_calculations for delete using (auth.uid() is not null);

drop policy if exists "loan_eligibilities_v1_write" on loan_eligibilities;
create policy "loan_eligibilities_insert_auth" on loan_eligibilities for insert with check (auth.uid() is not null);
create policy "loan_eligibilities_delete_auth" on loan_eligibilities for delete using (auth.uid() is not null);

-- audit_logs: append-only (no update/delete policy at all). Members see only
-- their own actions; admin/reviewer see everything — per docs/SECURITY.md.
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_select_scoped" on audit_logs for select
  using (auth.uid() = user_id or public.current_user_role() in ('admin', 'reviewer'));
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_insert_auth" on audit_logs for insert with check (auth.uid() is not null);
