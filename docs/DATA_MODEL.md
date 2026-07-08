# Data Model

## banks
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Maybank", "CIMB" |
| calc_params | jsonb | DSR limit, stress rate, income multiplier rules per employment type |
| doc_requirements | jsonb | list of required document types |
| created_at | timestamptz | |

## clients
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | owner (for lock-down sprint) |
| full_name | text | |
| ic_number | text | |
| employment_type | text | employed / self-employed / commission |
| employer_name | text | |
| created_at | timestamptz | |

## cases
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | creator |
| client_id | uuid FK → clients | |
| status | text | draft / in-review / approved / rejected |
| property_value | numeric | |
| loan_tenure_years | int | |
| notes | text | |
| created_at | timestamptz | |

## income_entries
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK → cases | |
| income_type | text | basic / allowance / commission / rental / other |
| gross_amount | numeric | |
| frequency | text | monthly / annual |
| supporting_doc | text | description |
| created_at | timestamptz | |

## income_calculations
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK → cases | |
| bank_id | uuid FK → banks | |
| eligible_income | numeric | computed result |
| method_snapshot | jsonb | rules used at time of calc |
| calculated_by | text | user display name |
| created_at | timestamptz | |

## loan_eligibilities
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK → cases | |
| bank_id | uuid FK → banks | |
| max_loan_amount | numeric | |
| monthly_instalment | numeric | |
| dsr_ratio | numeric | |
| eligibility_status | text | eligible / marginal / ineligible |
| created_at | timestamptz | |

## document_items
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK → cases | |
| bank_id | uuid FK → banks nullable | null = universal requirement |
| doc_name | text | e.g. "3 months payslip" |
| status | text | pending / received / missing |
| received_at | timestamptz nullable | |
| notes | text | |
| created_at | timestamptz | |

## AI Fields
Any future AI-suggested income classification on `income_entries` will add:
- `ai_suggested_type` text
- `ai_suggested_type_source` text
- `ai_suggested_type_confidence` numeric
- `ai_suggested_type_review_status` text default 'unreviewed'

## RLS
All tables: RLS enabled. v1 = permissive open policies (select + all for everyone). Lock-down sprint replaces with `auth.uid() = user_id`.
