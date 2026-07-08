import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bank, Case, Client, DocumentItem, IncomeCalculation, IncomeEntry, LoanEligibility } from "@/lib/mortgage/types";
import DocumentChecklist from "./DocumentChecklist";
import IncomeEntries from "./IncomeEntries";
import CalculationPanel from "./CalculationPanel";
import CaseStatusControl from "./CaseStatusControl";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("*, clients(*)")
    .eq("id", id)
    .single<Case & { clients: Client }>();

  if (caseError || !caseRow) {
    notFound();
  }

  const [{ data: documentItems }, { data: incomeEntries }, { data: banks }, { data: incomeCalculations }, { data: loanEligibilities }] =
    await Promise.all([
      supabase.from("document_items").select("*").eq("case_id", id).order("doc_name").returns<DocumentItem[]>(),
      supabase.from("income_entries").select("*").eq("case_id", id).order("created_at").returns<IncomeEntry[]>(),
      supabase.from("banks").select("*").returns<Bank[]>(),
      supabase.from("income_calculations").select("*").eq("case_id", id).returns<IncomeCalculation[]>(),
      supabase.from("loan_eligibilities").select("*").eq("case_id", id).returns<LoanEligibility[]>(),
    ]);

  const client = caseRow.clients;
  const docs = documentItems ?? [];
  const income = incomeEntries ?? [];
  const bankList = banks ?? [];
  const total = docs.length;
  const received = docs.filter((d) => d.status === "received").length;
  const completeness = total > 0 ? Math.round((received / total) * 100) : 0;

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
        <CaseStatusControl caseId={caseRow.id} status={caseRow.status} />
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <Stat label="Property Value" value={caseRow.property_value ? `RM ${caseRow.property_value.toLocaleString()}` : "—"} />
        <Stat label="Loan Tenure" value={`${caseRow.loan_tenure_years} yrs`} />
        <Stat label="Doc Completeness" value={`${completeness}%`} />
        <Stat label="Income Lines" value={String(income.length)} />
      </section>

      {caseRow.notes && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Notes</h2>
          <p className="text-sm text-neutral-600 bg-neutral-50 rounded-md p-3">{caseRow.notes}</p>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Document Checklist</h2>
        <DocumentChecklist caseId={caseRow.id} items={docs} banks={bankList} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Income Entries</h2>
        <IncomeEntries caseId={caseRow.id} entries={income} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Bank Eligibility</h2>
        <CalculationPanel
          caseId={caseRow.id}
          hasIncome={income.length > 0}
          banks={bankList}
          incomeCalculations={incomeCalculations ?? []}
          loanEligibilities={loanEligibilities ?? []}
        />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold text-neutral-900 mt-0.5">{value}</div>
    </div>
  );
}
