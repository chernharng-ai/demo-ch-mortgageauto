"use client";

import { useState } from "react";
import { TEMPLATE_LANGS, type TemplateLang } from "@/lib/tally/standardTemplate";

export default function CopyTemplatePanel({
  texts,
  missingCount,
}: {
  texts: Record<TemplateLang, string>;
  missingCount: number;
}) {
  const [lang, setLang] = useState<TemplateLang>("en");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(texts[lang]);
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
              : `${missingCount} field${missingCount === 1 ? "" : "s"} not found — marked ⚠️. Send as-is to request the missing info.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-300 p-0.5">
            {TEMPLATE_LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  lang === l.code ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            {copied ? "Copied ✓" : "Copy for WhatsApp"}
          </button>
        </div>
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-neutral-800">
        {texts[lang]}
      </pre>
    </section>
  );
}
