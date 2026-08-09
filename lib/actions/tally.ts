"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runTallyEngine, detectSourceFormat } from "@/lib/tally/engine";
import { computeCompleteness } from "@/lib/tally/score";
import type { EntryWithField, TemplateField } from "@/lib/tally/types";

export interface TallyActionState {
  error?: string;
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
) {
  // Audit failures must never mask the primary write; log loudly instead.
  const { error } = await supabase.from("audit_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
  if (error) console.error(`audit_logs insert failed for ${action}:`, error.message);
}

/** Recompute a submission's completeness score from its saved entries. */
async function recalcScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionId: string,
): Promise<number> {
  const { data: entries, error } = await supabase
    .from("tally_entries")
    .select("extracted_value, review_status, template_fields(is_required)")
    .eq("submission_id", submissionId);
  if (error || !entries) return 0;
  const score = computeCompleteness(
    entries.map((e) => {
      const tf = e.template_fields as unknown as Pick<TemplateField, "is_required"> | null;
      return {
        extracted_value: e.extracted_value,
        review_status: e.review_status,
        is_required: tf?.is_required ?? true,
      };
    }),
  );
  await supabase.from("submissions").update({ completeness_score: score }).eq("id", submissionId);
  return score;
}

/** docs/AGENTIC_LAYER.md `run_tally` — auto on paste. Creates submission + one entry per template field. */
export async function createSubmissionAndTally(
  _prev: TallyActionState,
  formData: FormData,
): Promise<TallyActionState> {
  const rawInput = String(formData.get("raw_input") ?? "").trim();
  const agentName = String(formData.get("agent_name") ?? "").trim();
  const agentAgency = String(formData.get("agent_agency") ?? "").trim();
  let sourceFormat = String(formData.get("source_format") ?? "").trim();

  if (!rawInput) {
    return { error: "Paste the client info first — raw input cannot be empty." };
  }

  const supabase = await createClient();

  const { data: template, error: tplError } = await supabase
    .from("templates")
    .select("id, name, template_fields(id, field_key, field_label, field_type, is_required, sort_order)")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (tplError) return { error: `Could not load template: ${tplError.message}` };
  if (!template || !template.template_fields?.length) {
    return { error: "No active template — ask team lead to configure one." };
  }

  const fields = (template.template_fields as TemplateField[]).sort((a, b) => a.sort_order - b.sort_order);
  const matches = runTallyEngine(rawInput, fields);

  if (!sourceFormat) sourceFormat = detectSourceFormat(rawInput) ?? "other";
  const clientName =
    matches.find((m) => (m.field_key === "name" || m.field_key === "applicant_name") && m.extracted_value)
      ?.extracted_value ?? null;

  const score = computeCompleteness(
    matches.map((m, i) => ({
      extracted_value: m.extracted_value,
      review_status: m.review_status,
      is_required: fields[i].is_required,
    })),
  );

  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .insert({
      template_id: template.id,
      client_name: clientName,
      agent_name: agentName || null,
      agent_agency: agentAgency || null,
      raw_input: rawInput,
      source_format: sourceFormat,
      status: "pending",
      completeness_score: score,
    })
    .select("id")
    .single();

  if (subError || !submission) {
    return { error: `Could not save submission — check connection and retry. (${subError?.message})` };
  }

  const { error: entriesError } = await supabase.from("tally_entries").insert(
    matches.map((m) => ({
      submission_id: submission.id,
      template_field_id: m.template_field_id,
      extracted_value: m.extracted_value,
      source: m.source,
      confidence: m.confidence,
      review_status: m.review_status,
    })),
  );

  if (entriesError) {
    return { error: `Submission saved but tally entries failed: ${entriesError.message}` };
  }

  const matched = matches.filter((m) => m.extracted_value !== null).length;
  await logAudit(supabase, "tally_run", "submission", submission.id, {
    fields_matched: matched,
    fields_missing: matches.length - matched,
    score,
    source_format: sourceFormat,
  });

  revalidatePath("/tally");
  redirect(`/tally/${submission.id}`);
}

/** docs/AGENTIC_LAYER.md `update_entry` — officer direct edit. Empty value re-flags the field as missing. */
export async function updateEntry(
  entryId: string,
  submissionId: string,
  newValue: string,
): Promise<TallyActionState> {
  const value = newValue.trim();
  const supabase = await createClient();

  const { data: before, error: readError } = await supabase
    .from("tally_entries")
    .select("extracted_value, source, review_status")
    .eq("id", entryId)
    .single();
  if (readError || !before) return { error: "Entry not found." };

  const update = value
    ? { extracted_value: value, source: "manual", confidence: null, review_status: "confirmed" }
    : { extracted_value: null, source: "missing", confidence: 0, review_status: "missing" };

  const { error } = await supabase.from("tally_entries").update(update).eq("id", entryId);
  if (error) return { error: `Could not save — check connection and retry. (${error.message})` };

  await logAudit(supabase, value ? "entry_override" : "entry_missing_flagged", "tally_entry", entryId, {
    before: { value: before.extracted_value, source: before.source, review_status: before.review_status },
    after: update,
  });

  await recalcScore(supabase, submissionId);
  revalidatePath(`/tally/${submissionId}`);
  revalidatePath("/tally");
  return {};
}

/** Confirm an extracted/AI-suggested value as-is (uncertain/unreviewed → confirmed). */
export async function confirmEntry(entryId: string, submissionId: string): Promise<TallyActionState> {
  const supabase = await createClient();
  const { data: entry, error: readError } = await supabase
    .from("tally_entries")
    .select("extracted_value, review_status")
    .eq("id", entryId)
    .single();
  if (readError || !entry) return { error: "Entry not found." };
  if (!entry.extracted_value) return { error: "Nothing to confirm — the field has no value." };

  const { error } = await supabase
    .from("tally_entries")
    .update({ review_status: "confirmed" })
    .eq("id", entryId);
  if (error) return { error: `Could not save: ${error.message}` };

  await logAudit(supabase, "entry_confirmed", "tally_entry", entryId, {
    value: entry.extracted_value,
    before_status: entry.review_status,
  });

  await recalcScore(supabase, submissionId);
  revalidatePath(`/tally/${submissionId}`);
  return {};
}

const STATUS_FLOW = ["pending", "reviewed", "finalized"];

/** Status workflow pending → reviewed → finalized (docs/TASKS.md Sprint 2). */
export async function setSubmissionStatus(
  submissionId: string,
  status: string,
): Promise<TallyActionState> {
  if (!STATUS_FLOW.includes(status)) return { error: `Invalid status "${status}".` };
  const supabase = await createClient();

  const { data: before, error: readError } = await supabase
    .from("submissions")
    .select("status, completeness_score")
    .eq("id", submissionId)
    .single();
  if (readError || !before) return { error: "Submission not found." };

  const { error } = await supabase.from("submissions").update({ status }).eq("id", submissionId);
  if (error) return { error: `Could not update status: ${error.message}` };

  await logAudit(
    supabase,
    status === "finalized" ? "submission_finalized" : "submission_status_changed",
    "submission",
    submissionId,
    { before: before.status, after: status, score: before.completeness_score },
  );

  revalidatePath(`/tally/${submissionId}`);
  revalidatePath("/tally");
  return {};
}

/** docs/AGENTIC_LAYER.md `delete_submission` — critical, human-only; UI requires a confirm dialog. */
export async function deleteSubmission(submissionId: string): Promise<TallyActionState> {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("submissions")
    .select("client_name, agent_name, status, completeness_score")
    .eq("id", submissionId)
    .single();

  // tally_entries cascade via FK; audit rows are kept (audit trail survives deletes)
  const { error } = await supabase.from("submissions").delete().eq("id", submissionId);
  if (error) return { error: `Could not delete: ${error.message}` };

  await logAudit(supabase, "submission_deleted", "submission", submissionId, { before });

  revalidatePath("/tally");
  redirect("/tally");
}

/** Bulk delete (docs/AGENTIC_LAYER.md: delete is human-only — UI must confirm first). */
export async function deleteSubmissionsBulk(submissionIds: string[]): Promise<TallyActionState & { deleted?: number }> {
  if (submissionIds.length === 0) return { error: "Nothing selected." };
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("submissions")
    .select("id, client_name, agent_name, status, completeness_score")
    .in("id", submissionIds);

  const { error } = await supabase.from("submissions").delete().in("id", submissionIds);
  if (error) return { error: `Could not delete: ${error.message}` };

  for (const row of before ?? []) {
    await logAudit(supabase, "submission_deleted", "submission", row.id, { before: row, bulk: true });
  }

  revalidatePath("/tally");
  return { deleted: before?.length ?? submissionIds.length };
}

/** Re-run the rule engine over the saved raw input. Manual entries are never overwritten. */
export async function reTallySubmission(submissionId: string): Promise<TallyActionState> {
  const supabase = await createClient();

  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("raw_input, template_id")
    .eq("id", submissionId)
    .single();
  if (subError || !submission) return { error: "Submission not found." };

  const { data: fields, error: fieldsError } = await supabase
    .from("template_fields")
    .select("id, field_key, field_label, field_type, is_required, sort_order")
    .eq("template_id", submission.template_id)
    .order("sort_order");
  if (fieldsError || !fields?.length) return { error: "Template fields not found." };

  const { data: existing, error: entriesError } = await supabase
    .from("tally_entries")
    .select("id, template_field_id, source")
    .eq("submission_id", submissionId);
  if (entriesError) return { error: entriesError.message };

  const matches = runTallyEngine(submission.raw_input, fields);
  let updated = 0;

  for (const match of matches) {
    const entry = existing?.find((e) => e.template_field_id === match.template_field_id);
    if (entry?.source === "manual") continue; // officer edits always win
    if (entry) {
      await supabase
        .from("tally_entries")
        .update({
          extracted_value: match.extracted_value,
          source: match.source,
          confidence: match.confidence,
          review_status: match.review_status,
        })
        .eq("id", entry.id);
    } else {
      await supabase.from("tally_entries").insert({
        submission_id: submissionId,
        template_field_id: match.template_field_id,
        extracted_value: match.extracted_value,
        source: match.source,
        confidence: match.confidence,
        review_status: match.review_status,
      });
    }
    updated++;
  }

  // Refresh the derived client name unless the officer set it manually
  const nameEntry = existing?.find((e) => {
    const f = fields.find((x) => x.id === e.template_field_id);
    return (f?.field_key === "name" || f?.field_key === "applicant_name") && e.source === "manual";
  });
  if (!nameEntry) {
    const freshName = matches.find(
      (m) => (m.field_key === "name" || m.field_key === "applicant_name") && m.extracted_value,
    )?.extracted_value;
    if (freshName) {
      await supabase.from("submissions").update({ client_name: freshName }).eq("id", submissionId);
    }
  }

  const score = await recalcScore(supabase, submissionId);
  await logAudit(supabase, "tally_run", "submission", submissionId, {
    re_tally: true,
    entries_updated: updated,
    score,
  });

  revalidatePath(`/tally/${submissionId}`);
  revalidatePath("/tally");
  return {};
}

/**
 * docs/AGENTIC_LAYER.md `suggest_missing_value` — medium risk. Runs AI
 * extraction over fields the rule engine left missing/uncertain. Results land
 * as review_status "uncertain" (amber) so the officer one-click-confirms each
 * (docs/TASKS.md Sprint 3). Manual and confirmed entries are never touched.
 */
export async function aiExtractSubmission(submissionId: string): Promise<TallyActionState & { suggested?: number }> {
  const supabase = await createClient();

  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("raw_input, template_id")
    .eq("id", submissionId)
    .single();
  if (subError || !submission) return { error: "Submission not found." };

  const { data: entries, error: entriesError } = await supabase
    .from("tally_entries")
    .select("id, template_field_id, source, review_status, extracted_value, template_fields(id, field_key, field_label, field_type, is_required)")
    .eq("submission_id", submissionId);
  if (entriesError || !entries) return { error: "Could not load entries." };

  const candidates = entries.filter(
    (e) => e.source !== "manual" && e.review_status !== "confirmed" &&
      (e.review_status === "missing" || e.review_status === "uncertain" || !e.extracted_value),
  );
  if (candidates.length === 0) return { error: "Nothing left for AI — every field is filled or confirmed." };

  const fields = candidates
    .map((e) => e.template_fields as unknown as TemplateField | null)
    .filter((f): f is TemplateField => f !== null);

  const { aiExtractFields } = await import("@/lib/tally/aiExtract");
  let results;
  try {
    results = await aiExtractFields(submission.raw_input, fields);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "AI extraction failed." };
  }

  let suggested = 0;
  for (const result of results) {
    if (!result.value) continue;
    const entry = candidates.find(
      (e) => (e.template_fields as unknown as TemplateField | null)?.field_key === result.field_key,
    );
    if (!entry) continue;
    const { error } = await supabase
      .from("tally_entries")
      .update({
        extracted_value: result.value,
        source: "ai-extract",
        confidence: Math.round(result.confidence * 100) / 100,
        review_status: "uncertain", // officer must confirm — AI never self-approves
      })
      .eq("id", entry.id);
    if (!error) suggested++;
  }

  await logAudit(supabase, "ai_extract_run", "submission", submissionId, {
    fields_attempted: fields.map((f) => f.field_key),
    fields_suggested: suggested,
  });

  await recalcScore(supabase, submissionId);
  revalidatePath(`/tally/${submissionId}`);
  revalidatePath("/tally");
  return { suggested };
}

/** Shared loader for the results + export screens. */
export async function loadSubmissionWithEntries(submissionId: string) {
  const supabase = await createClient();
  const [{ data: submission }, { data: entries }] = await Promise.all([
    supabase.from("submissions").select("*").eq("id", submissionId).maybeSingle(),
    supabase
      .from("tally_entries")
      .select("*, template_fields(*)")
      .eq("submission_id", submissionId),
  ]);
  const sorted = ((entries ?? []) as EntryWithField[]).sort(
    (a, b) => (a.template_fields?.sort_order ?? 0) - (b.template_fields?.sort_order ?? 0),
  );
  return { submission, entries: sorted };
}
