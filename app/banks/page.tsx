import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/profile";
import type { Bank } from "@/lib/mortgage/types";
import BankEditor from "./BankEditor";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/banks");
  }

  const supabase = await createClient();
  const { data: banks, error } = await supabase.from("banks").select("*").order("name").returns<Bank[]>();
  const canEdit = user.role === "admin";

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mt-2 mb-1">Bank Configuration</h1>
      <p className="text-sm text-neutral-500 mb-8">
        {canEdit
          ? "Edit each bank's DSR limit, stress rate, income multipliers, and required documents. Changes apply the next time a case's calculation is run."
          : "Only admins can edit bank configuration. You can view the current parameters below."}
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">
          Unable to reach database. Please try again.
        </div>
      )}

      {!error && banks && (
        <div className="space-y-6">
          {banks.map((bank) => (
            <BankEditor key={bank.id} bank={bank} canEdit={canEdit} />
          ))}
        </div>
      )}
    </main>
  );
}
