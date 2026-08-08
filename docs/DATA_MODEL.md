# Data Model

## templates
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid nullable | owner (lock-down) |
| name | text | e.g. "Standard Mortgage Loan Application v1" |
| description | text | |
| is_active | bool | one active at a time |
| created_at | timestamptz | |

## template_fields
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid nullable | |
| template_id | uuid → templates | cascade delete |
| field_key | text | e.g. `applicant_name`, `nric`, `monthly_income` |
| field_label | text | display label |
| field_type | text | text/number/date/boolean |
| is_required | bool | default true |
| sort_order | int | display order |
| created_at | timestamptz | |

## submissions
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid nullable | |
| template_id | uuid → templates | |
| client_name | text | derived/entered |
| agent_name | text | property agent |
| agent_agency | text | |
| raw_input | text | pasted raw client info |
| source_format | text | email/whatsapp/pdf-copy/other |
| status | text | pending/reviewed/finalized |
| completeness_score | numeric | 0–100, recalculated on save |
| created_at | timestamptz | |

## tally_entries
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid nullable | |
| submission_id | uuid → submissions | cascade delete |
| template_field_id | uuid → template_fields | cascade delete |
| extracted_value | text | AI or rule-matched value |
| source | text | "rule-match" / "manual" / "ai-extract" |
| confidence | numeric | 0–1 (null if manual) |
| review_status | text | unreviewed/confirmed/missing/uncertain |
| created_at | timestamptz | |

Unique: (submission_id, template_field_id).

**AI fields** (extracted_value, source, confidence, review_status) follow value + source + confidence + review_status pattern.

## audit_logs
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid nullable | |
| action | text | e.g. `tally_run`, `entry_override`, `submission_finalize` |
| entity_type | text | |
| entity_id | uuid | |
| details | jsonb | before/after snapshot |
| created_at | timestamptz | |

## Relationships
`templates 1—N template_fields` · `templates 1—N submissions` · `submissions 1—N tally_entries` · `template_fields 1—N tally_entries`

## RLS (v1)
All tables: permissive select + write (demo-first). Lock-down sprint replaces with `auth.uid() = user_id`.