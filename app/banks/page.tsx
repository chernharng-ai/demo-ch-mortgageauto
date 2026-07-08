import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bank } from "@/lib/mortgage/types";
import BankEditor from "./BankEditor";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const supabase = await createClient();
  const { data: banks, error } = await supabase.from("banks").select("*").order("name").returns<Bank[]>();

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mt-2 mb-1">Bank Configuration</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Edit each bank&apos;s DSR limit, stress rate, income multipliers, and required documents. Changes apply the next
        time a case&apos;s calculation is run.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">
          Unable to reach database. Please try again.
        </div>
      )}

      {!error && banks && (
        <div className="space-y-6">
          {banks.map((bank) => (
            <BankEditor key={bank.id} bank={bank} />
          ))}
        </div>
      )}
    </main>
  );
}
