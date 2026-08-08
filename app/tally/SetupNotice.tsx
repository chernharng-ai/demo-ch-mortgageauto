export default function SetupNotice() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900">Database not connected yet</h1>
        <p className="mt-2 text-sm text-amber-800">
          The app is deployed, but the Supabase environment variables are not set, so nothing can be
          saved or loaded. To go live:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-800">
          <li>
            Create a Supabase project, open its <span className="font-semibold">SQL editor</span>, and
            run each file in <code className="rounded bg-amber-100 px-1">supabase/migrations/</code> in
            order (at minimum <code className="rounded bg-amber-100 px-1">0001_init.sql</code> for this
            tally module — it also seeds demo data).
          </li>
          <li>
            In Vercel → Project → Settings → Environment Variables, add{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
            <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> and (for AI
            extraction) <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>.
          </li>
          <li>Redeploy (or push any commit) and reload this page.</li>
        </ol>
        <p className="mt-3 text-xs text-amber-700">
          Full steps: <code className="rounded bg-amber-100 px-1">docs/PROVISIONING.md</code> in the repo.
        </p>
      </div>
    </main>
  );
}
