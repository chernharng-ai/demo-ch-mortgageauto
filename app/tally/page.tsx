import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { missingRequiredCount } from "@/lib/tally/score";
import type { Submission } from "@/lib/tally/types";

export const dynamic = "force-dynamic";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  reviewed: "bg-amber-100 text-amber-800",
  finalized: "bg-emerald-100 text-emerald-800",
};

const STATUS_FILTERS = ["all", "pending", "reviewed", "finalized"];

type SubmissionRow = Submission & {
  tally_entries: { extracted_value: string | null; review_status: string; template_fields: { is_required: boolean } | null }[];
};

export default async function TallyDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const { status = "all", sort = "priority" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("submissions")
    .select("*, tally_entries(extracted_value, review_status, template_fields(is_required))");
  if (STATUS_FILTERS.includes(status) && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  const submissions = (data ?? []) as SubmissionRow[];

  const withMissing = submissions.map((s) => ({
    ...s,
    missing: missingRequiredCount(
      s.tally_entries.map((e) => ({
        extracted_value: e.extracted_value,
        review_status: e.review_status,
        is_required: e.template_fields?.is_required ?? true,
      })),
    ),
  }));

  // Priority ranking (docs/INTELLIGENCE_LAYER.md): most missing required first, then oldest first.
  withMissing.sort((a, b) => {
    if (sort === "recent") return +new Date(b.created_at) - +new Date(a.created_at);
    if (sort === "score") return Number(b.completeness_score) - Number(a.completeness_score);
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
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f}
              href={`/tally?status=${f}&sort=${sort}`}
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
              href={`/tally?status=${status}&sort=${key}`}
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
      ) : withMissing.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-600">No submissions yet. Start by tallying client info.</p>
          <Link
            href="/tally/new"
            className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            + New Tally
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Missing req.</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {withMissing.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/tally/${s.id}`} className="font-medium text-neutral-900 hover:underline">
                      {s.client_name ?? "Unnamed client"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {s.agent_name ?? "—"}
                    {s.agent_agency && <span className="text-neutral-400"> · {s.agent_agency}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{s.source_format ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[s.status] ?? STATUS_BADGES.pending}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {s.missing > 0 ? (
                      <span className="font-semibold text-red-600">{s.missing}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-neutral-900">
                    {Math.round(Number(s.completeness_score))}%
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {new Date(s.created_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
