"use client";

import { useActionState, useState } from "react";
import { createSubmissionAndTally, type TallyActionState } from "@/lib/actions/tally";

const SOURCE_FORMATS = [
  { value: "", label: "Auto-detect" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "pdf-copy", label: "PDF copy-paste" },
  { value: "other", label: "Other" },
];

export default function NewTallyForm() {
  const [state, formAction, pending] = useActionState<TallyActionState, FormData>(
    createSubmissionAndTally,
    {},
  );
  const [rawInput, setRawInput] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="raw_input" className="block text-sm font-medium text-neutral-900">
          Raw client info <span className="text-red-600">*</span>
        </label>
        <textarea
          id="raw_input"
          name="raw_input"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={10}
          placeholder={"Paste whatever the agent sent — the filled form, or a loose message like:\nName: Nurul Aina binti Rahman\nIC 900512-10-3344, HP 017-5566778, email aina@gmail.com\nkerja di Petronas, salary RM7300, married 2 kids…\n\nIt will be converted into your standard template; anything not found is marked ⚠️."}
          className="mt-1 w-full rounded-lg border border-neutral-300 p-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="agent_name" className="block text-sm font-medium text-neutral-900">
            Agent name
          </label>
          <input
            id="agent_name"
            name="agent_name"
            type="text"
            placeholder="e.g. Sara Tan"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="agent_agency" className="block text-sm font-medium text-neutral-900">
            Agency
          </label>
          <input
            id="agent_agency"
            name="agent_agency"
            type="text"
            placeholder="e.g. IQI Realty"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="source_format" className="block text-sm font-medium text-neutral-900">
            Source format
          </label>
          <select
            id="source_format"
            name="source_format"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          >
            {SOURCE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || rawInput.trim().length === 0}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Running tally…" : "Run Tally"}
        </button>
      </div>
    </form>
  );
}
