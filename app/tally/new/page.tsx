import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";
import type { TemplateField } from "@/lib/tally/types";
import NewTallyForm from "./NewTallyForm";
import SetupNotice from "../SetupNotice";

export const dynamic = "force-dynamic";

export default async function NewTallyPage() {
  if (!supabaseConfigured()) return <SetupNotice />;
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("templates")
    .select("id, name, description, template_fields(id, field_label, is_required, sort_order)")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const fields = ((template?.template_fields ?? []) as Pick<TemplateField, "id" | "field_label" | "is_required" | "sort_order">[]).sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/tally" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Tally Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-neutral-900">New Tally</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Paste the raw client info exactly as the agent sent it. The system tallies it against the
          standard template and flags missing fields.
        </p>
      </div>

      {!template || fields.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No active template — ask team lead to configure one.
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-900">{template.name}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {fields.length} fields · {fields.filter((f) => f.is_required).length} required:{" "}
              {fields.map((f) => f.field_label).join(", ")}
            </p>
          </div>
          <NewTallyForm />
        </>
      )}
    </main>
  );
}
