-- Case-type flags driving the document checklist template (see
-- lib/mortgage/checklistTemplate.ts): financing scheme (bank loan vs
-- LPPSA — LPPSA still gets the full bank eligibility comparison per the
-- officer, it's just a different document set), plus overseas/rental/site
-- visit flags that each add their own extra documents. property_type
-- (completed/under_construction, added in 0010) doubles as the
-- subsales-vs-new-project signal for the checklist template.

alter table cases
  add column if not exists financing_scheme text not null default 'bank_loan' check (financing_scheme in ('bank_loan', 'lppsa')),
  add column if not exists application_date date not null default current_date,
  add column if not exists is_overseas boolean not null default false,
  add column if not exists has_rental_income boolean not null default false,
  add column if not exists needs_site_visit boolean not null default false;
