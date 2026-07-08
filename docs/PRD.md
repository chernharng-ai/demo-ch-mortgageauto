# PRD — Mortgage Case Review System

## Problem
Mortgage officers manually recalculate client income and loan eligibility for each bank using different methods — prone to errors, inconsistent across team members, and painful for new joiners with no institutional knowledge.

## Target Users
Mortgage department team members (processors, reviewers, team leads). Multi-user, shared data, daily operational use.

## Core Objects
- **Case** — one client mortgage application
- **Client** — borrower profile + income details
- **Document Checklist** — per-case list of required docs with received/missing status
- **Income Calculation** — bank-specific income computation (each bank has its own method)
- **Loan Eligibility** — computed max loan amount per bank per case
- **Bank** — bank name + calculation rules/parameters

## MVP Must-Haves
- [ ] Create a Case linked to a Client
- [ ] Tally client documents (mark each as received / missing / pending)
- [ ] Enter income details; system calculates eligible income per bank's method
- [ ] System computes max loan eligibility for each configured bank
- [ ] Case review dashboard showing all open cases and their status
- [ ] Results are shareable / visible to all team members without login (demo-first)
- [ ] New case creation and editing persists to database

## Non-Goals (v1)
- Client portal / external-facing views
- Online mortgage application intake
- Payment processing or fee collection
- Complex audit trail (added later)
- Mobile-native app

## Success Criteria
A team member opens a new Case, fills in the client's income details, ticks off received documents, and immediately sees the calculated eligible income and max loan amount for all 3+ configured banks — no manual formula needed, no Excel, result matches the bank's official method.
