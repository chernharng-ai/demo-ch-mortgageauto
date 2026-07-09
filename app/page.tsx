import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface DashboardCase {
  id: string;
  status: string;
  created_at: string;
  clients: { full_name: string; employment_type: string } | null;
  document_items: { status: string }[];
  loan_eligibilities: { max_loan_amount: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  "in-review": "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function formatMYR(n: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, status, created_at, clients(full_name, employment_type), document_items(status), loan_eligibilities(max_loan_amount)")
    .order("created_at", { ascending: false })
    .returns<DashboardCase[]>();

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mortgage Case Review</h1>
          <p className="text-sm text-neutral-500 mt-1">Shared team dashboard — no login required.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/banks" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
            Manage Banks
          </Link>
          <Link
            href="/cases/new"
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors"
          >
            + New Case
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">
          Unable to reach database. Please try again.
        </div>
      )}

      {!error && cases && cases.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-neutral-500">No cases yet. Create your first case.</p>
          <Link href="/cases/new" className="inline-block mt-4 text-sm font-medium text-neutral-900 underline">
            + New Case
          </Link>
        </div>
      )}

      {!error && cases && cases.length > 0 && (
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Highest Max Loan</th>
                <th className="px-4 py-3 font-medium">Docs Complete</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const total = c.document_items.length;
                const received = c.document_items.filter((d) => d.status === "received").length;
                const pct = total > 0 ? Math.round((received / total) * 100) : 0;
                const highestMaxLoan = c.loan_eligibilities.length > 0 ? Math.max(...c.loan_eligibilities.map((e) => e.max_loan_amount)) : null;
                return (
                  <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/cases/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                        {c.clients?.full_name ?? "Unknown client"}
                      </Link>
                      <div className="text-xs text-neutral-400 capitalize">{c.clients?.employment_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status] ?? "bg-neutral-100 text-neutral-700"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{formatMYR(highestMaxLoan)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-neutral-500 text-xs">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
