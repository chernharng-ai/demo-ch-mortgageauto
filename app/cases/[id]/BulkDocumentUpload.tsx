"use client";

import { useRef, useState, useTransition } from "react";
import { bulkUploadDocuments, type BulkUploadResult } from "@/lib/actions/documents";
import ExtractionSummary from "./ExtractionSummary";

export default function BulkDocumentUpload({ caseId, candidateDocNames }: { caseId: string; candidateDocNames: string[] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<BulkUploadResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));
    startTransition(async () => {
      const res = await bulkUploadDocuments(caseId, formData);
      setResults((prev) => [...res, ...prev]);
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-400"
        }`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <p className="text-sm text-neutral-600">
          {isPending ? "Reading documents…" : "Drag & drop all client documents here, or click to choose files"}
        </p>
        <p className="text-xs text-neutral-400 mt-1">Any file type accepted — each one is auto-classified, renamed, and filed against the checklist.</p>
      </div>

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r, i) => (
            <ResultRow key={`${r.caseDocumentId}-${i}`} caseId={caseId} result={r} candidateDocNames={candidateDocNames} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ caseId, result, candidateDocNames }: { caseId: string; result: BulkUploadResult; candidateDocNames: string[] }) {
  return (
    <li className="rounded-md border border-neutral-200 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-neutral-700">{result.originalFileName}</span>
        {result.matchedDocName ? (
          <span className="text-emerald-700">→ {result.matchedDocName}</span>
        ) : result.error ? (
          <span className="text-red-600">{result.error}</span>
        ) : (
          <span className="text-amber-700">Uploaded — couldn&apos;t match ({candidateDocNames.length} checklist items to choose from below)</span>
        )}
      </div>
      {result.extraction && <ExtractionSummary caseId={caseId} extraction={result.extraction} sourceLabel={result.originalFileName} />}
    </li>
  );
}
