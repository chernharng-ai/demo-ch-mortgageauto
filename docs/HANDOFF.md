# HANDOFF — demo-ch-mortgageauto (paste this whole file to your coding agent)

You are continuing an EXISTING, WORKING, DEPLOYED app. Do not rebuild anything from
scratch. Read this file fully before writing a line of code. The owner is a Malaysian
mortgage officer; the standing rule for the whole project is:

> **"We are a professional mortgage firm — 0 mistakes."** Every bank parameter follows
> the owner's Google Drive "bank guideline" sheet exactly, to the decimal. Never guess a
> figure; if a document doesn't show it, flag it for the officer instead.

## 1. What the app does (already built and live)

Auto Mortgage Loan Case Review System. The officer creates a case, drag-drops the
client's PDFs, and the app — with **zero manual clicks** in between — does all of this:

1. AI reads, classifies, and renames every document (payslips, bank statements, EPF
   statement, EA/BE forms, IC, CTOS/Experian credit report, offer letter, etc.).
2. Ticks a document checklist with per-month chips (`1✅ 2✅ 3⚠️ …`).
3. Tallies documents against each other (EPF vs payslips, salary crediting vs bank
   statements, IC front+back).
4. Derives income (basic + fixed allowances + variable average) using the standard
   Malaysian statutory payroll calculation.
5. Auto-reads existing commitments from the CCRIS section of the credit report.
6. Calculates max loan eligibility for all 17 banks — 90% package AND 100%/SJKP package
   — checking BOTH DSR and NDI (both must pass; lower wins).
7. Auto-fills a copy-pasteable Case Review Note in the officer's exact template.
8. Bundles a bank-submission ZIP with files renamed to the officer's convention.

Live production URL: https://demo-ch-mortgageauto.vercel.app
Reference test case (real, verified end-to-end): client SYAKILA, case id
`789fe6af-d6a8-46ef-859a-4ed847fbb72e` — expected numbers in §9.

## 2. Stack & infra (already provisioned — do not re-provision)

- Next.js 15 App Router + Server Actions, Tailwind v4, TypeScript, Bun as runtime/PM.
- Supabase (Postgres + Storage bucket `client-documents`). Schema lives in
  `supabase/migrations/0001…0015`. **Never edit an existing migration** — add
  `0016_*.sql` and apply it via the Supabase Management API:
  ```
  curl -X POST "https://api.supabase.com/v1/projects/uzhntruokzpnhobwtqoj/database/query" \
    -H "Authorization: Bearer <SUPABASE_MANAGEMENT_TOKEN>" \
    -H "Content-Type: application/json" -d '{"query":"<SQL here>"}'
  ```
  (Token is with the owner; ask them for it — do not commit it.)
- Claude API for document reading (key in env `ANTHROPIC_API_KEY`).
- Vercel deploys **from git only**: `git add -A && git commit && git push` to `main`.
  NEVER run `vercel deploy`/`vercel --prod` — it desyncs git. Pull env with
  `vercel link` + `vercel env pull .env.local`.
- Git identity must be the GitHub account or Vercel rejects the deploy:
  `git config user.email "301185589+chernharng-ai@users.noreply.github.com"`,
  `git config user.name "chernharng-ai"`.
- No login wall in v1 — the homepage IS the app. Auth is a later "lock it down" sprint.
- `next.config.ts` has `serverActions.bodySizeLimit: "50mb"` (uploads 500'd at the 1 MB
  default — keep it).

## 3. File map (where everything lives)

Domain logic — all pure, all unit-testable with `bun run <script>`:

| File | Responsibility |
|---|---|
| `lib/mortgage/extraction.ts` | Claude structured-output document reading. Model `claude-sonnet-5`, max_tokens 8192, retry ×2 with loud `console.error` logging. `DocumentExtraction` flat interface; API limits schemas to 16 union-typed params, so payslip figures are a nested `payslip_figures` object with `-1` sentinels, unpacked by `normalizeRawExtraction`. Classification is by CATEGORY (a 1-month payslip matches "3 months payslip"). Bank statements: extract EVERY incoming-credit row, no filtering/judgment. `classifyByFilename` fallback; `buildStorageFileName`. |
| `lib/mortgage/payroll.ts` | Statutory deductions per payroll.my: EPF Third Schedule banding (RM20 bands ≤5,000, RM100 bands to 20,000, ceil wage to band top, employee 11%), SOCSO 0.5% / EIS 0.2% on band midpoints with RM6,000 ceiling (max 29.75 / 11.90). `nettBasicPay(gross)` → {epf, socso, eis, pcb, nettBasic}. |
| `lib/mortgage/pcb.ts` | Monthly PCB: RM9,000 individual relief, EPF relief min(11%×annual, RM5,000), standard cumulative brackets. The owner's "pcb calculation formula" sheet has a confirmed bug in its Annual Tax column — the standard calculation is authoritative. |
| `lib/mortgage/consolidate.ts` | `consolidatePayslipIncome` → basic = LATEST month's gross basic; nett basic via `nettBasicPay` (**never** the payslip's printed deductions — "bank do not follow payslip calculation"); fixed allowances = allowances identical on every slip; variable = average of commission + non-fixed allowances over the 3- or 6-month window (6 if `has_variable_income`); flags missing window months. |
| `lib/mortgage/commitments.ts` | `deriveCommitments` from the credit report's CCRIS list: latest report by printed `report_date` ONLY (never mix two reports); loans at instalment; credit cards/overdrafts at 5% of outstanding; same facility-type+lender grouped into ONE `CF n :` line with balances shown `a + b = total`; card usage % vs limit with `‼️` above 60% + flag "ask client to reduce before submission"; missing figures → flag, never guess. |
| `lib/mortgage/tally.ts` | `runDocumentTally`: IC front+back; EPF — must be the 2-year DETAILED transaction statement (totals-only = wrong document → flag + checklist stays ⚠️), every figure tallies separately (employee AND employer AND total, RM2 tolerance) with a ONE-MONTH LAG (Jan payslip deduction appears in Feb statement), duplicate months prefer the recent year; salary crediting — payslip nett pay AND salary advance must appear as deposits in month M or the first 7 days of M+1 (year-wrap handled), only FAIL if that month's own statement was uploaded. |
| `lib/mortgage/calc.ts` | `computePackageEligibility`: DSR and NDI BOTH must pass, take the lower instalment. Per-bank `calc_params` in the `banks` table: `dsr_tiers` (income-tiered, with `non_urban` / `under_construction` variants), `ndi_floor` (single/joint/urban/property-price variants), `sjkp` (own DSR tiers, NDI, max-income and SPA caps — SPA cap recomputes the instalment), `income_basis` ("nett" for Maybank, Public Bank, AmBank, UOB, Al Rajhi, CIMB — they bracket DSR on nett; the rest on gross; NDI always uses nett), `income_rules` multipliers (bonus: HLB 0.8, RHB/Alliance/CIMB/Muamalat 1.0, Maybank 0.7, Bank Rakyat 0.5, others 0.8; ASB 1.0; FD saving 1.0; rental per bank). Known NDI specifics: Public Bank 1,700; Maybank SRB 1,300 if client stays/works in KL or Selangor, 1,000 elsewhere. |
| `lib/mortgage/checklistTemplate.ts` | Checklist taxonomy + `expectedPeriodLabels`: payslips/bank statements → 3 or 6 months counting back from the month BEFORE application (string month math, no Date timezone bugs); EPF → 2 year-chips [appYear−1, appYear]; items explicitly named "6 months" always get 6. |
| `lib/mortgage/submissionNaming.ts` | ZIP naming: `P{month}` payslip, `B{month}` bank statement, `EPF {yy}`, `EA {yy}`, `BE {yy}`, `1.CTOS ({MM-DD-YYYY})` / `1.EXP({date})` using the report's printed date (fallback upload date), `IC`, `EVL` valuation, `EOL` offer letter, `2.Booking Form`; duplicates get `(2)`; no slashes in names. |
| `lib/mortgage/autoReview.ts` | `buildReviewAutoFill`: age from IC YYMMDD vs application date; gross/nett income sums (nett uses `nett_amount ?? monthly gross`); max allowed commitment = nett × 0.5; commitment breakdown = CF lines + Total; attention = "EXCEEDS max allowed ‼️" + all pipeline/tally flags; bank list = top-5 non-zero 90% results (+SJKP) + "N other banks : RM 0". |
| `lib/mortgage/reviewNote.ts` | Renders the officer's review-note template + doc checklist groups. |

Server actions:

- `lib/actions/documents.ts` — `bulkUploadDocuments` / `retryExtraction` /
  `assignDocumentMatch`. Every path runs the **autopilot chain**:
  `seedExpectedPeriodChips` → match (gated by `!isWrongEpfStatement`) → tick chips →
  `rederiveAndCalculate`. `updateCaseChecklistProfile` regenerates the checklist
  (additively) when case-profile selectors change.
- `lib/actions/income.ts` — `applyConsolidatedIncome` (replaces rows with sources
  `claude_vision_extraction`/`payslip_consolidation`; writes `nett_amount`),
  `applyCreditCommitments` (replaces `source='credit_report'` rows),
  `rederiveAndCalculate` = commitments → income → `runCalculations`. Manual income
  entry allows ONLY: rental, bonus, FD saving, ASB (salary is always auto-derived).
- `lib/actions/cases.ts` — `deleteCase` must remove storage files and ALL dependents
  including `audit_logs` (FK blocks otherwise).
- `lib/actions/review.ts` — saves `review_*` fields; saved edits always beat auto-fill.

UI (`app/cases/[id]/`): page section order is Case Profile → Document Checklist →
Document Tally → Income Entries (ConsolidatedIncome + IncomeEntries) → Existing
Commitments → Bank Eligibility → CaseSummary → CaseReviewNote → Activity Log.
Checklist rows are glance-simple: status icon cycles pending→received→missing, month
chips, "report dated MM-DD-YYYY" on credit reports, unmatched files get an assign
dropdown + "Retry AI reading" button. Desktop fixed sidebar + mobile hamburger
(`app/AppShell.tsx`).

## 4. Case profile options

- Property: subsales vs under-construction; urban location matters for DSR/NDI tiers.
- Financing scheme: bank loan vs LPPSA (LPPSA is the separate government-servant
  scheme — but ALWAYS still compute bank eligibility so the officer can compare).
- Application date defaults to today; drives all month windows.
- `has_variable_income` toggles 3-month vs 6-month document windows and averaging.
- Applicant type single/joint; both 90% and SJKP-100% packages always computed.

## 5. Checklist taxonomy (owner-specified)

Salary earner: IC, 3 or 6 months payslip, 3 or 6 months bank statement, EPF 2-year
detailed statement, EA form, Income Tax (BE form) — these are TWO different documents —
CTOS report, Experian report. Self-employed: SSM, 6 months company + personal bank
statements, Form B + tax receipts, etc. Extras appended by flags: overseas docs,
subsales docs (SPA, valuation…), site-visit photos, rental income docs (tenancy +
crediting statements), LPPSA list. Seeded rows are placeholders the officer can
add/remove; `seedExpectedPeriodChips` self-heals deleted month chips.

## 6. Non-negotiable domain rules (each was an explicit owner correction)

1. Nett basic pay = statutory calculation (payroll.my), never payslip-printed totals.
2. EPF tally: 546 must tally AND 645 must tally AND 1191 must tally — every figure
   separately; a combined-totals-only statement is the WRONG document.
3. Salary crediting must be proven against the bank statement, with the credit dates
   shown.
4. Both DSR and NDI must pass; whichever gives the lower loan wins. SJKP has its own
   parameter set and caps.
5. Latest credit report only; commitments per the CF grouping/5% rules above.
6. Everything the pipeline computes flows into the review note automatically; the
   officer only types judgment calls (risk level, approval chance, addresses, notes).
7. All bank numbers come from the owner's "bank guideline" sheet — if a new bank rule
   is needed, ASK the owner, don't infer.

## 7. Verification workflow (browser preview was unavailable; this pattern is proven)

After every change:
1. `bunx tsc --noEmit`
2. `rm -rf .next supabase/.temp && bun run build` (never run two builds concurrently —
   it corrupts `.next`)
3. For domain logic: write a throwaway bun script with HAND-CHECKED expected values and
   run it (see reference numbers in §9). Zero-mistake rule: independently recompute,
   then compare.
4. Commit + push (correct git identity!), poll `vercel ls demo-ch-mortgageauto` until
   `● Ready`.
5. `curl` the production case page and assert the expected strings with a small Python
   check. Gotcha: React splits text nodes with `<!-- -->` comments — strip comments
   before string-matching, or grep pieces separately.

Shell gotchas: `status` is a read-only zsh variable — don't use it in scripts.

## 8. Claude extraction contract (do not regress these)

- Model `claude-sonnet-5` (Haiku misread payslip/statement table columns — real money
  errors; do not downgrade).
- `output_config: {format: {type: "json_schema", schema}}`; schema must keep ≤16
  union-typed parameters (hence nested `payslip_figures` + `-1` sentinels +
  `normalizeRawExtraction`).
- max_tokens 8192 (CTOS reports truncated at 4096).
- Parse failures must LOG loudly (stop_reason included) and retry once — a silent null
  once hid a wrong tally result.
- Bank statements: list every deposit row verbatim; classification by category.

## 9. Reference case — regression numbers (case 789fe6af-d6a8-46ef-859a-4ed847fbb72e)

- IC 921113136366 → age 33 (at application date 2026-07).
- Income: basic gross 2,924 → nett basic 2,561.28 (EPF 324, SOCSO 14.75, EIS 5.90,
  PCB 18.07); fixed allowances 800 + 1,130; variable average 814.63; gross total
  5,668.63; nett total 5,305.91; flag "Jan payslip missing".
- `epfEmployee(5100) = 561` (matches her real employer's deduction).
- EPF tally: 15/15 figures match. Salary crediting: Mar 4,560.41 @03-27,
  Apr 5,400.46 @04-28, May 5,153.49 @05-28 — all ✅.
- Commitments: CF 1–7 from CTOS totaling 4,069.80/mo; CF 4 CIMB credit card usage
  131.5% ‼️ (6,574 outstanding on 5,000 limit).
- Max allowed commitment 2,652.96 → attention shows "Commitment 4,069.80 EXCEEDS max
  allowed 2,652.96 ‼️". Top bank at 90%: Alliance RM 49,890 (was 909,847 before
  commitments — the collapse is CORRECT).

If a refactor changes any of these numbers, the refactor is wrong.

## 10. Backlog (agreed with owner, not yet built)

1. HLB/RHB ASB current-value formulas (officer currently enters the annual equivalent
   manually).
2. Settlement-scenario simulation — "what if client settles TR + restructures PTPTN":
   pick commitments to remove, recompute all eligibility side-by-side.
3. Credit-report staleness warning (report date too old vs application date — ask owner
   for the cutoff before building).
4. "Lock it down" sprint: login/signup + per-user data isolation (LAST, before real
   client data).

## 11. Working style the owner expects

- Full automation: never add a manual step between upload and results.
- When done, SAY done only after production verification passed — the owner checks.
- When a document is ambiguous or a figure is missing: flag ⚠️ on the checklist and in
  the panel, never silently guess.
- Malaysian context throughout: RM formatting `1,234.56`, CCRIS/CTOS/Experian, SJKP,
  LPPSA, EPF/SOCSO/EIS/PCB.
