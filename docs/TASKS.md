# Tasks & Sprints

## Sprint 1 — Database + Core Engine (v1 functional milestone)
**Goal:** DB schema live, bank calculation engine working end-to-end, viewable without login.
- [ ] Run migration SQL: create all tables, seed 3 banks + 2 demo cases
- [ ] Build Case list page (dashboard) — shows all cases, status, doc completeness %
- [ ] Build New Case form — creates `cases` + `clients` row, auto-generates document checklist
- [ ] Build Case Detail page — shows client info, document checklist (tick/update status), income entries
- [ ] Build Income Entry form — add/edit income lines for a case
- [ ] Implement `run_income_calculation` server action (coded rules from `banks.calc_params`)
- [ ] Implement `run_loan_eligibility` server action
- [ ] Display eligibility results per bank on Case Detail page (sorted by max loan amount)
- [ ] All five UI states handled: loading spinner, empty state copy, partial data, error banner, ready
- [ ] Seed data renders correctly on first load (no login required)

**Definition of Done:** A team member can open the app, create a new case, enter income details, tick documents, click "Run Calculation", and see max loan eligibility for all 3 seeded banks — persisted to DB, visible to any team member on refresh.

---

## Sprint 2 — Polish + Bank Management
**Goal:** Team can manage banks and calculation parameters; case workflow is complete.
- [ ] Bank admin page — view/edit `calc_params` and `doc_requirements` per bank
- [ ] Case status workflow (draft → in-review → approved/rejected) with confirmation dialog
- [ ] Document checklist completeness badge on dashboard
- [ ] Case notes / comments field
- [ ] Audit log table (`audit_logs`) — log all calc runs and status changes
- [ ] Error handling: show validation errors inline on all forms
- [ ] Calculation method snapshot stored with each result (for traceability)

**Definition of Done:** Team lead can update a bank's DSR limit, re-run calculation on an existing case, and see the new result with the old result preserved in audit log.

---

## Sprint 3 — Lock It Down (Auth + Per-User Isolation)
**Goal:** Only authenticated team members can create/edit; data isolated by owner.
- [ ] Enable Supabase Auth (email/password)
- [ ] Login + signup pages; redirect unauthenticated users
- [ ] Replace open RLS policies with `auth.uid() = user_id` write policies
- [ ] Assign `user_id` on all new rows
- [ ] Role field on users: `member` / `reviewer` / `admin`
- [ ] Admin-only: bank parameter editing, audit log viewing
- [ ] Test: anonymous visitor can VIEW dashboard (read) but cannot create/edit

**Definition of Done:** An unauthenticated browser can view the case dashboard but cannot submit any form. A logged-in member can create cases scoped to their account. An admin can edit bank params.

---

## Sprint 4 — Intelligence Assists (Later)
**Goal:** Reduce data entry errors with smart suggestions.
- [ ] AI income type classification suggestion (from payslip description text)
- [ ] Anomaly flag: flag if any income entry is >2× the client's prior case average
- [ ] Draft case summary text (eligibility narrative) — shown as draft, officer confirms
- [ ] All AI fields stored with source + confidence + review_status

**Definition of Done:** AI suggestion appears on income entry form; officer can accept or override; review_status updates accordingly.

---

## Gantt (Sprint → Feature)
```
Sprint 1: DB schema, case CRUD, income entry, calculation engine, eligibility output, dashboard
Sprint 2: Bank mgmt, status workflow, audit logs, polish
Sprint 3: Auth, RLS lock-down, roles
Sprint 4: AI assists, anomaly detection, summary drafts
```
