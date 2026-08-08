// The officer's standard WhatsApp template, verbatim. Raw agent info is
// converted into this exact text — found values filled in, missing fields
// flagged with ⚠️ — ready to copy-paste back to the agent or client.

export const STANDARD_TEMPLATE_ID = "a1000000-0000-0000-0000-000000000002";

export const MISSING_MARK = "⚠️";

interface TemplateLine {
  label: string; // exact text up to and including the colon, as the officer writes it
  key: string;
}

interface TemplateSection {
  header: string;
  lines: TemplateLine[];
}

const HEADER_TEXT =
  "Please help to fill up this, for me to assist you in loan application . Thank you. 🙏🏻☺️☺️";

export const STANDARD_TEMPLATE: TemplateSection[] = [
  {
    header: "▶️ *PERSONAL INFO*",
    lines: [
      { label: "Name:", key: "name" },
      { label: "NRIC:", key: "nric" },
      { label: "Contact No.:", key: "contact_no" },
      { label: "Email:", key: "email" },
      { label: "Height :", key: "height" },
      { label: "Weight:", key: "weight" },
      { label: "Mother’s Full Name:", key: "mother_name" },
      { label: "Residence Address:", key: "residence_address" },
      { label: "Own or Rental:", key: "own_or_rental" },
      { label: "Years of Residence:", key: "years_of_residence" },
      { label: "Highest education:", key: "highest_education" },
      { label: "Race :", key: "race" },
      { label: "Religion :", key: "religion" },
      { label: "Bumiputera (Yes / No) :", key: "bumiputera" },
      { label: "Marital Status:", key: "marital_status" },
    ],
  },
  {
    header: "▶️ *SPOUSE INFO*  (If Married)",
    lines: [
      { label: "Spouse Name :", key: "spouse_name" },
      { label: "Spouse NRIC :", key: "spouse_nric" },
      { label: "Spouse Contact No :", key: "spouse_contact" },
      { label: "Spouse Email :", key: "spouse_email" },
      { label: "Spouse Occupation :", key: "spouse_occupation" },
      { label: "No. of Children:", key: "no_of_children" },
    ],
  },
  {
    header: "▶️ *EMERGENCY CONTACT* (Not Staying Together)",
    lines: [
      { label: "Name:", key: "emergency_name" },
      { label: "Phone No.:", key: "emergency_phone" },
      { label: "Address :", key: "emergency_address" },
      { label: "Relationship:", key: "emergency_relationship" },
    ],
  },
  {
    header: "▶️ *Employment details*",
    lines: [
      { label: "Company Name:", key: "company_name" },
      { label: "Company Address:", key: "company_address" },
      { label: "Occupation:", key: "occupation" },
      { label: "Office Tel(LANDLINE):", key: "office_tel" },
      { label: "HR Company Email :", key: "hr_email" },
      { label: "Date of Joining:", key: "date_of_joining" },
      { label: "Length of Service:", key: "length_of_service" },
      { label: "Nature of Business:", key: "nature_of_business" },
    ],
  },
  {
    header: "▶️ *PREVIOUS EMPLOYMENT*(If Length of service less than 2 Year)",
    lines: [
      { label: "1. Previous Company Name:", key: "prev_company_name" },
      { label: "2. Occupation:", key: "prev_occupation" },
      { label: "3. Nature of Business:", key: "prev_nature_of_business" },
      { label: "4. Length in Service:", key: "prev_length_of_service" },
    ],
  },
];

/** Render the officer's template with values filled in and ⚠️ on anything not found. */
export function renderStandardTemplate(valuesByKey: Record<string, string | null | undefined>): string {
  const parts: string[] = [HEADER_TEXT];
  for (const section of STANDARD_TEMPLATE) {
    const lines = section.lines.map((line) => {
      const value = valuesByKey[line.key]?.trim();
      return `${line.label} ${value || MISSING_MARK}`;
    });
    parts.push(`${section.header}\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}
