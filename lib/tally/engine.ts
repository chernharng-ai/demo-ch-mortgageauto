// Rule-based tally engine: matches raw pasted client info against the active
// template's fields using keyword/regex heuristics. Pure module — no DB, no
// network — so it can be unit-tested with a bun script (docs/ARCHITECTURE.md
// "Why Core Works Without AI").
//
// Confidence convention (docs/INTELLIGENCE_LAYER.md): 0.9 exact label match,
// 0.6 fuzzy/inferred. Multiple candidate values for one field → first match
// wins but review_status becomes "uncertain" (docs/TEST_PLAN.md).

export interface TemplateFieldInput {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
}

export interface TallyMatch {
  template_field_id: string;
  field_key: string;
  extracted_value: string | null;
  source: "rule-match" | "missing";
  confidence: number;
  review_status: "unreviewed" | "uncertain" | "missing";
}

interface Extractor {
  extract: (text: string) => { value: string; confidence: number; ambiguous?: boolean } | null;
}

const AMOUNT = String.raw`(?:RM\s*)?([\d,]+(?:\.\d+)?)\s*([km])?\b`;

function parseAmount(num: string, suffix?: string): number {
  let n = parseFloat(num.replace(/,/g, ""));
  if (suffix?.toLowerCase() === "k") n *= 1_000;
  if (suffix?.toLowerCase() === "m") n *= 1_000_000;
  return n;
}

function labeledAmount(text: string, labels: string[], opts?: { min?: number; max?: number }): { value: string; confidence: number; ambiguous?: boolean } | null {
  const found: number[] = [];
  for (const label of labels) {
    const re = new RegExp(String.raw`${label}[^\S\n]*(?:[:=\-]|of)?[^\S\n]*` + AMOUNT, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseAmount(m[1], m[2]);
      if (opts?.min !== undefined && n < opts.min) continue;
      if (opts?.max !== undefined && n > opts.max) continue;
      found.push(n);
    }
    if (found.length > 0) break; // first label tier that hits wins
  }
  if (found.length === 0) return null;
  const distinct = [...new Set(found)];
  return { value: String(distinct[0]), confidence: 0.9, ambiguous: distinct.length > 1 };
}

/**
 * Titlecase-ish value capture after a label. The label matches
 * case-insensitively, but the value pattern is applied case-SENSITIVELY at the
 * position right after the label — otherwise `[A-Z]` name patterns match
 * lowercase prose and capture junk.
 */
function labeledText(text: string, labels: string[], valuePattern: string, confidence = 0.9): { value: string; confidence: number; ambiguous?: boolean } | null {
  for (const label of labels) {
    // Lookbehinds keep the label from matching inside a longer compound label
    // ("Name" inside "Company Name:", "email" inside "HR Company Email").
    const labelRe = new RegExp(String.raw`(?<![A-Za-z])(?<![A-Za-z][ \t])${label}[^\S\n]*[:=\-]?[^\S\n]*`, "gi");
    let lm: RegExpExecArray | null;
    while ((lm = labelRe.exec(text)) !== null) {
      const valueRe = new RegExp(String.raw`^(${valuePattern})`);
      const vm = text.slice(lm.index + lm[0].length).match(valueRe);
      if (vm?.[1]) return { value: vm[1].trim().replace(/[.,;]+$/, ""), confidence };
    }
  }
  return null;
}

// No "." in the name char class — it would swallow sentence boundaries
// ("Ng Hui Ling. NRIC …" must stop at "Ling").
// "binti" before "bin": alternation is first-match, so "bin|binti" truncates
// "Amirah binti Hassan" to "Amirah bin".
const NAME_PATTERN = String.raw`[A-Z][A-Za-z@'\-]*(?:[ \t](?:a\/[lpk]|s\/o|d\/o|binti|bin|bte|bt|[A-Z][A-Za-z@'\-]*)){0,6}`;

const EXTRACTORS: Record<string, Extractor> = {
  applicant_name: {
    extract(text) {
      const labeled = labeledText(text, ["client name", "client", "applicant", "buyer name", "buyer", "name"], NAME_PATTERN);
      if (labeled) return labeled;
      // Fallback: leading name before an IC number ("Arjun Kumar a/k Santhosh, IC 850330-...")
      const m = text.match(new RegExp(String.raw`^\s*(${NAME_PATTERN})\s*,?\s*(?:\(?(?:IC|NRIC|MyKad)\b)`, "i"));
      if (m?.[1]) return { value: m[1].trim(), confidence: 0.6 };
      // Fallback: an unlabeled ALL-CAPS line with a Malaysian name particle
      // ("WAHIDAH BINTI RAJA SHUKRI AMRUN") — flagged uncertain for review.
      const capsLine = text
        .split("\n")
        .map((l) => l.trim().replace(/[.,;]+$/, ""))
        .find(
          (l) =>
            /^[A-Z][A-Z@'\-]*(?: [A-Z@'\-/][A-Z@'\-/]*){1,6}$/.test(l) &&
            /\b(?:BIN|BINTI|BTE|BT|A\/[LPK]|S\/O|D\/O)\b/.test(l) &&
            !/\b(?:JALAN|LORONG|TAMAN|BANDAR|PERSIARAN|LEBUH|SDN|BHD)\b/.test(l),
        );
      if (capsLine) return { value: capsLine, confidence: 0.6 };
      return null;
    },
  },
  nric: {
    extract(text) {
      const formatted = text.match(/\b(\d{6}-\d{2}-\d{4})\b/);
      if (formatted) return { value: formatted[1], confidence: 0.9 };
      const labeled = labeledText(text, ["NRIC", "IC no\\.?", "IC", "MyKad"], String.raw`\d{12}`, 0.9);
      if (labeled) return labeled;
      return null;
    },
  },
  date_of_birth: {
    extract(text) {
      const datePattern = String.raw`\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}`;
      const labeled = labeledText(text, ["DOB", "date of birth", "born(?:\\s+on)?", "birth\\s*date"], datePattern);
      if (labeled) return labeled;
      return null;
    },
  },
  marital_status: {
    extract(text) {
      // Malay statuses are kept as written (e.g. "Berkahwin", "Janda") — the
      // officer reads both; translating "janda" (widowed vs divorced) would be
      // guessing.
      const m = text.match(/\b(single|married|divorced|widowed|separated|berkahwin|kahwin|bujang|janda|duda)\b/i);
      if (!m) return null;
      const labeled = /marital|status|taraf|perkahwinan/i.test(text.slice(Math.max(0, m.index! - 30), m.index));
      const value = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      return { value, confidence: labeled ? 0.9 : 0.6 };
    },
  },
  monthly_income: {
    extract(text) {
      return labeledAmount(text, ["(?:monthly|gross|basic)?\\s*(?:income|salary)", "gaji", "earns?(?:\\s+about)?"], { min: 500, max: 500_000 });
    },
  },
  employer_name: {
    extract(text) {
      const pattern = String.raw`[A-Z][\w&'\-.]*(?:[ \t][A-Z(][\w&'\-.)]*){0,5}`;
      const hit = labeledText(text, ["employer", "works? (?:at|for|in|with)", "working (?:at|for|in|with)", "company", "kerja(?:\\s+d?i)?"], pattern);
      if (!hit) return null;
      // Trim trailing employment-duration fragments captured by the wide pattern
      const value = hit.value.replace(/\s+\d+\s*(?:\+\s*)?(?:years?|yrs?|months?|bulan|tahun).*$/i, "").trim();
      return value ? { ...hit, value } : null;
    },
  },
  employment_duration: {
    extract(text) {
      // "works at Petronas 4 years", "employed 18 months", "with company for 3 yrs"
      const m = text.match(/(?:work\w*|employ\w*|kerja|company|with\s+\w+)[^.\n,]{0,40}?(\d{1,2})\s*(\+\s*)?(years?|yrs?|tahun|months?|bulan)/i);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      const months = /month|bulan/i.test(m[3]) ? n : n * 12;
      return { value: String(months), confidence: 0.6 };
    },
  },
  property_address: {
    extract(text) {
      const streetPattern = String.raw`(?:No\.?\s*\d+[A-Za-z]?,?\s*)?(?:Jalan|Jln|Lorong|Lrg|Persiaran|Lebuh(?:raya)?|Taman|Bandar|Presint|Precinct)\b[^,.\n;]*(?:,\s*(?:Taman|Bandar|Kg\.?|Kampung|Desa|Bukit|Seksyen|Section)\b[^,.\n;]*)*`;
      // Comma continuation requires an uppercase start so location suffixes
      // ("Taman Setia Alam") extend the address but trailing prose
      // (", asking RM450k") does not.
      const labeled = labeledText(text, ["property(?:\\s+address)?(?:\\s+at)?", "address", "alamat", "house at", "condo at", "unit at", "buying(?:\\s+\\w+){0,2}\\s+at"], String.raw`(?:No\.?\s*)?\d+[A-Za-z]?[^,.\n;]*(?:,\s*[A-Z][^,.\n;]*)?`);
      const street = text.match(new RegExp(streetPattern, "i"));
      if (labeled && /\d/.test(labeled.value)) {
        // Extend a labeled hit with the street match when the street contains it
        if (street && street[0].includes(labeled.value.split(",")[0])) {
          return { value: street[0].trim(), confidence: 0.9 };
        }
        return { ...labeled, confidence: 0.7 };
      }
      if (street) {
        const withNo = text.match(new RegExp(String.raw`(?:No\.?\s*)?\d+[A-Za-z]?\s*,?\s*` + streetPattern, "i"));
        return { value: (withNo?.[0] ?? street[0]).trim().replace(/[.,;]+$/, ""), confidence: 0.6 };
      }
      return null;
    },
  },
  property_type: {
    extract(text) {
      const m = text.match(/\b(condominium|condo|apartment|serviced\s+(?:apartment|residence)|terrace(?:d)?\s*(?:house)?|semi-?d(?:etached)?|bungalow|townhouse|flat|landed|studio|SOHO)\b/i);
      if (!m) return null;
      const canonical: Record<string, string> = { condo: "Condominium", condominium: "Condominium", flat: "Flat", bungalow: "Bungalow", townhouse: "Townhouse", landed: "Landed", studio: "Studio", soho: "SOHO" };
      const key = m[1].toLowerCase().replace(/\s+/g, " ");
      const value = canonical[key] ?? m[1].replace(/\b\w/g, (c) => c.toUpperCase());
      const labeled = /type|property/i.test(text.slice(Math.max(0, m.index! - 30), m.index));
      return { value, confidence: labeled ? 0.9 : 0.6 };
    },
  },
  purchase_price: {
    extract(text) {
      return labeledAmount(text, ["(?:purchase|asking|selling|spa)\\s*price", "price", "asking", "purchase", "buying[^.\\n]{0,30}?(?:at|for)"], { min: 10_000 });
    },
  },
  loan_amount: {
    extract(text) {
      const direct = labeledAmount(text, ["loan\\s*(?:amount|of)?", "financing", "borrow(?:ing)?", "margin of finance"], { min: 10_000 });
      if (direct) return direct;
      // "Loan 90%" → derive from purchase price, flagged uncertain
      const pct = text.match(/(?:loan|financing|margin)\s*(?:of)?\s*(\d{2,3})\s*%/i);
      if (pct) {
        const price = EXTRACTORS.purchase_price.extract(text);
        if (price) {
          const derived = Math.round((parseInt(pct[1], 10) / 100) * parseFloat(price.value));
          return { value: String(derived), confidence: 0.6, ambiguous: true };
        }
      }
      return null;
    },
  },
  loan_tenure: {
    extract(text) {
      const labeled = text.match(/(?:tenure|loan\s+period)\s*[:=\-]?\s*(\d{1,2})\s*(?:years?|yrs?|yr)?/i);
      if (labeled) return { value: labeled[1], confidence: 0.9 };
      // "Loan RM544000 30 years", "financing RM760000 30yr", "90% 25yr"
      const near = text.match(/(?:loan|financing|%)[^.\n]{0,30}?\b(\d{1,2})\s*(?:years?|yrs?|yr)\b/i);
      if (near) return { value: near[1], confidence: 0.6 };
      return null;
    },
  },
  contact_number: {
    extract(text) {
      const numbers = [...text.matchAll(/\b(01\d[-\s]?\d{3,4}[-\s]?\d{4}|0\d[-\s]?\d{7,8}|\+?60\s?1\d[-\s]?\d{3,4}[-\s]?\d{4})\b/g)]
        .map((m) => m[1])
        // NRIC fragments can false-positive; drop values that sit inside an NRIC
        .filter((v) => !text.includes(`-${v}`) || /^01/.test(v));
      if (numbers.length === 0) return null;
      const distinct = [...new Set(numbers)];
      return { value: distinct[0], confidence: 0.9, ambiguous: distinct.length > 1 };
    },
  },
  email: {
    extract(text) {
      const emails = [...text.matchAll(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g)].map((m) => m[0]);
      if (emails.length === 0) return null;
      const distinct = [...new Set(emails)];
      return { value: distinct[0], confidence: 0.9, ambiguous: distinct.length > 1 };
    },
  },
  epf_balance: {
    extract(text) {
      return labeledAmount(text, ["EPF(?:\\s+balance)?", "KWSP(?:\\s+balance)?"], { min: 100 });
    },
  },
  kids_count: {
    extract(text) {
      const m = text.match(/(\d{1,2})\s*(?:kids?|children|anak)\b/i);
      return m ? { value: m[1], confidence: 0.6 } : null;
    },
  },
};

// ── Standard-template fields (labeled-line + zone-aware extraction) ─────────
// Agents often send back the officer's own WhatsApp form, or a loose
// "Label: value" list. Lines are matched label-first within the section
// ("zone") they belong to, so "Name:" under *SPOUSE INFO* never collides
// with the applicant's name. Falls back to the inline regex extractors above
// for unlabeled prose.

const ZONE_DEFS: { zone: string; re: RegExp }[] = [
  { zone: "personal", re: /personal\s+(?:info|details)/i },
  { zone: "spouse", re: /spouse\s+(?:info|details)/i },
  { zone: "emergency", re: /emergency\s+contact/i },
  { zone: "employment", re: /employment\s+details?/i },
  { zone: "previous", re: /previous\s+employment/i },
];

/** Split raw text into named zones by section headers; zone absent if header absent. */
function splitZones(text: string): Record<string, string> {
  const lines = text.split("\n");
  const zones: Record<string, string> = {};
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current) zones[current] = (zones[current] ?? "") + buffer.join("\n") + "\n";
    buffer = [];
  };
  for (const line of lines) {
    // A section header must not itself carry a value ("Emergency Contact
    // Name: MUHAMMAD…" is a field line, not the EMERGENCY CONTACT header).
    const isHeaderish = line.length < 80 && !/:[ \t]*\S/.test(line);
    const header = isHeaderish ? ZONE_DEFS.find((z) => z.re.test(line)) : undefined;
    if (header) {
      flush();
      current = header.zone;
    } else {
      buffer.push(line);
    }
  }
  flush();
  return zones;
}

function escapeAlias(alias: string): string {
  return alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\?\s+/g, "\\s*");
}

/** First "Label: value" line hit for any alias, anchored at line start (after bullets/numbering). */
function lineValue(text: string, aliases: string[]): string | null {
  const lines = text.split("\n");
  for (const alias of aliases) {
    // Leading decorations: bullets, numbering, emoji (✅📌▶️…) — anything
    // that isn't a letter — get skipped before the label.
    const re = new RegExp(String.raw`^[^A-Za-z\n]*${escapeAlias(alias)}\s*(?:\([^)]*\))?\s*[:：]\s*(.+)$`, "i");
    for (const line of lines) {
      const m = line.match(re);
      if (!m) continue;
      const value = m[1].trim().replace(/\s+/g, " ");
      // Skip empty-template leftovers and the missing marker itself
      if (!value || /^[-–—_.⚠️\s]*$/.test(value)) continue;
      return value;
    }
  }
  return null;
}

interface StandardFieldDef {
  zone: string;
  aliases: string[]; // tried in order; put the most specific first
  fallback?: string; // key into EXTRACTORS for unlabeled-prose fallback
}

// Aliases cover English AND Malay labels — agents write both ("Nama", "No KP",
// "Alamat", "Pekerjaan", …). Most specific first.
const STANDARD_FIELDS: Record<string, StandardFieldDef> = {
  name: { zone: "personal", aliases: ["full name", "client name", "applicant name", "nama penuh", "nama pelanggan", "nama", "name", "client"], fallback: "applicant_name" },
  nric: { zone: "personal", aliases: ["nric", "no kad pengenalan", "kad pengenalan", "no kp", "no ic", "ic no", "ic number", "ic", "mykad"], fallback: "nric" },
  contact_no: { zone: "personal", aliases: ["contact no", "contact number", "contact", "no telefon", "no tel", "telefon", "no hp", "phone no", "phone number", "phone", "hp", "mobile", "tel"], fallback: "contact_number" },
  email: { zone: "personal", aliases: ["email address", "emel", "e-mel", "email"], fallback: "email" },
  height: { zone: "personal", aliases: ["height", "tinggi"] },
  weight: { zone: "personal", aliases: ["weight", "berat badan", "berat"] },
  mother_name: { zone: "personal", aliases: ["mother's full name", "mother full name", "mother's name", "mothers full name", "mother name", "nama penuh ibu", "nama ibu"] },
  residence_address: { zone: "personal", aliases: ["residence address", "residential address", "home address", "current address", "alamat rumah", "alamat kediaman", "alamat semasa", "address", "alamat"] },
  own_or_rental: { zone: "personal", aliases: ["own or rental", "own/rental", "own rental", "sendiri atau sewa", "rumah sendiri atau sewa", "milik sendiri atau sewa"] },
  years_of_residence: { zone: "personal", aliases: ["years of residence", "year of residence", "years of staying", "tempoh menetap", "lama menetap"] },
  highest_education: { zone: "personal", aliases: ["highest education", "education level", "pendidikan tertinggi", "taraf pendidikan", "education", "pendidikan"] },
  race: { zone: "personal", aliases: ["race", "bangsa", "kaum"] },
  religion: { zone: "personal", aliases: ["religion", "agama"] },
  bumiputera: { zone: "personal", aliases: ["bumiputera (yes / no)", "bumiputera"] },
  marital_status: { zone: "personal", aliases: ["marital status", "taraf perkahwinan", "status perkahwinan"], fallback: "marital_status" },
  spouse_name: { zone: "spouse", aliases: ["spouse name", "nama pasangan", "nama suami", "nama isteri", "name", "nama"] },
  spouse_nric: { zone: "spouse", aliases: ["spouse nric", "no kp pasangan", "ic pasangan", "nric", "no kp", "ic"] },
  spouse_contact: { zone: "spouse", aliases: ["spouse contact no", "spouse contact", "no tel pasangan", "contact no", "contact", "no telefon", "phone"] },
  spouse_email: { zone: "spouse", aliases: ["spouse email", "emel pasangan", "email", "emel"] },
  spouse_occupation: { zone: "spouse", aliases: ["spouse occupation", "pekerjaan pasangan", "pekerjaan suami", "pekerjaan isteri", "occupation", "pekerjaan"] },
  no_of_children: { zone: "spouse", aliases: ["no. of children", "no of children", "number of children", "bilangan anak", "jumlah anak", "children", "anak"], fallback: "kids_count" },
  emergency_name: { zone: "emergency", aliases: ["emergency contact name", "emergency name", "nama waris", "name", "nama"] },
  emergency_phone: { zone: "emergency", aliases: ["emergency contact number", "emergency contact no", "emergency phone", "no tel waris", "phone no", "phone", "contact no", "contact", "no telefon"] },
  emergency_address: { zone: "emergency", aliases: ["emergency address", "alamat waris", "address", "alamat"] },
  emergency_relationship: { zone: "emergency", aliases: ["relationship", "hubungan"] },
  company_name: { zone: "employment", aliases: ["company name", "nama syarikat", "nama majikan", "tempat kerja", "company", "syarikat", "majikan", "employer"], fallback: "employer_name" },
  company_address: { zone: "employment", aliases: ["company address", "office address", "alamat syarikat", "alamat majikan", "alamat tempat kerja", "alamat pejabat"] },
  occupation: { zone: "employment", aliases: ["occupation", "position", "designation", "job title", "pekerjaan", "jawatan"] },
  office_tel: { zone: "employment", aliases: ["office tel(landline)", "office tel", "office phone", "office number", "landline", "no tel pejabat", "tel pejabat"] },
  hr_email: { zone: "employment", aliases: ["hr company email", "hr email", "emel hr", "emel syarikat"] },
  date_of_joining: { zone: "employment", aliases: ["date of joining", "joining date", "date joined", "tarikh mula kerja", "tarikh masuk kerja", "mula bekerja"] },
  length_of_service: { zone: "employment", aliases: ["length of service", "years of service", "tempoh perkhidmatan", "tempoh bekerja", "lama bekerja", "lama kerja"], fallback: "employment_duration" },
  nature_of_business: { zone: "employment", aliases: ["nature of business", "business nature", "jenis perniagaan", "bidang perniagaan"] },
  prev_company_name: { zone: "previous", aliases: ["previous company name", "syarikat terdahulu", "majikan terdahulu", "company name", "nama syarikat"] },
  prev_occupation: { zone: "previous", aliases: ["previous occupation", "pekerjaan terdahulu", "occupation", "pekerjaan"] },
  prev_nature_of_business: { zone: "previous", aliases: ["previous nature of business", "nature of business", "jenis perniagaan"] },
  prev_length_of_service: { zone: "previous", aliases: ["length in service", "length of service", "tempoh perkhidmatan"] },
};

// Zones whose fields must not steal the applicant's own labels when the
// section header is absent. Only GENERIC aliases (ones the applicant's own
// fields also use) are suppressed outside the zone — specific labels like
// "bilangan anak" or "nama pasangan" are unambiguous anywhere.
const ZONE_SCOPED = new Set(["spouse", "emergency", "previous"]);
const GENERIC_ALIASES = new Set([
  "name", "nama", "nric", "no kp", "ic", "contact no", "contact", "phone no", "phone",
  "no telefon", "telefon", "email", "emel", "address", "alamat", "occupation", "pekerjaan",
  "company name", "nama syarikat", "nature of business", "jenis perniagaan",
  "length of service", "tempoh perkhidmatan",
]);

/** A comma-separated one-liner masquerading as a labeled value — the label matched but the "value" is the rest of the message. */
function proseLike(value: string): boolean {
  return value.length > 60 || (value.match(/,/g)?.length ?? 0) >= 2;
}

function extractStandardField(fullText: string, zones: Record<string, string>, def: StandardFieldDef): { value: string; confidence: number; ambiguous?: boolean } | null {
  const zoneText = zones[def.zone];
  let lineHit: string | null = null;
  if (zoneText) {
    lineHit = lineValue(zoneText, def.aliases);
  } else if (ZONE_SCOPED.has(def.zone)) {
    // No section header: suppress aliases the applicant's own fields also use
    const safe = def.aliases.filter((a) => !GENERIC_ALIASES.has(a));
    lineHit = safe.length ? lineValue(fullText, safe) : null;
  } else {
    lineHit = lineValue(fullText, def.aliases);
  }

  const fallback = def.fallback ? EXTRACTORS[def.fallback] : undefined;

  if (lineHit && !proseLike(lineHit)) return { value: lineHit, confidence: 0.9 };
  if (fallback) {
    const hit = fallback.extract(fullText);
    if (hit) return hit;
  }
  // Prose-like line hit with no better fallback: keep it, but flag for review
  if (lineHit) return { value: lineHit, confidence: 0.6, ambiguous: true };
  return null;
}

/** Run the rule engine over raw text for every template field. Always returns one match per field. */
export function runTallyEngine(rawText: string, fields: TemplateFieldInput[]): TallyMatch[] {
  // CRLF must become LF before any line matching: JS "." never matches "\r",
  // so a trailing \r makes `(.+)$` silently fail on every Windows/browser line.
  const text = rawText.trim().replace(/\r\n?/g, "\n").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const zones = splitZones(text);
  return fields.map((field) => {
    const std = STANDARD_FIELDS[field.field_key];
    const extractor = EXTRACTORS[field.field_key];
    const hit =
      text.length === 0
        ? null
        : std
          ? extractStandardField(text, zones, std)
          : extractor
            ? extractor.extract(text)
            : null;
    if (!hit) {
      return {
        template_field_id: field.id,
        field_key: field.field_key,
        extracted_value: null,
        source: "missing" as const,
        confidence: 0,
        review_status: "missing" as const,
      };
    }
    const uncertain = hit.ambiguous || hit.confidence < 0.7;
    return {
      template_field_id: field.id,
      field_key: field.field_key,
      extracted_value: hit.value,
      source: "rule-match" as const,
      confidence: Math.round(hit.confidence * 100) / 100,
      review_status: uncertain ? ("uncertain" as const) : ("unreviewed" as const),
    };
  });
}

/** Auto-tag source format from content patterns (docs/AGENTIC_LAYER.md — low-risk auto). */
export function detectSourceFormat(rawText: string): string | null {
  if (/wa\.me|whatsapp|\[\d{1,2}:\d{2}(?:\s?[AP]M)?\]/i.test(rawText)) return "whatsapp";
  if (/^(?:from|to|subject|cc):/im.test(rawText) || /dear\s+(?:sir|madam|mr|ms)/i.test(rawText)) return "email";
  return null;
}
