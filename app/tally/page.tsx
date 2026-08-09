import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";
import { missingRequiredCount } from "@/lib/tally/score";
import type { Submission } from "@/lib/tally/types";
import SetupNotice from "./SetupNotice";
import SubmissionsTable, { type SubmissionRowData } from "./SubmissionsTable";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["all", "pending", "reviewed", "finalized"];

type SubmissionRow = Submission & {
  tally_entries: { extracted_value: string | null; review_status: string; template_fields: { is_required: boolean } | null }[];
};

export default async function TallyDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; q?: string }>;
}) {
  const { status = "all", sort = "priority", q = "" } = await searchParams;
  if (!supabaseConfigured()) return <SetupNotice />;
  const supabase = await createClient();

  let query = supabase
    .from("submissions")
    .select("*, tally_entries(extracted_value, review_status, template_fields(is_required))");
  if (STATUS_FILTERS.includes(status) && status !== "all") query = query.eq("status", status);
  const search = q.trim().replace(/[,()]/g, " ").slice(0, 80);
  if (search) query = query.or(`client_name.ilike.%${search}%,agent_name.ilike.%${search}%`);

  const { data, error } = await query;
  const submissions = (data ?? []) as SubmissionRow[];

  const rows: SubmissionRowData[] = submissions.map((s) => ({
    id: s.id,
    client_name: s.client_name,
    agent_name: s.agent_name,
    agent_agency: s.agent_agency,
    source_format: s.source_format,
    status: s.status,
    completeness_score: Number(s.completeness_score),
    created_at: s.created_at,
    missing: missingRequiredCount(
      s.tally_entries.map((e) => ({
        extracted_value: e.extracted_value,
        review_status: e.review_status,
        is_required: e.template_fields?.is_required ?? true,
      })),
    ),
  }));

  // Priority ranking (docs/INTELLIGENCE_LAYER.md): most missing required first, then oldest first.
  rows.sort((a, b) => {
    if (sort === "recent") return +new Date(b.created_at) - +new Date(a.created_at);
    if (sort === "score") return b.completeness_score - a.completeness_score;
    return b.missing - a.missing || +new Date(a.created_at) - +new Date(b.created_at);
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Client Info Tally</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Paste raw client info from agents, tally it against the standard application template.
          </p>
        </div>
        <Link
          href="/tally/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          + New Tally
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <form action="/tally" method="get" className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="sort" value={sort} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search client or agent…"
            className="w-56 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
          {q && (
            <Link href={`/tally?status=${status}&sort=${sort}`} className="text-xs text-neutral-500 hover:text-neutral-900">
              Clear
            </Link>
          )}
        </form>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f}
              href={`/tally?status=${f}&sort=${sort}&q=${encodeURIComponent(q)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status === f ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          sort:
          {[["priority", "most missing"], ["recent", "newest"], ["score", "score"]].map(([key, label]) => (
            <Link
              key={key}
              href={`/tally?status=${status}&sort=${key}&q=${encodeURIComponent(q)}`}
              className={`rounded-full px-2.5 py-1 font-medium ${
                sort === key ? "bg-neutral-200 text-neutral-900" : "hover:bg-neutral-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load submissions: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-600">
            {q ? `No submissions match "${q}".` : "No submissions yet. Start by tallying client info."}
          </p>
          {!q && (
            <Link
              href="/tally/new"
              className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              + New Tally
            </Link>
          )}
        </div>
      ) : (
        <SubmissionsTable rows={rows} />
      )}
    </main>
  );
}
