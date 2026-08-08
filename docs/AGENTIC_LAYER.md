# Agentic Layer

## Draftable Actions (Low Risk — Auto)
- Run tally engine on new submission → create tally entries with extracted values + confidence. Auto on paste.
- Tag submission source_format from content patterns. Auto.
- Calculate completeness score. Auto on every save.

## Executable After Approval (Medium Risk — Light Approval)
- Suggest missing-field value from partial text context → officer confirms to accept. One click.
- Update submission status from `pending` → `reviewed` → requires officer action.
- Batch re-tally a submission after template changes → officer triggers, system warns affected entries.

## Human-Only Actions (Critical — No Automation)
- Delete a submission permanently.
- Modify the standard template (add/remove/rename required fields) — team lead only.
- Finalize and export a submission as official filled-template — officer must trigger export.

## Named Tools
- `run_tally(submission_id)` — low risk, auto
- `suggest_missing_value(submission_id, field_id)` — medium, one-click approve
- `update_entry(entry_id, new_value)` — medium, officer direct edit
- `finalize_submission(submission_id)` — high, officer explicit action
- `export_tally(submission_id)` — high, officer explicit action
- `delete_submission(submission_id)` — critical, human only
- `update_template(template_id)` — critical, team lead only

## Audit-Log Fields
Every action logs: `action`, `entity_type`, `entity_id`, `details` (jsonb: before/after values, actor, timestamp).

## v1 vs Later
- **v1:** `run_tally` (auto), `update_entry` (manual edit), `finalize_submission`, `export_tally`. All logged.
- **Later:** `suggest_missing_value` (AI), `batch_re_tally`, template update guard by role.