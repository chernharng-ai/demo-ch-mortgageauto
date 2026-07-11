import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog as AuditLogRow, Bank, Case, CaseCommitment, CaseDocument, Client, DocumentItem, DocumentSubItem, IncomeCalculation, IncomeEntry, LoanEligibility } from "@/lib/mortgage/types";
import DocumentChecklist from "./DocumentChecklist";
import IncomeEntries from "./IncomeEntries";
import CalculationPanel from "./CalculationPanel";
import CaseStatusControl from "./CaseStatusControl";
import AuditLog from "./AuditLog";
import DeleteCaseButton from "./DeleteCaseButton";
import CaseSummary from "./CaseSummary";
import CaseReviewNote from "./CaseReviewNote";
import CommitmentsPanel from "./CommitmentsPanel";
import CaseProfile from "./CaseProfile";
import TallyPanel from "./TallyPanel";
import ConsolidatedIncome from "./ConsolidatedIncome";
import { runDocumentTally } from "@/lib/mortgage/tally";
import { consolidatePayslipIncome } from "@/lib/mortgage/consolidate";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const canEdit = true; // temporarily open — see supabase/migrations/0005_temporary_reopen.sql

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("*, clients(*)")
    .eq("id", id)
    .single<Case & { clients: Client }>();

  if (caseError || !caseRow) {
    notFound();
  }

  const [
    { data: documentItems },
    { data: incomeEntries },
    { data: banks },
    { data: incomeCalculations },
    { data: loanEligibilities },
    { data: auditLogs },
    { data: caseDocuments },
    { data: documentSubItems },
    { data: caseCommitments },
  ] = await Promise.all([
    supabase.from("document_items").select("*").eq("case_id", id).order("doc_name").returns<DocumentItem[]>(),
    supabase.from("income_entries").select("*").eq("case_id", id).order("created_at").returns<IncomeEntry[]>(),
    supabase.from("banks").select("*").returns<Bank[]>(),
    supabase.from("income_calculations").select("*").eq("case_id", id).returns<IncomeCalculation[]>(),
    supabase.from("loan_eligibilities").select("*").eq("case_id", id).returns<LoanEligibility[]>(),
    supabase.from("audit_logs").select("*").eq("case_id", id).order("created_at", { ascending: false }).returns<AuditLogRow[]>(),
    supabase.from("case_documents").select("*").eq("case_id", id).order("created_at").returns<CaseDocument[]>(),
    supabase.from("document_sub_items").select("*").eq("case_id", id).order("sort_order").returns<DocumentSubItem[]>(),
    supabase.from("case_commitments").select("*").eq("case_id", id).order("created_at").returns<CaseCommitment[]>(),
  ]);

  const client = caseRow.clients;
  const docs = documentItems ?? [];
  const income = incomeEntries ?? [];
  const bankList = banks ?? [];
  const rawCaseDocuments = caseDocuments ?? [];

  let signedUrls = new Map<string, string | null>();
  if (rawCaseDocuments.length > 0) {
    const { data: signed } = await supabase.storage
      .from("client-documents")
      .createSignedUrls(
        rawCaseDocuments.map((d) => d.file_path),
        3600,
      );
    signedUrls = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  }
  const signedCaseDocuments = rawCaseDocuments.map((d) => ({ ...d, signedUrl: signedUrls.get(d.file_path) ?? null }));
  const subItems = documentSubItems ?? [];
  const commitments = caseCommitments ?? [];
  const tally = runDocumentTally(rawCaseDocuments);
  const incomeProposal = consolidatePayslipIncome(
    rawCaseDocuments.map((d) => d.ai_extracted_data).filter((x): x is NonNullable<typeof x> => x !== null),
    caseRow.application_date,
    caseRow.has_variable_income,
  );

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client?.full_name ?? "Unknown client"}</h1>
          <p className="text-sm text-neutral-500 mt-1 capitalize">
            {client?.employment_type} {client?.employer_name ? `at ${client.employer_name}` : ""}
            {client?.ic_number ? ` · IC ${client.ic_number}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CaseStatusControl caseId={caseRow.id} status={caseRow.status} canEdit={canEdit} />
          <DeleteCaseButton caseId={caseRow.id} clientName={client?.full_name ?? "this client"} />
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Document Checklist</h2>
        <DocumentChecklist caseId={caseRow.id} items={docs} caseDocuments={signedCaseDocuments} subItems={subItems} canEdit={canEdit} />
      </section>

      {rawCaseDocuments.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">Document Tally</h2>
          <TallyPanel tally={tally} />
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Income Entries</h2>
        <ConsolidatedIncome caseId={caseRow.id} proposal={incomeProposal} canEdit={canEdit} />
        <IncomeEntries caseId={caseRow.id} entries={income} canEdit={canEdit} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Case Profile</h2>
        <CaseProfile caseId={caseRow.id} caseRow={caseRow} canEdit={canEdit} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Existing Commitments</h2>
        <CommitmentsPanel caseId={caseRow.id} commitments={commitments} canEdit={canEdit} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Bank Eligibility</h2>
        <CalculationPanel
          caseId={caseRow.id}
          hasIncome={income.length > 0}
          canEdit={canEdit}
          banks={bankList}
          incomeCalculations={incomeCalculations ?? []}
          loanEligibilities={loanEligibilities ?? []}
        />
      </section>

      <CaseSummary caseId={caseRow.id} summary={caseRow.ai_summary} status={caseRow.ai_summary_status} canEdit={canEdit} />

      <CaseReviewNote
        caseId={caseRow.id}
        caseRow={caseRow}
        client={client}
        documentItems={docs}
        documentSubItems={subItems}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        canEdit={canEdit}
      />

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Activity Log</h2>
        <AuditLog logs={auditLogs ?? []} />
      </section>
    </main>
  );
}
