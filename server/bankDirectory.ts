export interface VerifiedBankRecord {
  id?: string;
  bankName: string;
  shortCode: string;
  supportPhone: string;
  fraudPhone: string | null;
  officialWebsite: string;
  sourceUrl: string;
  lastVerifiedDate: string;
  upiBlockUrl: string | null;
  debitBlockUrl: string | null;
  creditBlockUrl: string | null;
  netbankingUrl: string | null;
  fraudReportUrl: string;
  verificationStatus: "verified" | "unverified";
  notes: string;
}

export type EmergencyNumberType = "fraud_reporting" | "customer_support";

export interface EmergencyCallResolution {
  status: "ready" | "missing_bank" | "unavailable" | "invalid_record";
  canDial: boolean;
  bankName: string | null;
  shortCode: string | null;
  dialNumber: string | null;
  telUri: string | null;
  numberType: EmergencyNumberType | null;
  numberTypeLabel: string;
  numberTypeLabelHi: string;
  supportPhone: string | null;
  supportTelUri: string | null;
  fraudPhone: string | null;
  fraudTelUri: string | null;
  officialWebsite: string | null;
  sourceUrl: string | null;
  lastVerifiedDate: string | null;
  message: string;
  messageHi: string;
  validationErrors: string[];
}

export const NATIONAL_CYBERCRIME_HELPLINE = "1930";
export const NATIONAL_CYBERCRIME_PORTAL = "https://cybercrime.gov.in/";
export const SANCHAR_SAATHI_CEIR_PORTAL = "https://ceir.sancharsaathi.gov.in/";

export const VERIFIED_INDIAN_BANKS: VerifiedBankRecord[] = [
  {
    bankName: "State Bank of India (SBI)",
    shortCode: "SBI",
    supportPhone: "1800-1234",
    fraudPhone: "1800-11-1109",
    officialWebsite: "https://sbi.co.in/",
    sourceUrl: "https://sbi.co.in/web/customer-care/addresses-and-helpline-nos",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.onlinesbi.sbi/",
    debitBlockUrl: "https://www.onlinesbi.sbi/",
    creditBlockUrl: "https://www.sbicard.com/",
    netbankingUrl: "https://retail.onlinesbi.sbi/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated SBI unauthorized electronic transaction reporting line 1800-11-1109 (or 94491-12211). General 24x7 toll-free care: 1800-1234 / 1800-2100.",
  },
  {
    bankName: "HDFC Bank",
    shortCode: "HDFC",
    supportPhone: "1800-1600",
    fraudPhone: "1800-258-6161",
    officialWebsite: "https://www.hdfcbank.com/",
    sourceUrl: "https://www.hdfcbank.com/personal/need-help/contact-us",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.hdfcbank.com/",
    debitBlockUrl: "https://netbanking.hdfcbank.com/",
    creditBlockUrl: "https://netbanking.hdfcbank.com/",
    netbankingUrl: "https://netbanking.hdfcbank.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated 24x7 HDFC Bank helpline to report & block unauthorized transactions: 1800-258-6161. General PhoneBanking: 1800-1600 / 1800-2600.",
  },
  {
    bankName: "ICICI Bank",
    shortCode: "ICICI",
    supportPhone: "1800-1080",
    fraudPhone: "1800-2662",
    officialWebsite: "https://www.icicibank.com/",
    sourceUrl: "https://www.icicibank.com/personal-banking/insta-banking/internet-banking/report-fraud",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.icicibank.com/",
    debitBlockUrl: "https://www.icicibank.com/",
    creditBlockUrl: "https://www.icicibank.com/",
    netbankingUrl: "https://infinity.icicibank.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated ICICI Bank unauthorized transaction & fraud reporting toll-free number: 1800-2662. Primary 24x7 customer care: 1800-1080.",
  },
  {
    bankName: "Axis Bank",
    shortCode: "AXIS",
    supportPhone: "1860-419-5555",
    fraudPhone: "1800-8911",
    officialWebsite: "https://www.axisbank.com/",
    sourceUrl: "https://www.axisbank.com/contact-us",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.axisbank.com/",
    debitBlockUrl: "https://www.axisbank.com/",
    creditBlockUrl: "https://www.axisbank.com/",
    netbankingUrl: "https://omni.axisbank.co.in/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "24x7 toll-free card loss & fraud helpline: 1800-8911 (Credit Card toll-free: 1800-209-5577). Regular helpline: 1860-419-5555 / 1860-500-5555.",
  },
  {
    bankName: "Punjab National Bank (PNB)",
    shortCode: "PNB",
    supportPhone: "1800-1800",
    fraudPhone: "1800-180-2222",
    officialWebsite: "https://www.pnbindia.in/",
    sourceUrl: "https://www.pnbindia.in/Contact-Us.html",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.pnbindia.in/",
    debitBlockUrl: "https://www.pnbindia.in/",
    creditBlockUrl: "https://www.pnbindia.in/",
    netbankingUrl: "https://netpnb.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "24x7 toll-free ATM/Debit Card hotlisting & fraud helpline: 1800-180-2222. General banking & online fraud care: 1800-1800 / 1800-2021.",
  },
  {
    bankName: "Bank of Baroda",
    shortCode: "BOB",
    supportPhone: "1800-5700",
    fraudPhone: null,
    officialWebsite: "https://www.bankofbaroda.in/",
    sourceUrl: "https://www.bankofbaroda.in/contact-us",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.bankofbaroda.in/",
    debitBlockUrl: "https://www.bankofbaroda.in/",
    creditBlockUrl: "https://www.bobcard.co.in/",
    netbankingUrl: "https://www.bobibanking.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Bank of Baroda handles 24x7 fraud reporting, debit card blocking, and UPI lock through its official toll-free customer care line 1800-5700 / 1800-5000.",
  },
  {
    bankName: "Canara Bank",
    shortCode: "CANARA",
    supportPhone: "1800-1030",
    fraudPhone: null,
    officialWebsite: "https://canarabank.com/",
    sourceUrl: "https://canarabank.com/pages/Report-Unauthorised-Transactions",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://canarabank.com/",
    debitBlockUrl: "https://canarabank.com/",
    creditBlockUrl: "https://canarabank.com/",
    netbankingUrl: "https://online.canarabank.in/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Canara Bank 24x7 toll-free helpline 1800-1030 (alt: 1800-425-0018) handles unauthorized transaction reports and card hotlisting; SMS SUSPECT to 56161.",
  },
  {
    bankName: "Union Bank of India",
    shortCode: "UNION",
    supportPhone: "1800-2222-44",
    fraudPhone: "1800-8332",
    officialWebsite: "https://www.unionbankofindia.co.in/",
    sourceUrl: "https://www.unionbankofindia.co.in/english/toll-free-number.aspx",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.unionbankofindia.co.in/",
    debitBlockUrl: "https://www.unionbankofindia.co.in/",
    creditBlockUrl: "https://www.unionbankofindia.co.in/",
    netbankingUrl: "https://www.unionbankonline.co.in/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated Union Bank of India fraud & disputed transaction toll-free helpline: 1800-8332 (alt: 1800-8333). General care: 1800-2222-44.",
  },
  {
    bankName: "Kotak Mahindra Bank",
    shortCode: "KOTAK",
    supportPhone: "1800-4100",
    fraudPhone: "1800-209-0000",
    officialWebsite: "https://www.kotak.com/",
    sourceUrl: "https://www.kotak.com/en/personal-banking/ways-to-bank/safe-banking/report-fraud.html",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.kotak.com/",
    debitBlockUrl: "https://www.kotak.com/",
    creditBlockUrl: "https://www.kotak.com/",
    netbankingUrl: "https://netbanking.kotak.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated Kotak Mahindra Bank 24x7 fraud & unauthorized transaction helpline: 1800-209-0000. General customer care: 1800-4100.",
  },
  {
    bankName: "IDFC FIRST Bank",
    shortCode: "IDFC",
    supportPhone: "1800-10-888",
    fraudPhone: "1800-419-3332",
    officialWebsite: "https://www.idfcfirstbank.com/",
    sourceUrl: "https://www.idfcfirstbank.com/support/report-fraud",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.idfcfirstbank.com/",
    debitBlockUrl: "https://www.idfcfirstbank.com/",
    creditBlockUrl: "https://www.idfcfirstbank.com/",
    netbankingUrl: "https://my.idfcfirstbank.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Dedicated 24x7 IDFC FIRST Bank fraud & unauthorized transaction helpline: 1800-419-3332. General 24x7 toll-free care: 1800-10-888.",
  },
  {
    bankName: "IndusInd Bank",
    shortCode: "INDUSIND",
    supportPhone: "1860-267-7777",
    fraudPhone: "1800-266-0447",
    officialWebsite: "https://www.indusind.com/",
    sourceUrl: "https://www.indusind.com/in/en/personal/reach-us.html",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.indusind.com/",
    debitBlockUrl: "https://www.indusind.com/",
    creditBlockUrl: "https://www.indusind.com/",
    netbankingUrl: "https://indusnet.indusind.com/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "IndusInd Bank 24x7 toll-free card blocking & unauthorized transaction helpline: 1800-266-0447. Phone banking: 1860-267-7777.",
  },
  {
    bankName: "Yes Bank",
    shortCode: "YES",
    supportPhone: "1800-1200",
    fraudPhone: null,
    officialWebsite: "https://www.yesbank.in/",
    sourceUrl: "https://www.yesbank.in/contact-us",
    lastVerifiedDate: "2026-11-22",
    upiBlockUrl: "https://www.yesbank.in/",
    debitBlockUrl: "https://www.yesbank.in/",
    creditBlockUrl: "https://www.yesbank.in/",
    netbankingUrl: "https://www.yesbank.in/",
    fraudReportUrl: "https://cybercrime.gov.in/",
    verificationStatus: "verified",
    notes:
      "Yes Bank 24x7 toll-free helpline 1800-1200 covers card hotlisting and unauthorized debit transactions (Credit Card toll-free: 1800-103-1212).",
  },
];

export function validateDialablePhone(raw: string | null | undefined): {
  valid: boolean;
  digits: string | null;
  reason?: string;
} {
  if (!raw || typeof raw !== "string") {
    return { valid: false, digits: null, reason: "Phone number is empty or missing." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, digits: null, reason: "Phone number is blank." };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, digits: null, reason: "Phone number contains non-numeric letters." };
  }
  if (!/^[+\d\s\-()]+$/.test(trimmed)) {
    return { valid: false, digits: null, reason: "Phone number contains disallowed characters." };
  }
  const compact = trimmed.replace(/[\s\-()]/g, "");
  if (/^\+?\d{4,15}$/.test(compact)) {
    return { valid: true, digits: compact };
  }
  return { valid: false, digits: null, reason: "Phone number length or format is invalid." };
}

export function buildTelUri(raw: string | null | undefined): string | null {
  const checked = validateDialablePhone(raw);
  if (!checked.valid || !checked.digits) return null;
  return `tel:${checked.digits}`;
}

export function isSafeHttpsUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateBankContactRecord(record: {
  bankName?: string | null;
  shortCode?: string | null;
  supportPhone?: string | null;
  fraudPhone?: string | null;
  officialWebsite?: string | null;
  sourceUrl?: string | null;
  lastVerifiedDate?: string | null;
}): {
  valid: boolean;
  errors: string[];
  supportTelUri: string | null;
  fraudTelUri: string | null;
} {
  const errors: string[] = [];
  if (!record.bankName || !record.bankName.trim()) {
    errors.push("Bank name is required.");
  }
  if (!record.shortCode || !/^[A-Z0-9_-]{2,16}$/i.test(record.shortCode.trim())) {
    errors.push("Bank short code is invalid.");
  }

  const hasSupport = Boolean(record.supportPhone && record.supportPhone.trim());
  const hasFraud = Boolean(record.fraudPhone && record.fraudPhone.trim());
  if (!hasSupport && !hasFraud) {
    errors.push("Neither customer-care nor fraud helpline phone number is available.");
  }

  const supportCheck = hasSupport ? validateDialablePhone(record.supportPhone) : { valid: true, digits: null };
  if (hasSupport && !supportCheck.valid) {
    errors.push(`Invalid customer-care number: ${supportCheck.reason}`);
  }

  const fraudCheck = hasFraud ? validateDialablePhone(record.fraudPhone) : { valid: true, digits: null };
  if (hasFraud && !fraudCheck.valid) {
    errors.push(`Invalid fraud-reporting number: ${fraudCheck.reason}`);
  }

  if (record.officialWebsite && !isSafeHttpsUrl(record.officialWebsite)) {
    errors.push("Official website must be a valid HTTPS URL.");
  }
  if (record.sourceUrl && !isSafeHttpsUrl(record.sourceUrl)) {
    errors.push("Source URL must be a valid HTTPS URL.");
  }
  if (record.lastVerifiedDate && !/^\d{4}-\d{2}-\d{2}$/.test(record.lastVerifiedDate.trim())) {
    errors.push("Last verified date must follow YYYY-MM-DD format.");
  }

  return {
    valid: errors.length === 0,
    errors,
    supportTelUri: hasSupport && supportCheck.valid ? `tel:${supportCheck.digits}` : null,
    fraudTelUri: hasFraud && fraudCheck.valid ? `tel:${fraudCheck.digits}` : null,
  };
}

export function resolveEmergencyCallTarget(
  bank: {
    bank_name?: string;
    bankName?: string;
    short_code?: string;
    shortCode?: string;
    support_phone?: string | null;
    supportPhone?: string | null;
    fraud_phone?: string | null;
    fraudPhone?: string | null;
    official_website?: string | null;
    officialWebsite?: string | null;
    source_url?: string | null;
    sourceUrl?: string | null;
    last_verified_date?: string | null;
    lastVerifiedDate?: string | null;
  } | null | undefined
): EmergencyCallResolution {
  if (!bank) {
    return {
      status: "missing_bank",
      canDial: false,
      bankName: null,
      shortCode: null,
      dialNumber: null,
      telUri: null,
      numberType: null,
      numberTypeLabel: "No bank selected",
      numberTypeLabelHi: "कोई बैंक चयनित नहीं",
      supportPhone: null,
      supportTelUri: null,
      fraudPhone: null,
      fraudTelUri: null,
      officialWebsite: null,
      sourceUrl: null,
      lastVerifiedDate: null,
      message:
        "No primary bank is saved in your Guardian profile yet. Select your bank in Settings or choose a verified bank below to view its official emergency helpline.",
      messageHi:
        "आपकी गार्जियन प्रोफ़ाइल में अभी कोई प्राथमिक बैंक सहेजा नहीं गया है। आधिकारिक आपातकालीन हेल्पलाइन देखने के लिए सेटिंग्स में अपना बैंक चुनें।",
      validationErrors: ["Missing bank selection"],
    };
  }

  const bankName = (bank.bankName ?? bank.bank_name ?? "").trim();
  const shortCode = (bank.shortCode ?? bank.short_code ?? "").trim().toUpperCase();
  const supportPhoneRaw = (bank.supportPhone ?? bank.support_phone ?? "").trim() || null;
  const fraudPhoneRaw = (bank.fraudPhone ?? bank.fraud_phone ?? "").trim() || null;
  const officialWebsite = (bank.officialWebsite ?? bank.official_website ?? "").trim() || null;
  const sourceUrl = (bank.sourceUrl ?? bank.source_url ?? "").trim() || null;
  const lastVerifiedDate = (bank.lastVerifiedDate ?? bank.last_verified_date ?? "").trim() || null;

  if (!supportPhoneRaw && !fraudPhoneRaw) {
    return {
      status: "unavailable",
      canDial: false,
      bankName: bankName || null,
      shortCode: shortCode || null,
      dialNumber: null,
      telUri: null,
      numberType: null,
      numberTypeLabel: "Helpline unavailable",
      numberTypeLabelHi: "हेल्पलाइन उपलब्ध नहीं",
      supportPhone: null,
      supportTelUri: null,
      fraudPhone: null,
      fraudTelUri: null,
      officialWebsite,
      sourceUrl,
      lastVerifiedDate,
      message:
        "No verified helpline number is currently available for this bank entry. Call India's national cybercrime helpline 1930 or check the number printed on the back of your bank card.",
      messageHi:
        "इस बैंक प्रविष्टि के लिए अभी कोई सत्यापित हेल्पलाइन उपलब्ध नहीं है। तुरंत राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 पर कॉल करें या अपने बैंक कार्ड के पीछे छपा नंबर देखें।",
      validationErrors: ["No phone numbers available"],
    };
  }

  const validation = validateBankContactRecord({
    bankName,
    shortCode,
    supportPhone: supportPhoneRaw,
    fraudPhone: fraudPhoneRaw,
    officialWebsite,
    sourceUrl,
    lastVerifiedDate,
  });

  if (!validation.valid) {
    return {
      status: "invalid_record",
      canDial: false,
      bankName: bankName || null,
      shortCode: shortCode || null,
      dialNumber: null,
      telUri: null,
      numberType: null,
      numberTypeLabel: "Invalid bank contact record",
      numberTypeLabelHi: "अमान्य बैंक संपर्क रिकॉर्ड",
      supportPhone: null,
      supportTelUri: null,
      fraudPhone: null,
      fraudTelUri: null,
      officialWebsite: officialWebsite && isSafeHttpsUrl(officialWebsite) ? officialWebsite : null,
      sourceUrl: sourceUrl && isSafeHttpsUrl(sourceUrl) ? sourceUrl : null,
      lastVerifiedDate,
      message:
        "This bank contact record failed safety validation and cannot be dialed automatically. Use official helpline 1930 or the toll-free number printed on your physical bank card.",
      messageHi:
        "यह बैंक संपर्क रिकॉर्ड सुरक्षा सत्यापन में विफल रहा है और डायल नहीं किया जा सकता। कृपया 1930 या अपने बैंक कार्ड के पीछे छपे आधिकारिक नंबर का उपयोग करें।",
      validationErrors: validation.errors,
    };
  }

  // Prefer dedicated fraud-reporting line if available; otherwise clearly label general 24x7 customer care
  const useFraudLine = Boolean(fraudPhoneRaw && validation.fraudTelUri);
  const dialNumber = useFraudLine ? fraudPhoneRaw : supportPhoneRaw;
  const telUri = useFraudLine ? validation.fraudTelUri : validation.supportTelUri;
  const numberType: EmergencyNumberType = useFraudLine ? "fraud_reporting" : "customer_support";

  return {
    status: "ready",
    canDial: Boolean(telUri),
    bankName,
    shortCode,
    dialNumber,
    telUri,
    numberType,
    numberTypeLabel: useFraudLine
      ? "Official Verified Fraud Helpline"
      : "Official General Customer Care (24x7)",
    numberTypeLabelHi: useFraudLine
      ? "आधिकारिक सत्यापित धोखाधड़ी हेल्पलाइन"
      : "आधिकारिक सामान्य ग्राहक सेवा (24x7)",
    supportPhone: supportPhoneRaw,
    supportTelUri: validation.supportTelUri,
    fraudPhone: fraudPhoneRaw,
    fraudTelUri: validation.fraudTelUri,
    officialWebsite,
    sourceUrl,
    lastVerifiedDate,
    message: useFraudLine
      ? `Verified dedicated fraud-reporting line for ${bankName}. Confirm below to launch your phone dialer.`
      : `${bankName} routes fraud & card-blocking requests via its official 24x7 customer care helpline. Confirm below to launch your phone dialer.`,
    messageHi: useFraudLine
      ? `${bankName} की सत्यापित समर्पित धोखाधड़ी रिपोर्टिंग हेल्पलाइन। फ़ोन डायलर खोलने के लिए नीचे पुष्टि करें।`
      : `${bankName} धोखाधड़ी और कार्ड ब्लॉक अनुरोध अपनी आधिकारिक 24x7 ग्राहक सेवा हेल्पलाइन पर लेता है। फ़ोन डायलर खोलने के लिए नीचे पुष्टि करें।`,
    validationErrors: [],
  };
}

export const UNVERIFIED_BANK_FALLBACK_MESSAGE =
  "We couldn't verify this bank's emergency contact. Please visit your bank's official website or use its official mobile application.";

export const UNVERIFIED_BANK_FALLBACK_MESSAGE_HI =
  "हम इस बैंक का आपातकालीन संपर्क सत्यापित नहीं कर सके। कृपया अपने बैंक की आधिकारिक वेबसाइट पर जाएं या उसके आधिकारिक मोबाइल ऐप का उपयोग करें।";

const BANK_SEARCH_ALIASES: Record<string, string[]> = {
  SBI: ["sbi", "state bank", "state bank of india", "yono"],
  HDFC: ["hdfc", "hdfc bank"],
  ICICI: ["icici", "icici bank", "imobile"],
  AXIS: ["axis", "axis bank"],
  PNB: ["pnb", "punjab national", "punjab national bank"],
  BOB: ["bob", "bank of baroda", "baroda"],
  CANARA: ["canara", "canara bank"],
  UNION: ["union", "union bank", "union bank of india"],
  KOTAK: ["kotak", "kotak mahindra", "kotak bank"],
  INDUSIND: ["indusind", "indusind bank"],
  IDFC: ["idfc", "idfc first", "idfc first bank"],
  YES: ["yes", "yes bank"],
};

export interface BankLookupResult {
  matched: boolean;
  verified: boolean;
  query: string;
  bank: VerifiedBankRecord | null;
  callResolution: EmergencyCallResolution | null;
  message: string;
  messageHi: string;
}

export function lookupBankInVerifiedDirectory(
  rawQuery: string,
  directoryRecords: VerifiedBankRecord[] = VERIFIED_INDIAN_BANKS
): BankLookupResult {
  const q = String(rawQuery || "").trim();
  const lower = q.toLowerCase();
  if (!lower || lower === "other" || lower === "other banks" || lower === "other bank") {
    return {
      matched: false,
      verified: false,
      query: q,
      bank: null,
      callResolution: null,
      message: UNVERIFIED_BANK_FALLBACK_MESSAGE,
      messageHi: UNVERIFIED_BANK_FALLBACK_MESSAGE_HI,
    };
  }

  // 1. Exact shortCode or bankName match
  let found = directoryRecords.find(
    (b) => b.shortCode.toLowerCase() === lower || b.bankName.toLowerCase() === lower
  );

  // 2. Alias match (e.g. "State Bank" -> SBI), avoiding generic single words like "bank"
  const genericStopWords = new Set(["bank", "banks", "india", "indian", "local", "other"]);
  if (!found && !genericStopWords.has(lower)) {
    for (const [shortCode, aliases] of Object.entries(BANK_SEARCH_ALIASES)) {
      if (
        aliases.some(
          (alias) =>
            lower === alias ||
            (alias.length >= 3 && lower.includes(alias)) ||
            (lower.length >= 4 && alias.includes(lower))
        )
      ) {
        found = directoryRecords.find((b) => b.shortCode.toUpperCase() === shortCode);
        if (found) break;
      }
    }
  }

  // 3. Substring match on bank name or short code (only if query >= 2 chars and not a generic stop word)
  if (!found && lower.length >= 2 && !genericStopWords.has(lower)) {
    found = directoryRecords.find(
      (b) => b.bankName.toLowerCase().includes(lower) || b.shortCode.toLowerCase().includes(lower)
    );
  }

  if (!found || found.verificationStatus !== "verified") {
    return {
      matched: false,
      verified: false,
      query: q,
      bank: null,
      callResolution: null,
      message: UNVERIFIED_BANK_FALLBACK_MESSAGE,
      messageHi: UNVERIFIED_BANK_FALLBACK_MESSAGE_HI,
    };
  }

  const callResolution = resolveEmergencyCallTarget(found);
  if (callResolution.status !== "ready") {
    return {
      matched: true,
      verified: false,
      query: q,
      bank: null,
      callResolution,
      message: UNVERIFIED_BANK_FALLBACK_MESSAGE,
      messageHi: UNVERIFIED_BANK_FALLBACK_MESSAGE_HI,
    };
  }

  return {
    matched: true,
    verified: true,
    query: q,
    bank: found,
    callResolution,
    message: `Verified official emergency support found for ${found.bankName}.`,
    messageHi: `${found.bankName} के लिए सत्यापित आधिकारिक आपातकालीन सहायता मिली।`,
  };
}

