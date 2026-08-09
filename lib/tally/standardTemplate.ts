// The officer's standard WhatsApp template. Raw agent info is converted into
// this exact text — found values filled in, missing fields flagged with ⚠️ —
// ready to copy-paste back to the agent or client. Labels render in English,
// Malay, or Chinese; extracted VALUES always stay exactly as the agent sent
// them (never translated — that would be guessing).

export const STANDARD_TEMPLATE_ID = "a1000000-0000-0000-0000-000000000002";

export const MISSING_MARK = "⚠️";

export type TemplateLang = "en" | "ms" | "zh";

export const TEMPLATE_LANGS: { code: TemplateLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ms", label: "B. Melayu" },
  { code: "zh", label: "中文" },
];

type Translated = Record<TemplateLang, string>;

interface TemplateLine {
  key: string;
  label: Translated; // text up to and including the colon
}

interface TemplateSection {
  header: Translated;
  lines: TemplateLine[];
}

const HEADER_TEXT: Translated = {
  en: "Please help to fill up this, for me to assist you in loan application . Thank you. 🙏🏻☺️☺️",
  ms: "Mohon bantu isikan maklumat ini untuk saya bantu proses permohonan pinjaman anda. Terima kasih. 🙏🏻☺️☺️",
  zh: "请帮忙填写以下资料，以便我协助您办理贷款申请。谢谢您。🙏🏻☺️☺️",
};

const T = (en: string, ms: string, zh: string): Translated => ({ en, ms, zh });

export const STANDARD_TEMPLATE: TemplateSection[] = [
  {
    header: T("▶️ *PERSONAL INFO*", "▶️ *MAKLUMAT PERIBADI*", "▶️ *个人资料*"),
    lines: [
      { key: "name", label: T("Name:", "Nama:", "姓名:") },
      { key: "nric", label: T("NRIC:", "No. Kad Pengenalan:", "身份证号码:") },
      { key: "contact_no", label: T("Contact No.:", "No. Telefon:", "联络电话:") },
      { key: "email", label: T("Email:", "Emel:", "电邮:") },
      { key: "height", label: T("Height :", "Tinggi:", "身高:") },
      { key: "weight", label: T("Weight:", "Berat:", "体重:") },
      { key: "mother_name", label: T("Mother’s Full Name:", "Nama Penuh Ibu:", "母亲全名:") },
      { key: "residence_address", label: T("Residence Address:", "Alamat Kediaman:", "住家地址:") },
      { key: "own_or_rental", label: T("Own or Rental:", "Sendiri atau Sewa:", "自购或租房:") },
      { key: "years_of_residence", label: T("Years of Residence:", "Tempoh Menetap:", "居住年数:") },
      { key: "highest_education", label: T("Highest education:", "Pendidikan Tertinggi:", "最高学历:") },
      { key: "race", label: T("Race :", "Bangsa:", "种族:") },
      { key: "religion", label: T("Religion :", "Agama:", "宗教:") },
      { key: "bumiputera", label: T("Bumiputera (Yes / No) :", "Bumiputera (Ya / Tidak):", "土著 (是 / 否):") },
      { key: "marital_status", label: T("Marital Status:", "Taraf Perkahwinan:", "婚姻状况:") },
    ],
  },
  {
    header: T("▶️ *SPOUSE INFO*  (If Married)", "▶️ *MAKLUMAT PASANGAN*  (Jika Berkahwin)", "▶️ *配偶资料*（如已婚）"),
    lines: [
      { key: "spouse_name", label: T("Spouse Name :", "Nama Pasangan:", "配偶姓名:") },
      { key: "spouse_nric", label: T("Spouse NRIC :", "No. KP Pasangan:", "配偶身份证号码:") },
      { key: "spouse_contact", label: T("Spouse Contact No :", "No. Telefon Pasangan:", "配偶联络电话:") },
      { key: "spouse_email", label: T("Spouse Email :", "Emel Pasangan:", "配偶电邮:") },
      { key: "spouse_occupation", label: T("Spouse Occupation :", "Pekerjaan Pasangan:", "配偶职业:") },
      { key: "no_of_children", label: T("No. of Children:", "Bilangan Anak:", "子女人数:") },
    ],
  },
  {
    header: T(
      "▶️ *EMERGENCY CONTACT* (Not Staying Together)",
      "▶️ *WARIS KECEMASAN* (Tidak Tinggal Bersama)",
      "▶️ *紧急联络人*（非同住）",
    ),
    lines: [
      { key: "emergency_name", label: T("Name:", "Nama:", "姓名:") },
      { key: "emergency_phone", label: T("Phone No.:", "No. Telefon:", "联络电话:") },
      { key: "emergency_address", label: T("Address :", "Alamat:", "地址:") },
      { key: "emergency_relationship", label: T("Relationship:", "Hubungan:", "关系:") },
    ],
  },
  {
    header: T("▶️ *Employment details*", "▶️ *Maklumat Pekerjaan*", "▶️ *工作资料*"),
    lines: [
      { key: "company_name", label: T("Company Name:", "Nama Syarikat:", "公司名称:") },
      { key: "company_address", label: T("Company Address:", "Alamat Syarikat:", "公司地址:") },
      { key: "occupation", label: T("Occupation:", "Pekerjaan:", "职业:") },
      { key: "office_tel", label: T("Office Tel(LANDLINE):", "No. Telefon Pejabat (TALIAN TETAP):", "办公室电话（座机）:") },
      { key: "hr_email", label: T("HR Company Email :", "Emel HR Syarikat:", "公司HR电邮:") },
      { key: "date_of_joining", label: T("Date of Joining:", "Tarikh Mula Kerja:", "入职日期:") },
      { key: "length_of_service", label: T("Length of Service:", "Tempoh Perkhidmatan:", "服务年资:") },
      { key: "nature_of_business", label: T("Nature of Business:", "Jenis Perniagaan:", "业务性质:") },
    ],
  },
  {
    header: T(
      "▶️ *PREVIOUS EMPLOYMENT*(If Length of service less than 2 Year)",
      "▶️ *PEKERJAAN TERDAHULU* (Jika tempoh perkhidmatan kurang 2 tahun)",
      "▶️ *前雇主资料*（若服务年资少于2年）",
    ),
    lines: [
      { key: "prev_company_name", label: T("1. Previous Company Name:", "1. Nama Syarikat Terdahulu:", "1. 前公司名称:") },
      { key: "prev_occupation", label: T("2. Occupation:", "2. Pekerjaan:", "2. 职业:") },
      { key: "prev_nature_of_business", label: T("3. Nature of Business:", "3. Jenis Perniagaan:", "3. 业务性质:") },
      { key: "prev_length_of_service", label: T("4. Length in Service:", "4. Tempoh Perkhidmatan:", "4. 服务年资:") },
    ],
  },
];

/** Render the officer's template with values filled in and ⚠️ on anything not found. */
export function renderStandardTemplate(
  valuesByKey: Record<string, string | null | undefined>,
  lang: TemplateLang = "en",
): string {
  const parts: string[] = [HEADER_TEXT[lang]];
  for (const section of STANDARD_TEMPLATE) {
    const lines = section.lines.map((line) => {
      const value = valuesByKey[line.key]?.trim();
      return `${line.label[lang]} ${value || MISSING_MARK}`;
    });
    parts.push(`${section.header[lang]}\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}
