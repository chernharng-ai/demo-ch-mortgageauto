# Mortgage Loan Client Info Tally System

## Problem
Property agents send client info in many ad-hoc formats (email, WhatsApp, PDF text, agent's own form). Mortgage loan officers must manually transcribe and cross-check each against a standard application template — fields get missed, forms are incomplete, rework piles up.

## Target User
Mortgage loan department: officers who tally client info, reviewers who verify completeness, team lead who oversees throughput.

## Core Objects
- **Standard Template** — canonical list of fields required for a mortgage loan application (applicant name, NRIC, income, property details, loan amount, etc.)
- **Submission** — raw client info pasted by an officer, tagged with agent name and source format
- **Tally Entry** — per-field extraction result: value found, confidence, review status (present / missing / uncertain)
- **Completeness Score** — % of required template fields filled with at-least-medium confidence

## MVP (v1) — Checklist
- [ ] One active standard template with ~15 required fields pre-loaded
- [ ] Paste raw client info → system tallies against template fields (rule-based keyword matching)
- [ ] Results table: each field shows extracted value, confidence, or MISSING
- [ ] Officer can edit/override any tally entry value
- [ ] Completeness score recalculates on save
- [ ] Dashboard lists all submissions with status + score, sortable/filterable
- [ ] Export tally as a clean filled-template view (printable)
- [ ] Works without login (demo-first with seed data)

## Non-Goals (v1)
- No AI extraction (rule-based matching only in v1)
- No user accounts / login (added in lock-down sprint)
- No direct integration with bank systems or e-forms
- No document upload / OCR (paste text only)

## Success Criteria
An officer pastes a messy WhatsApp message from an agent into the tally screen, the system matches 12 of 15 template fields and flags 3 missing (income proof, employer name, EPF balance), the officer fills 2 from memory and marks 1 as outstanding. Completeness reads 93%. The submission appears on the dashboard as "reviewed". This entire flow works in the preview deployment without logging in.