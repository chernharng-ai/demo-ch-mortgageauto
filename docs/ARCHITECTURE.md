# Architecture

## Stack
- **Frontend:** Next.js 14 (App Router) on Vercel
- **Database + Auth:** Supabase (Postgres + RLS)
- **Styling:** Tailwind CSS + shadcn/ui

## Now vs Later
**Now:** Cases, clients, document checklist, income entry, bank calculation engine, eligibility output, shared team dashboard.
**Later:** Role-based access, per-user data isolation (RLS lock-down), AI income classification, audit logs, notification on case status change.

## Key Action Flow — "Review a Case"
1. Team member opens New Case form → enters client name, income fields, employment type.
2. Form submits → `cases` + `clients` rows written to Supabase.
3. Document checklist auto-generated from bank requirements → `document_items` rows created.
4. Member ticks documents received → `document_items.status` updated.
5. Income calculation runs server-side (Next.js Server Action) using `banks.calc_params` rules → result written to `income_calculations`.
6. Loan eligibility computed per bank (income × DSR / rate formula) → written to `loan_eligibilities`.
7. Case detail page renders live results from DB — same view for every team member.

## Layer Plan
1. **Data layer first** — tables, constraints, seed data, RLS open policies.
2. **App logic** — server-side calculation functions (coded rules, no AI dependency).
3. **Smart features later** — AI income classification suggestions, anomaly flags.

## Core Without AI
All income and eligibility calculations are deterministic coded formulas from bank parameters stored in the `banks` table. AI is additive — removing it leaves a fully working system.
