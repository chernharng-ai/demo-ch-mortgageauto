import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSubmissionWithEntries } from "@/lib/actions/tally";
import { supabaseConfigured } from "@/lib/supabase/configured";
import { missingRequiredCount } from "@/lib/tally/score";
import { STANDARD_TEMPLATE_ID, renderStandardTemplate } from "@/lib/tally/standardTemplate";
import CopyTemplatePanel from "./CopyTemplatePanel";
import RawInputEditor from "./RawInputEditor";
import StatusControl from "./StatusControl";
import SubmissionToolbar from "./SubmissionToolbar";
import SetupNotice from "../SetupNotice";

export const dynamic = "force-dynamic";

const SCORE_COLOR = (score: number) =>
  score >= 90 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured()) return <SetupNotice />;
  const { submission, entries } = await loadSubmissionWithEntries(id);
  if (!submission) notFound();

  const missingRequired = missingRequiredCount(
    entries.map((e) => ({
      extracted_value: e.extracted_value,
      review_status: e.review_status,
      is_required: e.template_fields?.is_required ?? true,
    })),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/tally" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Tally Dashboard
          </Link>
          <h1 className="mt-2 text-xl font-bold text-neutral-900">
            {submission.client_name ?? "Unnamed client"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {submission.agent_name ? `Agent: ${submission.agent_name}` : "No agent recorded"}
            {submission.agent_agency ? ` (${submission.agent_agency})` : ""}
            {" · "}
            {submission.source_format ?? "unknown source"}
            {" · "}
            {new Date(submission.created_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold tabular-nums ${SCORE_COLOR(Number(submission.completeness_score))}`}>
            {Math.round(Number(submission.completeness_score))}%
          </div>
          <p className="text-xs text-neutral-500">
            completeness · {missingRequired} required missing
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusControl submissionId={submission.id} status={submission.status} />
        <SubmissionToolbar submissionId={submission.id} />
      </div>

      {submission.template_id === STANDARD_TEMPLATE_ID && (
        <CopyTemplatePanel
          text={renderStandardTemplate(
            Object.fromEntries(
              entries.map((e) => [
                e.template_fields?.field_key ?? "",
                e.review_status === "missing" ? null : e.extracted_value,
              ]),
            ),
          )}
          missingCount={
            entries.filter((e) => e.review_status === "missing" || !e.extracted_value).length
          }
        />
      )}

      <RawInputEditor
        submissionId={submission.id}
        rawInput={submission.raw_input}
        sourceFormat={submission.source_format}
      />
    </main>
  );
}
