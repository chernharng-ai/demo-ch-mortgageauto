# Test Plan

## v1 Success Scenario (manual)
1. Open app homepage — case dashboard loads with 2 seeded demo cases. No login prompt.
2. Click "New Case" — form renders with all fields.
3. Enter: Client name "Ahmad bin Ali", employment type "Employed", employer "Petronas".
4. Enter income entries: Basic RM 5,000/month, Allowance RM 1,000/month.
5. Submit — case appears in dashboard with status "draft", doc completeness 0%.
6. Open case detail — document checklist shows all required docs as "pending".
7. Tick 3 documents as "received" — completeness badge updates immediately.
8. Click "Run Calculation" — income calculations and loan eligibilities appear for all 3 banks.
9. Verify: Maybank eligible income = (5000×1.0 + 1000×0.5) = RM 5,500. Max loan within expected range.
10. Open a second browser tab — same case and results visible without any login.

## Empty State Tests
- New deployment with no cases → dashboard shows "No cases yet. Create your first case." (not a blank screen)
- Case with no income entries → "Run Calculation" button disabled with tooltip "Add income entries first"

## Error State Tests
- Submit New Case form with blank client name → inline validation error, no DB write
- Supabase offline → error banner "Unable to reach database. Please try again." shown on dashboard
- Run Calculation with missing bank params → error message "Bank configuration incomplete — contact admin"

## Calculation Accuracy Tests
- Employed client, Basic RM 8,000, Allowance RM 2,000 → eligible income per Maybank rules = RM 9,000
- Self-employed client, Net Profit RM 10,000 → eligible income per CIMB rules = RM 7,000 (0.7×)
- DSR check: if monthly commitment RM 3,000 and eligible income RM 5,000 → DSR = 60%; eligibility = eligible (under 70%)

## Permission Tests (Sprint 3)
- Unauthenticated user: can view case list, cannot submit New Case form (button hidden / 401 returned)
- Member: can create/edit own cases, cannot edit bank params
- Admin: can edit bank `calc_params`; change logged in audit_logs
