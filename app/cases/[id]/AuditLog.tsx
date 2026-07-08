import type { AuditLog as AuditLogRow } from "@/lib/mortgage/types";

const ACTION_LABELS: Record<string, string> = {
  calculation_run: "Calculation run",
  status_change: "Status changed",
};

export default function AuditLog({ logs }: { logs: AuditLogRow[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-neutral-500">No activity logged yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="rounded-md border border-neutral-200 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-900">{ACTION_LABELS[log.action] ?? log.action}</span>
            <span className="text-xs text-neutral-400">
              {new Date(log.created_at).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
              {log.performed_by ? ` · ${log.performed_by}` : ""}
            </span>
          </div>
          {(log.before_value != null || log.after_value != null) && (
            <details className="mt-1">
              <summary className="text-xs text-neutral-500 cursor-pointer">Details</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <div className="text-xs font-medium text-neutral-400">Before</div>
                  <pre className="text-xs bg-neutral-50 rounded p-2 overflow-x-auto">{JSON.stringify(log.before_value, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-400">After</div>
                  <pre className="text-xs bg-neutral-50 rounded p-2 overflow-x-auto">{JSON.stringify(log.after_value, null, 2)}</pre>
                </div>
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
