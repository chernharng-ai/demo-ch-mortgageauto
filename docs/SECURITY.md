# Security

## Secret Handling
- Supabase service role key: server-side only, never imported in client components.
- Next.js API routes / server actions use key from environment variables — never exposed to browser.
- No secrets in client bundle. No `.env` committed.

## Permission Model
- **v1 (demo-first):** no login wall. RLS policies are permissive (select + write for all). Seeded demo rows render for anonymous visitors.
- **Lock-down sprint:** login required. RLS scoped to `auth.uid() = user_id` on all tables. Roles: officer (CRUD submissions/entries), reviewer (read + finalize), team lead (all + template management).
- Agent tools inherit the logged-in user's permissions — no elevated access.

## Approved-Tools Rule
- Only named, explicit server actions/API routes may write to the database. No generic `run_any` or `send_any` endpoints.
- Each tool validates input shape before writing. No raw SQL from client.
- Supabase RLS is the enforcement floor — even if a tool is misconfigured, RLS prevents cross-user data access after lock-down.

## Audit Principle
Every meaningful write (tally run, entry override, status change, finalize, delete) creates an `audit_logs` row with actor, entity, before/after. Read-only on audit table. Logs survive refresh and are identical across devices.