"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCase, type CreateCaseState } from "@/lib/actions/cases";

const initialState: CreateCaseState = {};

export default function NewCaseForm() {
  const [state, formAction, pending] = useActionState(createCase, initialState);

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mt-2 mb-1">New Case</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Create a client + case, then enter income details to review max loan eligibility across every configured
        bank. A document checklist is generated automatically from each bank&apos;s requirements.
      </p>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">{state.error}</div>
      )}

      <form action={formAction} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-neutral-900">Client</legend>

          <Field label="Full name" name="full_name" error={state.fieldErrors?.full_name} required>
            <input
              type="text"
              name="full_name"
              placeholder="Ahmad bin Ali"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </Field>

          <Field label="IC number" name="ic_number">
            <input
              type="text"
              name="ic_number"
              placeholder="850101-14-5678"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </Field>

          <Field label="Employment type" name="employment_type">
            <select
              name="employment_type"
              defaultValue="employed"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="employed">Employed</option>
              <option value="self-employed">Self-employed</option>
              <option value="commission">Commission-based</option>
            </select>
          </Field>

          <Field label="Employer name" name="employer_name">
            <input
              type="text"
              name="employer_name"
              placeholder="Petronas"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-neutral-900">Case</legend>

          <Field label="Notes" name="notes">
            <textarea
              name="notes"
              rows={3}
              placeholder="First property purchase..."
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </Field>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Case"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={name} className="block">
      <span className="block text-sm text-neutral-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}
