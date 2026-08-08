// Completeness scoring (docs/PRD.md): % of template fields filled.
// PRD success scenario fixes the formula: 12 of 15 filled → 80%, officer fills
// 2 more → 14/15 → 93%. A field counts as filled when it has a value and its
// review_status is not "missing".

export interface ScorableEntry {
  extracted_value: string | null;
  review_status: string;
  is_required: boolean;
}

export function computeCompleteness(entries: ScorableEntry[]): number {
  if (entries.length === 0) return 0;
  const filled = entries.filter(
    (e) => e.extracted_value !== null && e.extracted_value !== "" && e.review_status !== "missing",
  ).length;
  return Math.round((filled / entries.length) * 100);
}

export function missingRequiredCount(entries: ScorableEntry[]): number {
  return entries.filter(
    (e) => e.is_required && (e.review_status === "missing" || e.extracted_value === null || e.extracted_value === ""),
  ).length;
}
