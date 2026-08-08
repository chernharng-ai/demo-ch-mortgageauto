# Test Plan

## v1 Success Scenario
1. Open app in preview — no login required, dashboard shows seeded submissions.
2. Click "New Tally" → select active template → paste raw client text (e.g. WhatsApp message with name, NRIC, income, property address but missing employer and EPF balance).
3. Enter agent name + source format ("whatsapp") → click "Run Tally".
4. Verify: results table shows ~12 of 15 fields with extracted values (green), 3 fields MISSING (red).
5. Verify: completeness score displays (e.g. 80%).
6. Click an extracted value → edit it → verify it saves (amber → green on refresh).
7. Click a MISSING field → type a value → verify review_status changes to confirmed, score updates.
8. Verify: submission appears on dashboard with correct status + score.
9. Click "Export" → verify printable filled-template renders with all values + missing fields marked.

## Empty / Error Cases
- **No template:** if no active template exists, Tally screen shows message "No active template — ask team lead to configure one."
- **Empty raw input:** Run Tally disabled; if forced, all fields show MISSING, score 0%.
- **Blank dashboard:** shows "No submissions yet. Start by tallying client info." with CTA button.
- **Network error:** toast "Could not save — check connection and retry." Data not lost (stays in form).
- **Loading state:** results table shows skeleton rows while extraction runs.
- **Duplicate field match:** if raw text contains multiple values for one field (e.g. two phone numbers), system picks first match and flags review_status as uncertain (amber).
- **Delete submission:** confirmation dialog required; on confirm, submission + tally entries removed, audit log written.