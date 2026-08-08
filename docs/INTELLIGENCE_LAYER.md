# Intelligence Layer

## Messy Inputs
Property agents send client info as: WhatsApp messages, email body text, PDF copy-paste, handwritten notes transcribed. No consistent structure, field labels vary ("IC No" vs "NRIC" vs "MyKad"), some fields omitted entirely.

## Auto-Structure Schema (JSON example)
```json
{
  "applicant_name": {"value": "Lim Wei Jian", "confidence": 0.95, "source": "rule-match"},
  "nric": {"value": "880214-14-5566", "confidence": 0.90, "source": "rule-match"},
  "monthly_income": {"value": null, "confidence": 0, "source": "missing"},
  "property_address": {"value": "No 12, Jalan Indah", "confidence": 0.60, "source": "rule-match"}
}
```

## Events to Track
- `tally_run` — new submission tallied
- `entry_override` — officer changed extracted value
- `entry_missing_flagged` — field marked missing
- `submission_finalized` — status → finalized
- `compliance_threshold_hit` — score crossed 90%

## Scoring Rules (v1, rule-based)
- **Field match:** regex/keyword against field_key + field_label aliases. Confidence 0.9 for exact label match, 0.6 for fuzzy.
- **Completeness score:** `(confirmed + uncertain fields) / required fields × 100`. Missing fields excluded.
- **Submission priority:** `missing_required_count` desc, then `created_at` asc.

## What Gets Ranked
Submissions on dashboard ranked by: missing required field count (most missing = highest priority) → recency.

## v1 vs Later
- **v1:** keyword/regex matching, rule-based confidence, completeness math.
- **Later:** LLM extraction for unstructured prose, semantic field aliases, learned correction suggestions from override patterns.