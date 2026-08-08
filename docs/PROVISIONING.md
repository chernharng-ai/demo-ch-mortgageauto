# PROVISIONING — what must exist before the deployed app works

> Status as of 2026-08-08: the code for BOTH modules (case review + client info
> tally) is built and deploys cleanly from GitHub → Vercel, but **no Supabase
> project is wired up** — the Vercel project has zero environment variables, so
> every page shows the "Database not connected yet" notice. Despite what
> CLAUDE.md/HANDOFF.md say, the stack was NOT already provisioned.

## 1. Database (Supabase)

1. Create a project at supabase.com (any region; free tier is fine for demo).
2. Open **SQL editor** and run the files in `supabase/migrations/` **in
   filename order**:
   - `0000_case_review_baseline.sql` — case-review tables (banks, clients,
     cases, …). Recovered from git history: commit `fa5b786` overwrote the old
     `0001_init.sql`, which orphaned migrations 0002–0016 on fresh databases.
   - `0001_init.sql` — client-info-tally tables + demo seed (templates,
     template_fields, submissions, tally_entries, audit_logs).
   - `0002` … `0016` — case-review evolution (bank guidelines, checklists,
     income, commitments, …).
   All files are idempotent (`if not exists` / `on conflict do nothing`), so
   re-running is safe. Only the tally module? `0001_init.sql` alone is enough.
3. Storage: the case-review module expects a bucket named `client-documents`
   (private). Create it under Storage if you use that module.

## 2. Environment variables

Add in Vercel → demo-ch-mortgageauto → Settings → Environment Variables
(all environments), from Supabase → Settings → API:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server-only) |
| `ANTHROPIC_API_KEY` | for AI extraction (tally "AI Extract ✨", case-review document reading) |

Then redeploy (push any commit, or Vercel → Redeploy). Locally:
`vercel env pull .env.local` then `bun dev`.

## 3. Verify (PRD success scenario)

1. Open `/tally` — three seeded submissions appear.
2. New Tally → paste a messy agent message → Run Tally → ≥10/15 fields fill,
   missing ones red, score shows.
3. Edit a value, fill a missing field — score recalculates; Mark Reviewed.
4. Dashboard shows the submission with updated score; Export prints the filled
   template.
