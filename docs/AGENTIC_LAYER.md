# Agentic Layer

## Risk Levels & Actions

### Low Risk — Auto-execute
- Auto-generate document checklist when a new case is created (from bank's `doc_requirements`)
- Auto-run income calculation when income entries are saved
- Auto-compute loan eligibility after calculation completes
- Tag case as `in-review` when all documents received

### Medium Risk — Show draft, user confirms
- Suggest updating case status to `approved` or `rejected` based on eligibility results
- Pre-fill income entries from a prior case for the same client

### High Risk — Explicit approval required
- Send eligibility summary to external party (future: email/WhatsApp)
- Mark a case as formally rejected (triggers record lock)

### Critical — Human only
- Delete a case or client record
- Override a bank's calculation parameters

## Named Tools (v1)
- `run_income_calculation(case_id, bank_id)` — reads income_entries + bank calc_params, writes income_calculations
- `run_loan_eligibility(case_id, bank_id)` — reads income_calculations, writes loan_eligibilities
- `generate_document_checklist(case_id)` — reads bank doc_requirements, writes document_items

## Audit Log Fields
- `id`, `case_id`, `action`, `performed_by`, `before_value` (jsonb), `after_value` (jsonb), `created_at`

## v1
Only low-risk auto-execute tools ship in v1 (run inside Server Actions, triggered on form submit). All others are later.
