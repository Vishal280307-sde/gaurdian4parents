import crypto from "node:crypto";
import { db } from "./db.ts";
import { analyzeUrlIntelligence } from "./linkIntelligence.ts";
import {
  evaluateSuspicionScore,
  type RawEvidenceSignal,
  type SuspicionAssessment,
} from "./suspicionScoring.ts";

export type TransparencyStatus =
  | "HIGH RISK"
  | "CAUTION"
  | "NO KNOWN THREAT DETECTED"
  | "MANUAL VERIFICATION REQUIRED"
  | "SOURCE UNAVAILABLE";

export interface SourceCheckEntry {
  sourceName: string;
  sourceNameHi: string;
  informationChecked: string;
  verificationStatus: TransparencyStatus;
  result: string;
  resultHi: string;
  lastCheckedAt: number;
  limitations: string;
  limitationsHi: string;
}

export type CyberIdentifierType = "mobile" | "email" | "upi" | "bank_account" | "url";

export interface CyberSafetyCheckResult {
  identifierType: CyberIdentifierType;
  maskedValue: string;
  overallStatus: TransparencyStatus;
  riskScore: number;
  verifiedMatch: boolean;
  findings: string[];
  findingsHi: string[];
  recommendations: string[];
  recommendationsHi: string[];
  disclaimer: string;
  disclaimerHi: string;
  checkedAt: number;
  sourceChecks: SourceCheckEntry[];
  suspicionAssessment: SuspicionAssessment;
}

const KNOWN_INDIAN_UPI_PSPS = new Set([
  "okaxis",
  "okicici",
  "okhdfcbank",
  "oksbi",
  "ybl",
  "ibl",
  "axl",
  "paytm",
  "ptyes",
  "ptaxis",
  "pthdfc",
  "ptsbi",
  "upi",
  "sbi",
  "icici",
  "hdfcbank",
  "axisbank",
  "barodampay",
  "kotak",
  "indus",
  "federal",
  "apl",
  "waaxis",
  "wahdfcbank",
  "waicici",
  "wasbi",
]);

const OFFICIAL_EMAIL_DOMAINS = new Set([
  "sbi.co.in",
  "onlinesbi.sbi",
  "hdfcbank.com",
  "icicibank.com",
  "axisbank.com",
  "kotak.com",
  "npci.org.in",
  "rbi.org.in",
  "uidai.gov.in",
  "incometax.gov.in",
  "cybercrime.gov.in",
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "yopmail.com",
  "10minutemail.com",
  "trashmail.com",
]);

const KNOWN_BANK_IFSC_PREFIXES = new Set([
  "SBIN",
  "HDFC",
  "ICIC",
  "UTIB",
  "KKBK",
  "BARB",
  "PUNB",
  "CNRB",
  "UBIN",
  "IDIB",
  "IOBA",
  "YESB",
  "FDRL",
  "INDUS",
  "AIRP",
  "PYTM",
]);

function hashIndicator(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24);
}

function maskIdentifier(type: CyberIdentifierType, raw: string): string {
  const clean = raw.trim();
  if (type === "mobile") {
    const digits = clean.replace(/\D/g, "");
    return digits.length >= 6 ? `${digits.slice(0, 2)}••••${digits.slice(-4)}` : "••••";
  }
  if (type === "bank_account") {
    const compact = clean.replace(/\s+/g, "");
    return compact.length >= 6 ? `${compact.slice(0, 2)}••••${compact.slice(-4)}` : "••••";
  }
  if (type === "email") {
    const parts = clean.split("@");
    if (parts.length !== 2) return clean.slice(0, 24);
    const local = parts[0];
    return `${local.slice(0, 2)}•••@${parts[1]}`;
  }
  if (type === "upi") {
    const parts = clean.split("@");
    if (parts.length !== 2) return clean.slice(0, 32);
    const local = parts[0];
    return `${local.slice(0, 3)}•••@${parts[1]}`;
  }
  return clean.slice(0, 80);
}

export async function runCyberSafetyCheck(params: {
  userId?: string | null;
  identifierType: CyberIdentifierType;
  value: string;
}): Promise<CyberSafetyCheckResult> {
  const now = Date.now();
  const rawValue = String(params.value || "").trim();
  if (!rawValue) {
    throw new Error("Enter a mobile number, email, UPI ID, bank identifier, or URL to check.");
  }

  const masked = maskIdentifier(params.identifierType, rawValue);
  const indicatorHash = hashIndicator(rawValue);
  const findings: string[] = [];
  const findingsHi: string[] = [];
  const rawSignals: RawEvidenceSignal[] = [];
  const sourceChecks: SourceCheckEntry[] = [];
  let verifiedMatch = false;
  let markedTrustedLocally = false;

  // 1. Check local Guardian family threat intelligence (SQLite) when userId is present
  let localIntelRow: { reputation_label?: string; report_count?: number } | undefined;
  if (params.userId) {
    localIntelRow = (await db
      .prepare(
        "SELECT reputation_label, report_count FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ? LIMIT 1"
      )
      .get(params.userId, indicatorHash)) as { reputation_label?: string; report_count?: number } | undefined;
  }

  if (localIntelRow?.reputation_label === "trusted") {
    markedTrustedLocally = true;
  }

  if (localIntelRow && (localIntelRow.reputation_label === "malicious" || Number(localIntelRow.report_count || 0) > 0)) {
    verifiedMatch = true;
    const reportCount = Math.max(1, Number(localIntelRow.report_count || 1));
    findings.push("Confirmed match in your Guardian family fraud-intelligence database.");
    findingsHi.push("आपके गार्जियन परिवार के धोखाधड़ी-इंटेलिजेंस डेटाबेस में पुष्टि किया गया मैच मिला है।");
    rawSignals.push({
      code: "VERIFIED_FRAUD_MATCH",
      evidence: `Matched confirmed family threat record (${reportCount} report(s))`,
      evidenceHi: `परिवार सुरक्षा रिकॉर्ड में पुष्टि किया गया मैच (${reportCount} रिपोर्ट)`,
      evidenceKey: `intel:${indicatorHash}`,
      verified: true,
      sourceName: "Guardian Family Threat Cache",
    });
    if (reportCount >= 2) {
      rawSignals.push({
        code: "MULTIPLE_INDEPENDENT_REPORTS",
        evidence: `${reportCount} independent fraud reports recorded`,
        evidenceHi: `${reportCount} स्वतंत्र धोखाधड़ी रिपोर्टें दर्ज हैं`,
        evidenceKey: `intel-multi:${indicatorHash}`,
        verified: true,
        sourceName: "Guardian Family Threat Cache",
        reportKeys: Array.from({ length: reportCount }, (_, idx) => `${indicatorHash}:r:${idx}`),
      });
    }
    sourceChecks.push({
      sourceName: "Guardian Family Threat Cache",
      sourceNameHi: "गार्जियन परिवार थ्रेट कैश",
      informationChecked: masked,
      verificationStatus: "HIGH RISK",
      result: `Flagged in family threat records (${reportCount} report(s)).`,
      resultHi: `परिवार सुरक्षा रिकॉर्ड में चिह्नित (${reportCount} रिपोर्ट)।`,
      lastCheckedAt: now,
      limitations: "Reflects only reports saved within your Guardian family workspace.",
      limitationsHi: "यह केवल आपके गार्जियन परिवार खाते में सहेजी गई रिपोर्ट दिखाता है।",
    });
  } else {
    sourceChecks.push({
      sourceName: "Guardian Family Threat Cache",
      sourceNameHi: "गार्जियन परिवार थ्रेट कैश",
      informationChecked: masked,
      verificationStatus: "NO KNOWN THREAT DETECTED",
      result: "No prior family scam reports matched for this identifier.",
      resultHi: "परिवार के स्थानीय रिकॉर्ड में कोई पूर्व स्कैम रिपोर्ट नहीं मिली।",
      lastCheckedAt: now,
      limitations: "Absence of a local match does NOT guarantee the sender or recipient is safe.",
      limitationsHi: "स्थानीय रिकॉर्ड में न मिलने का अर्थ यह नहीं है कि यह पूरी तरह सुरक्षित है।",
    });
  }

  let requiresManualVerification = true;

  // 2. Identifier-specific structural & pattern verification
  if (params.identifierType === "mobile") {
    const digits = rawValue.replace(/\D/g, "");
    const isValidIndianOrIntl = digits.length >= 10 && digits.length <= 15;
    if (!isValidIndianOrIntl) {
      const msg = "Phone number length/format does not match standard 10-digit Indian or E.164 format.";
      findings.push(msg);
      findingsHi.push("फ़ोन नंबर का प्रारूप मानक 10-अंकीय भारतीय या अंतर्राष्ट्रीय नंबर जैसा नहीं है।");
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: "फ़ोन नंबर का प्रारूप मानक भारतीय या E.164 नंबर से मेल नहीं खाता।",
        evidenceKey: `mobile:format:${indicatorHash}`,
        verified: true,
        sourceName: "Number Format & Pattern Analyzer",
      });
    }
    const isTollFreeOr1930 = /^(1800|1930|155260|14440)/.test(digits);
    const isForeignPrefix = rawValue.startsWith("+") && !rawValue.startsWith("+91");
    if (isForeignPrefix) {
      const msg = "International country code outside India (+91) — verify before sharing personal details.";
      findings.push(msg);
      findingsHi.push("भारत (+91) से बाहर का अंतर्राष्ट्रीय नंबर — व्यक्तिगत जानकारी साझा करने से पहले पुष्टि करें।");
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: "भारत से बाहर का अंतर्राष्ट्रीय देश कोड (+91 नहीं)",
        evidenceKey: `mobile:foreign:${indicatorHash}`,
        verified: true,
        sourceName: "Number Format & Pattern Analyzer",
      });
    }
    if (isTollFreeOr1930) {
      requiresManualVerification = false;
    }
    sourceChecks.push({
      sourceName: "Number Format & Pattern Analyzer",
      sourceNameHi: "नंबर प्रारूप व पैटर्न विश्लेषक",
      informationChecked: masked,
      verificationStatus:
        rawSignals.length > 0 ? "CAUTION" : isTollFreeOr1930 ? "NO KNOWN THREAT DETECTED" : "MANUAL VERIFICATION REQUIRED",
      result: !isValidIndianOrIntl
        ? "Irregular phone number format detected."
        : isForeignPrefix
          ? "Non-Indian country prefix detected; verify caller identity independently."
          : "Standard numeric phone format; caller identity cannot be verified from digits alone.",
      resultHi: !isValidIndianOrIntl
        ? "असामान्य फ़ोन नंबर प्रारूप पाया गया।"
        : isForeignPrefix
          ? "गैर-भारतीय देश कोड पाया गया; स्वतंत्र रूप से पहचान सत्यापित करें।"
          : "सामान्य नंबर प्रारूप; केवल अंकों से कॉलर की असली पहचान सत्यापित नहीं हो सकती।",
      lastCheckedAt: now,
      limitations: "Caller ID can be spoofed; always hang up and dial saved official numbers.",
      limitationsHi: "कॉलर ID नकली (स्पूफ़) हो सकती है; हमेशा सहेजे गए आधिकारिक नंबर पर वापस कॉल करें।",
    });
    sourceChecks.push({
      sourceName: "External Telecom / Chakshu Live Registry",
      sourceNameHi: "बाहरी टेलीकॉम / चक्षु लाइव रजिस्ट्री",
      informationChecked: masked,
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Live external carrier reputation feed is not connected in this preview environment.",
      resultHi: "इस प्रीव्यू में बाहरी लाइव टेलीकॉम डेटाबेस कनेक्ट नहीं है।",
      lastCheckedAt: now,
      limitations: "Requires manual verification via Sanchar Saathi / Chakshu portal or saved bank contacts.",
      limitationsHi: "संचार साथी / चक्षु पोर्टल या सहेजे गए बैंक नंबर से स्वयं पुष्टि आवश्यक है।",
    });
  } else if (params.identifierType === "email") {
    const emailMatch = rawValue.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
    const domain = emailMatch ? emailMatch[2].toLowerCase() : "";
    const isOfficial = domain ? OFFICIAL_EMAIL_DOMAINS.has(domain) : false;
    const isDisposable = domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
    const looksLikeBankSpoof =
      Boolean(domain) &&
      !isOfficial &&
      /(sbi|hdfc|icici|axis|rbi|uidai|incometax|paytm|npci|kyc|support|verify)/i.test(rawValue);

    if (isOfficial) requiresManualVerification = false;

    if (!emailMatch) {
      const msg = "Invalid email address syntax.";
      findings.push(msg);
      findingsHi.push("ईमेल पते का प्रारूप अमान्य है।");
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: "ईमेल पता मानक प्रारूप में नहीं है",
        evidenceKey: `email:syntax:${indicatorHash}`,
        verified: true,
        sourceName: "Domain Allowlist & Spoof Check",
      });
    } else if (isDisposable) {
      const msg = `Disposable temporary email provider (${domain}) — frequently used in scams.`;
      findings.push(msg);
      findingsHi.push(`अस्थायी डिस्पोज़ेबल ईमेल डोमेन (${domain}) — अक्सर धोखाधड़ी में उपयोग होता है।`);
      rawSignals.push({
        code: "SUSPICIOUS_URL_PHISHING",
        evidence: msg,
        evidenceHi: `अस्थायी ईमेल डोमेन (${domain})`,
        evidenceKey: `email:disposable:${domain}`,
        verified: true,
        sourceName: "Domain Allowlist & Spoof Check",
      });
    } else if (looksLikeBankSpoof) {
      const msg = `Domain (${domain}) references banking/government terms without matching official domains.`;
      findings.push(msg);
      findingsHi.push(`ईमेल डोमेन (${domain}) बैंक या सरकारी नाम जैसा दिखता है पर आधिकारिक डोमेन नहीं है।`);
      rawSignals.push({
        code: "SUSPICIOUS_URL_PHISHING",
        evidence: msg,
        evidenceHi: `गैर-आधिकारिक डोमेन (${domain}) बैंकिंग शब्दों का उपयोग करता है`,
        evidenceKey: `email:spoof-domain:${domain}`,
        verified: true,
        sourceName: "Domain Allowlist & Spoof Check",
      });
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: `Sender domain ${domain} is not in verified institution allowlist`,
        evidenceHi: `प्रेषक डोमेन ${domain} सत्यापित संस्था सूची में नहीं है`,
        evidenceKey: `email:unverified:${domain}`,
        verified: true,
        sourceName: "Domain Allowlist & Spoof Check",
      });
    }

    sourceChecks.push({
      sourceName: "Domain Allowlist & Spoof Check",
      sourceNameHi: "डोमेन सूची व नकली पहचान जांच",
      informationChecked: masked,
      verificationStatus: isOfficial
        ? "NO KNOWN THREAT DETECTED"
        : isDisposable || looksLikeBankSpoof
          ? "HIGH RISK"
          : "MANUAL VERIFICATION REQUIRED",
      result: isOfficial
        ? `Matches known official institution domain (${domain}). Still confirm display-name spoofing.`
        : looksLikeBankSpoof || isDisposable
          ? `Suspicious unverified email domain (${domain}).`
          : `Unrecognized sender domain (${domain || "invalid"}) — verify before replying or clicking links.`,
      resultHi: isOfficial
        ? `आधिकारिक संस्था डोमेन (${domain}) से मेल खाता है। फिर भी प्रेषक नाम की जांच करें।`
        : looksLikeBankSpoof || isDisposable
          ? `संदिग्ध या असत्यापित ईमेल डोमेन (${domain})।`
          : `अपरिचित ईमेल डोमेन (${domain || "अमान्य"}) — जवाब देने से पहले पुष्टि करें।`,
      lastCheckedAt: now,
      limitations: "Does not inspect email SPF/DKIM headers unless raw headers are provided.",
      limitationsHi: "ईमेल हेडर (SPF/DKIM) की जांच के बिना प्रेषक की पूर्ण पुष्टि संभव नहीं है।",
    });
    sourceChecks.push({
      sourceName: "External Phishing Email Reputation API",
      sourceNameHi: "बाहरी ईमेल प्रतिष्ठा API",
      informationChecked: masked,
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Real-time third-party email breach/spam feed is not connected.",
      resultHi: "तीसरे पक्ष का लाइव ईमेल स्पैम फ़ीड कनेक्ट नहीं है।",
      lastCheckedAt: now,
      limitations: "Verify independently by calling the organization directly.",
      limitationsHi: "संबंधित संस्था को सीधे कॉल करके स्वतंत्र पुष्टि करें।",
    });
  } else if (params.identifierType === "upi") {
    const parts = rawValue.toLowerCase().split("@");
    const validSyntax = parts.length === 2 && /^[a-z0-9._-]{2,}$/.test(parts[0]) && /^[a-z0-9.-]{2,}$/.test(parts[1]);
    const psp = validSyntax ? parts[1] : "";
    const isKnownPsp = psp ? KNOWN_INDIAN_UPI_PSPS.has(psp) : false;
    const hasRiskyHandle = /(kyc|refund|cashback|prize|lottery|claim|helpdesk|care|support|block)/i.test(rawValue);

    if (!validSyntax) {
      const msg = "Invalid UPI VPA syntax (expected name@bankhandle).";
      findings.push(msg);
      findingsHi.push("अमान्य UPI ID प्रारूप (सही रूप: name@bankhandle)।");
      rawSignals.push({
        code: "SUSPICIOUS_UPI_PAYMENT_PATTERN",
        evidence: msg,
        evidenceHi: "अमान्य UPI ID प्रारूप",
        evidenceKey: `upi:syntax:${indicatorHash}`,
        verified: true,
        sourceName: "UPI VPA & Handle Pattern Engine",
      });
    }
    if (hasRiskyHandle) {
      const msg = "UPI handle contains high-risk lure words (KYC, refund, cashback, or helpdesk).";
      findings.push(msg);
      findingsHi.push("UPI ID में जोखिम भरे शब्द (KYC, रिफंड, कैशबैक या हेल्पडेस्क) शामिल हैं।");
      rawSignals.push({
        code: "SUSPICIOUS_UPI_PAYMENT_PATTERN",
        evidence: msg,
        evidenceHi: "UPI ID में KYC/रिफंड/कैशबैक जैसे जोखिम भरे शब्द हैं",
        evidenceKey: `upi:lure:${indicatorHash}`,
        verified: true,
        sourceName: "UPI VPA & Handle Pattern Engine",
      });
      rawSignals.push({
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: "Handle mimics refund, cashback, or bank support impersonation",
        evidenceHi: "हैंडल रिफंड, कैशबैक या बैंक सहायता का भ्रामक रूप दिखाता है",
        evidenceKey: `upi:deceptive:${indicatorHash}`,
        verified: true,
        sourceName: "UPI VPA & Handle Pattern Engine",
      });
    }
    if (validSyntax && !isKnownPsp) {
      const msg = `PSP handle (@${psp}) is not in the common Indian UPI bank handle list.`;
      findings.push(msg);
      findingsHi.push(`PSP हैंडल (@${psp}) सामान्य भारतीय बैंक हैंडल सूची में नहीं मिला।`);
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: `PSP हैंडल (@${psp}) मान्यता प्राप्त बैंक सूची से मेल नहीं खाता`,
        evidenceKey: `upi:psp:${psp}`,
        verified: true,
        sourceName: "UPI VPA & Handle Pattern Engine",
      });
    }

    sourceChecks.push({
      sourceName: "UPI VPA & Handle Pattern Engine",
      sourceNameHi: "UPI VPA व हैंडल पैटर्न इंजन",
      informationChecked: masked,
      verificationStatus: hasRiskyHandle
        ? "HIGH RISK"
        : !validSyntax || !isKnownPsp
          ? "CAUTION"
          : "MANUAL VERIFICATION REQUIRED",
      result: hasRiskyHandle
        ? "UPI handle matches common scam lure patterns."
        : isKnownPsp
          ? `Recognized PSP handle (@${psp}), but account holder identity is NOT verified here.`
          : "Unrecognized or malformed UPI handle.",
      resultHi: hasRiskyHandle
        ? "UPI ID सामान्य धोखाधड़ी पैटर्न से मेल खाती है।"
        : isKnownPsp
          ? `परिचित बैंक हैंडल (@${psp}), लेकिन खाताधारक के नाम की पुष्टि यहाँ नहीं हुई है।`
          : "अपरिचित या गलत UPI हैंडल।",
      lastCheckedAt: now,
      limitations: "Confirm the verified banking name inside your UPI app before entering UPI PIN.",
      limitationsHi: "UPI PIN डालने से पहले अपने UPI ऐप में दिखने वाले असली बैंकिंग नाम की पुष्टि अवश्य करें।",
    });
    sourceChecks.push({
      sourceName: "NPCI Live VPA Beneficiary Registry",
      sourceNameHi: "NPCI लाइव लाभार्थी नाम रजिस्ट्री",
      informationChecked: masked,
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Live NPCI beneficiary-name resolution requires a banking PSP API connection.",
      resultHi: "लाइव NPCI खाताधारक नाम जांच बैंकिंग PSP API के बिना उपलब्ध नहीं है।",
      lastCheckedAt: now,
      limitations: "Only your official UPI app displays the verified bank name prior to payment.",
      limitationsHi: "केवल आपका आधिकारिक UPI ऐप ही भुगतान से पहले सत्यापित बैंक नाम दिखाता है।",
    });
  } else if (params.identifierType === "bank_account") {
    const compact = rawValue.toUpperCase().replace(/\s+/g, "");
    const ifscMatch = compact.match(/\b([A-Z]{4})0([A-Z0-9]{6})\b/);
    const digitsMatch = compact.match(/\d{9,18}/);

    if (!ifscMatch && !digitsMatch) {
      const msg = "Input does not match a standard 9–18 digit account number or 11-character IFSC code.";
      findings.push(msg);
      findingsHi.push("यह मानक 9–18 अंकों के खाता नंबर या 11-अक्षर के IFSC कोड जैसा नहीं है।");
      rawSignals.push({
        code: "SUSPICIOUS_UPI_PAYMENT_PATTERN",
        evidence: msg,
        evidenceHi: "मानक बैंक खाता या IFSC प्रारूप से मेल नहीं खाता",
        evidenceKey: `bank:syntax:${indicatorHash}`,
        verified: true,
        sourceName: "Indian Bank Account & IFSC Structure Check",
      });
    }
    if (ifscMatch) {
      const prefix = ifscMatch[1];
      if (!KNOWN_BANK_IFSC_PREFIXES.has(prefix)) {
        const msg = `IFSC bank prefix (${prefix}) could not be matched to the common Indian bank list.`;
        findings.push(msg);
        findingsHi.push(`IFSC बैंक कोड (${prefix}) प्रमुख भारतीय बैंकों की सूची में नहीं मिला।`);
        rawSignals.push({
          code: "UNVERIFIED_IDENTITY_MISMATCH",
          evidence: msg,
          evidenceHi: `IFSC बैंक कोड (${prefix}) प्रमुख बैंक सूची में नहीं मिला`,
          evidenceKey: `bank:ifsc:${prefix}`,
          verified: true,
          sourceName: "Indian Bank Account & IFSC Structure Check",
        });
      } else {
        findings.push(`Valid IFSC structure detected for bank code ${prefix}.`);
        findingsHi.push(`बैंक कोड ${prefix} के लिए वैध IFSC संरचना मिली।`);
      }
    }

    sourceChecks.push({
      sourceName: "Indian Bank Account & IFSC Structure Check",
      sourceNameHi: "भारतीय बैंक खाता व IFSC संरचना जांच",
      informationChecked: masked,
      verificationStatus: rawSignals.length > 0 ? "CAUTION" : "MANUAL VERIFICATION REQUIRED",
      result: ifscMatch
        ? "IFSC structure checked; beneficiary ownership requires manual confirmation."
        : digitsMatch
          ? "Numeric account length checked; beneficiary name cannot be confirmed locally."
          : "Could not parse valid IFSC or account number structure.",
      resultHi: ifscMatch
        ? "IFSC संरचना की जांच हुई; खाताधारक के नाम की पुष्टि मैन्युअल रूप से करें।"
        : digitsMatch
          ? "खाता संख्या की लंबाई वैध है; खाताधारक का नाम यहाँ सत्यापित नहीं हो सकता।"
          : "वैध IFSC या खाता संख्या नहीं मिली।",
      lastCheckedAt: now,
      limitations: "Never transfer money without confirming the beneficiary account directly with the person.",
      limitationsHi: "संबंधित व्यक्ति से सीधे बात किए बिना कभी बैंक ट्रांसफर न करें।",
    });
    sourceChecks.push({
      sourceName: "Bank Penny-Drop / Account Holder Lookup",
      sourceNameHi: "बैंक खाताधारक नाम सत्यापन सेवा",
      informationChecked: masked,
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Live bank account name verification is unavailable without banking network integration.",
      resultHi: "बैंकिंग नेटवर्क के बिना लाइव खाताधारक नाम सत्यापन उपलब्ध नहीं है।",
      lastCheckedAt: now,
      limitations: "Requires manual confirmation via your bank's official transfer screen.",
      limitationsHi: "अपने आधिकारिक बैंक ऐप की ट्रांसफर स्क्रीन पर नाम की पुष्टि आवश्यक है।",
    });
  } else if (params.identifierType === "url") {
    const urlInfo = await analyzeUrlIntelligence(rawValue, { userId: params.userId || undefined });
    if (urlInfo.rawSignals?.length) {
      rawSignals.push(...urlInfo.rawSignals);
    }
    if (urlInfo.signals.length > 0) {
      findings.push(...urlInfo.signals);
      findingsHi.push(...urlInfo.signals);
    }
    const isOfficialSite = OFFICIAL_EMAIL_DOMAINS.has(urlInfo.domain);
    if (isOfficialSite) requiresManualVerification = false;
    sourceChecks.push(...urlInfo.sourceChecks.filter((s) => s.sourceName !== "Guardian Family Threat Cache"));
  }

  const suspicionAssessment = evaluateSuspicionScore({
    category: params.identifierType === "url" ? "Website and URL Analysis" : "Personal Cyber Safety Check",
    maskedIdentifier: masked,
    rawSignals,
    sourceChecks,
    markedTrustedLocally,
    requiresManualVerification,
    evaluatedAt: now,
  });

  const finalScore = suspicionAssessment.score;
  let overallStatus: TransparencyStatus = "MANUAL VERIFICATION REQUIRED";
  if (suspicionAssessment.riskLevel === "HIGH" || verifiedMatch) {
    overallStatus = "HIGH RISK";
  } else if (suspicionAssessment.riskLevel === "MODERATE" || rawSignals.length > 0) {
    overallStatus = "CAUTION";
  } else if (!requiresManualVerification && sourceChecks.some((s) => s.verificationStatus === "NO KNOWN THREAT DETECTED")) {
    overallStatus = "NO KNOWN THREAT DETECTED";
  }

  return {
    identifierType: params.identifierType,
    maskedValue: masked,
    overallStatus,
    riskScore: finalScore,
    verifiedMatch,
    findings,
    findingsHi,
    recommendations: suspicionAssessment.recommendedActions,
    recommendationsHi: suspicionAssessment.recommendedActionsHi,
    disclaimer: suspicionAssessment.disclaimer,
    disclaimerHi: suspicionAssessment.disclaimerHi,
    checkedAt: now,
    sourceChecks,
    suspicionAssessment,
  };
}
