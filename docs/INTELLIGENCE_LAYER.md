# Intelligence Layer

## Messy Inputs Today
- Income figures entered inconsistently (annual vs monthly mixed up)
- Officers unsure which income components each bank counts
- Document checklist tracked in spreadsheets, items missed

## Auto-Structure (v1 — rule-based, no AI)
All structuring is deterministic from `banks.calc_params`:
```json
{
  "bank": "Maybank",
  "dsr_limit": 0.70,
  "stress_rate": 0.065,
  "income_rules": {
    "employed": { "basic": 1.0, "allowance": 0.5, "commission": 0.5 },
    "self_employed": { "net_profit": 0.7 },
    "commission": { "commission": 0.5, "basic": 1.0 }
  },
  "tenure_max_years": 35
}
```
Eligible income = sum of (gross_amount × bank multiplier per income_type).
Max loan = eligible_income × DSR / monthly_rate(stress_rate, tenure).

## Events to Track
- Case created
- Document status changed
- Income entry added / edited
- Calculation run
- Eligibility result viewed

## Scoring (v1)
- Document completeness score: received_docs / total_docs × 100
- Eligibility status: eligible (DSR ≤ limit), marginal (within 5%), ineligible (over limit)

## What Gets Ranked
- Cases sorted by status + document completeness on dashboard
- Banks sorted by max loan amount on case detail page

## Later (AI)
- Suggest income type classification from uploaded payslip OCR
- Flag anomalies (income spike vs prior months)
- Draft rejection/approval summary letter
