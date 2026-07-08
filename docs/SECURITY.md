# Security

## Secrets
- Supabase URL + anon key in `.env.local` only; never in client bundle as writeable secrets.
- Service role key never exposed to frontend — only used in server-side actions.

## Permission Model (v1)
- All tables open with permissive RLS policies (demo-first; no login required to view or edit).
- Lock-down sprint: add `auth.uid() = user_id` policies; anonymous read removed; write requires session.

## Approved Tools Rule
- Only named server actions (`run_income_calculation`, `run_loan_eligibility`, `generate_document_checklist`) may write calculation results.
- No raw `eval`, no dynamic SQL, no `run_any` escape hatches.
- Calculation logic lives server-side only; client receives results, not formulas.

## Audit Principle
- Every calculation run, status change, and document update is logged to `audit_logs` with before/after values.
- Logs are append-only (no update/delete policy on `audit_logs`).
- Team lead can review all logs; individual members see only their own actions until role-based RLS is added.

## Stop Points
- Do not store IC numbers unencrypted if the system moves outside internal LAN — stop and consult a security professional.
- Do not send client data to any third-party AI API without explicit data-handling review.
