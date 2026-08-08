"use client";

import { useState } from "react";

export default function CopyTemplatePanel({ text, missingCount }: { text: string; missingCount: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (http / permissions) — user can select manually
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-neutral-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Standard Template — ready to send</h2>
          <p className="text-xs text-neutral-500">
            {missingCount === 0
              ? "All fields filled."
              : `${missingCount} field${missingCount === 1 ? "" : "s"} not found — marked ⚠️. Edit below or send as-is to request the missing info.`}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          {copied ? "Copied ✓" : "Copy for WhatsApp"}
        </button>
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-neutral-800">
        {text}
      </pre>
    </section>
  );
}
