import type { TallyResult, TallyStatus } from "@/lib/mortgage/tally";

const STATUS_ICON: Record<TallyStatus, string> = { ok: "✅", warn: "⚠️", fail: "❌" };

const STATUS_STYLE: Record<TallyStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50",
  warn: "border-amber-200 bg-amber-50",
  fail: "border-red-200 bg-red-50",
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthName(m: string) {
  return MONTH_NAMES[Number(m)] ?? m;
}

/** Cross-document consistency checks (IC completeness, EPF-vs-payslip with one-month lag) — computed server-side from the AI-extracted document data. */
export default function TallyPanel({ tally }: { tally: TallyResult }) {
  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2 text-sm ${STATUS_STYLE[tally.ic.status]}`}>
        <span className="font-medium">{STATUS_ICON[tally.ic.status]} IC</span> <span className="text-neutral-700">— {tally.ic.detail}</span>
      </div>

      <div className={`rounded-md border px-3 py-2 text-sm ${STATUS_STYLE[tally.epf.status]}`}>
        <div className="font-medium mb-1">
          {STATUS_ICON[tally.epf.status]} EPF contributions vs payslip deductions
          <span className="font-normal text-neutral-500"> (payslip month → statement month +1)</span>
        </div>
        <p className="text-xs text-neutral-700 mb-1">
          {STATUS_ICON[tally.epf.statementType.status]} Statement type: {tally.epf.statementType.detail}
        </p>
        {tally.epf.detail && <p className="text-neutral-700">{tally.epf.detail}</p>}
        {tally.epf.months.length > 0 && (
          <ul className="space-y-0.5">
            {tally.epf.months.map((m) => (
              <li key={`${m.payslipFile}-${m.payslipMonth}`} className="text-xs text-neutral-700">
                {STATUS_ICON[m.status]} {monthName(m.payslipMonth)} payslip → {monthName(m.expectedStatementMonth)} statement:{" "}
                {m.detail ?? m.checks.map((c) => `${STATUS_ICON[c.status]} ${c.detail}`).join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
