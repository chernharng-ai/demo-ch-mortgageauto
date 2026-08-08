# Architecture

## Stack
Next.js (App Router, TypeScript) · Supabase (Postgres + RLS) · Vercel deploy.

## Build Now vs Later
**Now (v1):** Template + field management, paste raw input, rule-based tally, review/edit entries, completeness score, dashboard, export view.
**Next:** AI extraction from messy text, ranking by urgency, agentic draft suggestions.
**Later:** Auth + roles + per-user RLS, external integrations.

## Key User Action Flow (step by step)
1. Officer opens Tally screen, selects active template.
2. Pastes raw client text (from agent email/WhatsApp/PDF copy), enters agent name + source format.
3. System runs keyword/regex matcher over template fields → creates tally entries.
4. Results render: each field shows extracted value (green), uncertain (amber), or MISSING (red).
5. Officer reviews, edits wrong values, adds missed ones, saves.
6. Completeness score recalculates from saved entries.
7. Submission appears on dashboard with status + score.
8. Officer exports printable filled-template view.

## Layer Plan
1. **Data:** tables for templates, template_fields, submissions, tally_entries, audit_logs. Constraints + RLS (permissive v1).
2. **App logic:** keyword/regex extraction engine, completeness calculator, CRUD screens, dashboard, export.
3. **Smart features (later):** AI extraction layer on top of rule-based engine, confidence scoring, ranking, draft suggestions.

## Why Core Works Without AI
The tally engine uses keyword and regex matching against known field labels (e.g., "NRIC", "income", "property address"). This covers structured and semi-structured inputs. AI extraction is layered on later to handle truly unstructured prose — the rule-based engine remains the fallback.