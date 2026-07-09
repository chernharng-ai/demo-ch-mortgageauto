import type { BankCalcParams } from "./calc";

export interface Bank {
  id: string;
  name: string;
  calc_params: BankCalcParams;
  doc_requirements: string[];
  created_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  ic_number: string | null;
  employment_type: string;
  employer_name: string | null;
  created_at: string;
}

export type CaseStatus = "draft" | "in-review" | "approved" | "rejected";

export type SummaryStatus = "none" | "draft" | "accepted" | "dismissed";

export interface Case {
  id: string;
  client_id: string;
  status: CaseStatus;
  property_value: number | null;
  loan_tenure_years: number;
  notes: string | null;
  ai_summary: string | null;
  ai_summary_status: SummaryStatus;
  created_at: string;
}

export type IncomeType = "basic" | "allowance" | "commission" | "rental" | "net_profit" | "other";
export type Frequency = "monthly" | "annual";

export type ReviewStatus = "unreviewed" | "accepted" | "overridden";

export interface IncomeEntry {
  id: string;
  case_id: string;
  income_type: IncomeType;
  gross_amount: number;
  frequency: Frequency;
  supporting_doc: string | null;
  ai_suggested_type: IncomeType | null;
  ai_suggested_type_source: string | null;
  ai_suggested_type_confidence: number | null;
  ai_suggested_type_review_status: ReviewStatus;
  created_at: string;
}

export type DocStatus = "pending" | "received" | "missing";

export type ExtractionStatus = "none" | "pending" | "done" | "unavailable";

export interface DocumentItem {
  id: string;
  case_id: string;
  bank_id: string | null;
  doc_name: string;
  status: DocStatus;
  received_at: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  ai_extracted_data: import("./extraction").DocumentExtraction | null;
  ai_extraction_status: ExtractionStatus;
  created_at: string;
}

export interface CaseDocument {
  id: string;
  case_id: string;
  file_path: string;
  file_name: string;
  original_file_name: string;
  mime_type: string | null;
  matched_doc_name: string | null;
  ai_extracted_data: import("./extraction").DocumentExtraction | null;
  ai_extraction_status: ExtractionStatus;
  created_at: string;
}

export interface IncomeCalculation {
  id: string;
  case_id: string;
  bank_id: string;
  eligible_income: number;
  method_snapshot: Record<string, unknown>;
  calculated_by: string | null;
  created_at: string;
}

export type EligibilityStatus = "eligible" | "marginal" | "ineligible";

export interface LoanEligibility {
  id: string;
  case_id: string;
  bank_id: string;
  max_loan_amount: number;
  monthly_instalment: number;
  dsr_ratio: number;
  eligibility_status: EligibilityStatus;
  created_at: string;
}

export interface AuditLog {
  id: string;
  case_id: string | null;
  action: string;
  performed_by: string | null;
  before_value: unknown;
  after_value: unknown;
  created_at: string;
}
