// AI extraction layer (docs/TASKS.md Sprint 3): parses truly unstructured
// prose for fields the rule engine missed. The rule engine remains the
// fallback — this module is only invoked explicitly and degrades gracefully
// when ANTHROPIC_API_KEY is not configured.
import Anthropic from "@anthropic-ai/sdk";
import type { TemplateFieldInput } from "@/lib/tally/engine";

export interface AiFieldResult {
  field_key: string;
  value: string | null;
  confidence: number; // model-reported, 0–1
}

interface RawAiField {
  value: string | null;
  confidence: number;
}

function buildSchema(fieldKeys: string[]) {
  const fieldSchema = {
    type: "object",
    properties: {
      value: {
        type: ["string", "null"],
        description: "The extracted value as written in the text, or null if genuinely absent. Never guess.",
      },
      confidence: { type: "number", description: "0 to 1" },
    },
    required: ["value", "confidence"],
    additionalProperties: false,
  };
  return {
    type: "object",
    properties: Object.fromEntries(fieldKeys.map((k) => [k, fieldSchema])),
    required: fieldKeys,
    additionalProperties: false,
  };
}

/**
 * Extract the given fields from raw text with Claude. Returns one result per
 * requested field. Throws with a clear message when the API key is missing or
 * the call fails after a retry — callers surface that to the officer.
 */
export async function aiExtractFields(
  rawText: string,
  fields: TemplateFieldInput[],
): Promise<AiFieldResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI extraction is not configured (ANTHROPIC_API_KEY missing) — rule-based results are unaffected.",
    );
  }
  if (fields.length === 0) return [];

  const client = new Anthropic({ apiKey });
  const fieldList = fields
    .map((f) => `- ${f.field_key}: ${f.field_label} (${f.field_type})`)
    .join("\n");

  const prompt = `You are extracting mortgage application fields from raw client info a Malaysian property agent sent (WhatsApp/email/PDF paste). Field labels vary ("IC No" vs "NRIC" vs "MyKad"); text may be unstructured prose.

Extract ONLY these fields:
${fieldList}

Rules:
- Report values exactly as written (numbers without "RM"/commas; "520k" → "520000").
- employment_duration is in months (e.g. "4 years" → "48").
- If a field is not present in the text, value = null with confidence 0. NEVER guess or invent.
- confidence: 0.9+ only when explicit and unambiguous, 0.5–0.7 when inferred from context.

Raw client info:
"""
${rawText}
"""`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: { type: "json_schema", schema: buildSchema(fields.map((f) => f.field_key)) },
        },
      } as Parameters<typeof client.messages.create>[0]);

      const block = "content" in response ? response.content.find((b) => b.type === "text") : null;
      if (!block || block.type !== "text") {
        throw new Error(`AI returned no text block (stop_reason: ${"stop_reason" in response ? response.stop_reason : "unknown"})`);
      }
      const parsed = JSON.parse(block.text) as Record<string, RawAiField>;
      return fields.map((f) => {
        const r = parsed[f.field_key];
        const value = r?.value?.trim() || null;
        return {
          field_key: f.field_key,
          value,
          confidence: value ? Math.max(0, Math.min(1, r?.confidence ?? 0)) : 0,
        };
      });
    } catch (error) {
      lastError = error;
      console.error(`aiExtractFields attempt ${attempt} failed:`, error);
    }
  }
  throw new Error(
    `AI extraction failed after retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
