const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  "in-review": "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function CaseStatusControl({ status }: { caseId: string; status: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-700"}`}>
      {status}
    </span>
  );
}
