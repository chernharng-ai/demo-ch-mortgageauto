export interface TemplateField {
  id: string;
  template_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Submission {
  id: string;
  template_id: string;
  client_name: string | null;
  agent_name: string | null;
  agent_agency: string | null;
  raw_input: string;
  source_format: string | null;
  status: string; // pending | reviewed | finalized
  completeness_score: number;
  created_at: string;
}

export interface TallyEntry {
  id: string;
  submission_id: string;
  template_field_id: string;
  extracted_value: string | null;
  source: string | null; // rule-match | manual | ai-extract | missing
  confidence: number | null;
  review_status: string; // unreviewed | confirmed | missing | uncertain
  created_at: string;
}

export type EntryWithField = TallyEntry & { template_fields: TemplateField };
