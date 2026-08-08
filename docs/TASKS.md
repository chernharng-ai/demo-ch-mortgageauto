# Tasks & Sprints

## Sprint 1 — Core Tally Engine (v1 functional milestone)
**Goal:** Officer can paste raw client info, tally against template, see results — end to end, no login.
- [ ] Create Supabase tables (templates, template_fields, submissions, tally_entries, audit_logs) + RLS permissive policies + seed data
- [ ] Seed one active template with ~15 mortgage fields (applicant name, NRIC, DOB, marital status, monthly income, employer, employment duration, property address, property type, purchase price, loan amount, loan tenure, contact number, email, EPF balance)
- [ ] Tally screen: paste raw text, agent name, source format → save submission
- [ ] Rule-based extraction engine: keyword/regex match raw text to each template field → create tally entries with value + confidence + review_status
- [ ] Results table: each field shows extracted value (green), uncertain (amber), MISSING (red)
- [ ] Completeness score calculation + display
- [ ] Audit log on tally run
**Definition of Done:** Paste a raw WhatsApp-style client message, system fills ≥10 of 15 fields and clearly flags missing ones, completeness score displays. Works in preview without login.

## Sprint 2 — Review, Edit & Dashboard
**Goal:** Officer can review/edit tally entries; dashboard shows all submissions.
- [ ] Edit/override any tally entry value (inline edit → saves to DB, logs audit)
- [ ] Manually add value for a MISSING field → review_status changes to confirmed
- [ ] Submission status workflow: pending → reviewed → finalized
- [ ] Dashboard: all submissions with client name, agent, status, completeness score, missing count. Sort by missing count desc. Filter by status.
- [ ] Export view: printable filled-template (all fields with values, missing marked)
- [ ] Empty/loading/error states on all screens
**Definition of Done:** Officer edits 2 tally values, adds 1 missing field, marks submission reviewed, sees it on dashboard with updated 93% score, exports printable view.

## Sprint 3 — Smart Extraction & Ranking
**Goal:** AI extraction for unstructured prose; priority ranking on dashboard.
- [ ] AI extraction: LLM call to parse free-text into structured fields for entries the rule engine missed (source = "ai-extract", confidence from model)
- [ ] Dashboard ranking by missing required count → recency
- [ ] Suggest missing value from context (medium-risk, one-click approve)
- [ ] Override pattern tracking (store corrections for future improvement)
**Definition of Done:** A fully unstructured paragraph (no labels) extracts ≥8 of 15 fields via AI, suggestions appear for 2 more, officer approves one-click. Dashboard ranks by urgency.

## Sprint 4 — Lock Down
**Goal:** Auth, roles, per-user data isolation.
- [ ] Supabase auth (login/signup) — officer, reviewer, team lead roles
- [ ] Replace permissive RLS with `auth.uid() = user_id` owner-scoped policies
- [ ] Team lead-only guard on template management
- [ ] All previous screens gated behind login
- [ ] Test: user A cannot see user B's submissions
**Definition of Done:** Two logged-in users see only their own submissions. Team lead can edit template; officer cannot. Unauthenticated visitor redirected to login.

## Gantt
```
Sprint 1 [Core Tally]    ████████  ← v1 functional
Sprint 2 [Review+Dash]    ████████
Sprint 3 [AI+Ranking]     ████████
Sprint 4 [Lock Down]      ████████
```
Build Sprints 1–2 in the first pass (delivers full success scenario). Sprint 3 adds intelligence. Sprint 4 secures.