import crypto from "node:crypto";
import { db } from "./db.ts";
import type { SourceCheckEntry } from "./cyberSafetyCheck.ts";
import {
  evaluateSuspicionScore,
  type RawEvidenceSignal,
  type SuspicionAssessment,
  type UnifiedRiskLevel,
} from "./suspicionScoring.ts";

export interface LinkIntelligenceResult {
  normalizedUrl: string;
  domain: string;
  scheme: string;
  riskScore: number;
  riskLevel: UnifiedRiskLevel;
  signals: string[];
  isShortener: boolean;
  isIpLiteral: boolean;
  looksLikeImpersonation: boolean;
  summary: string;
  sourceChecks: SourceCheckEntry[];
  suspicionAssessment: SuspicionAssessment;
  rawSignals?: RawEvidenceSignal[];
}

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "rb.gy",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "ow.ly",
  "tiny.cc",
]);

const SUSPICIOUS_TLDS = [".xyz", ".top", ".buzz", ".click", ".loan", ".work", ".gq", ".tk", ".ml", ".cf", ".club", ".online"];

const IMPERSONATION_BRANDS = [
  "sbi",
  "hdfc",
  "icici",
  "axis",
  "kotak",
  "paytm",
  "phonepe",
  "gpay",
  "bhim",
  "npci",
  "aadhaar",
  "uidai",
  "incometax",
  "epfo",
  "rbi",
  "bescom",
  "mahavitaran",
];

const OFFICIAL_DOMAINS = new Set([
  "onlinesbi.sbi",
  "sbi.co.in",
  "hdfcbank.com",
  "icicibank.com",
  "axisbank.com",
  "kotak.com",
  "paytm.com",
  "phonepe.com",
  "npci.org.in",
  "uidai.gov.in",
  "incometax.gov.in",
  "rbi.org.in",
  "cybercrime.gov.in",
]);

export function extractUrlsFromText(text: string): string[] {
  const matches = String(text || "").match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map((m) => m.replace(/[),.;!?]+$/, "")))].slice(0, 10);
}

export async function analyzeUrlIntelligence(
  rawUrl: string,
  options?: { userId?: string; contextText?: string; allowNetworkProbe?: boolean }
): Promise<LinkIntelligenceResult> {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("URL is empty.");
  }

  const checkedAt = Date.now();
  const candidate = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Invalid URL format.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const rawSignals: RawEvidenceSignal[] = [
      {
        code: "SUSPICIOUS_URL_PHISHING",
        evidence: `Unsupported or risky URI scheme (${parsed.protocol})`,
        evidenceHi: `असुरक्षित या गैर-वेब URI स्कीम (${parsed.protocol})`,
        evidenceKey: `url:scheme:${parsed.protocol}`,
        verified: true,
        sourceName: "Static URL & Domain Inspector",
      },
      {
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: "Non-web URI attempts to launch local app handlers directly",
        evidenceHi: "गैर-वेब लिंक सीधे ऐप हैंडलर खोलने का प्रयास कर रहा है",
        evidenceKey: `url:nonweb:${parsed.protocol}`,
        verified: true,
        sourceName: "Static URL & Domain Inspector",
      },
    ];
    const sourceChecks: SourceCheckEntry[] = [
      {
        sourceName: "Static URL & Domain Inspector",
        sourceNameHi: "स्थैतिक URL और डोमेन निरीक्षक",
        informationChecked: "URI scheme and host classification (no external fetch executed)",
        verificationStatus: "HIGH RISK",
        result: `Blocked non-web scheme (${parsed.protocol})`,
        resultHi: `गैर-वेब स्कीम (${parsed.protocol}) को असुरक्षित चिह्नित किया गया`,
        lastCheckedAt: checkedAt,
        limitations: "Static analysis only — URL was NOT opened or executed.",
        limitationsHi: "केवल स्थैतिक जांच — लिंक को खोला या चलाया नहीं गया है।",
      },
    ];
    const suspicionAssessment = evaluateSuspicionScore({
      category: "Website and URL Analysis",
      maskedIdentifier: trimmed.slice(0, 80),
      rawSignals,
      sourceChecks,
      requiresManualVerification: true,
      evaluatedAt: checkedAt,
    });
    return {
      normalizedUrl: trimmed.slice(0, 200),
      domain: "non-web-scheme",
      scheme: parsed.protocol,
      riskScore: suspicionAssessment.score,
      riskLevel: suspicionAssessment.riskLevel,
      signals: [`Unsupported or risky URI scheme (${parsed.protocol})`],
      isShortener: false,
      isIpLiteral: false,
      looksLikeImpersonation: false,
      summary: "Non-web link scheme detected. Do not open unverified app launch links.",
      sourceChecks,
      suspicionAssessment,
      rawSignals,
    };
  }

  const domain = parsed.hostname.toLowerCase();
  const signals: string[] = [];
  const rawSignals: RawEvidenceSignal[] = [];

  if (parsed.protocol === "http:") {
    signals.push("Unencrypted HTTP connection (not HTTPS)");
    rawSignals.push({
      code: "SUSPICIOUS_URL_PHISHING",
      evidence: "Unencrypted HTTP connection (not HTTPS)",
      evidenceHi: "असुरक्षित HTTP कनेक्शन (HTTPS एन्क्रिप्शन नहीं)",
      evidenceKey: `url:http:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain) || domain.startsWith("[");
  if (isIpLiteral) {
    signals.push("Uses raw IP address instead of verified domain name");
    rawSignals.push({
      code: "SUSPICIOUS_URL_PHISHING",
      evidence: "Uses raw IP address instead of a verified domain name",
      evidenceHi: "सत्यापित डोमेन नाम के बजाय सीधे IP पते का उपयोग",
      evidenceKey: `url:ip:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  const isShortener = SHORTENER_HOSTS.has(domain);
  if (isShortener) {
    signals.push("Shortened URL hides final destination");
    rawSignals.push({
      code: "SUSPICIOUS_URL_PHISHING",
      evidence: `URL shortener (${domain}) conceals the real destination`,
      evidenceHi: `शॉर्टनर URL (${domain}) असली वेबसाइट को छुपाता है`,
      evidenceKey: `url:shortener:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  if (domain.includes("xn--")) {
    signals.push("Punycode / lookalike internationalized domain");
    rawSignals.push({
      code: "SUSPICIOUS_URL_PHISHING",
      evidence: "Punycode lookalike domain characters detected",
      evidenceHi: "नकली दिखने वाले प्यूनीकोड डोमेन अक्षर मिले",
      evidenceKey: `url:punycode:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  if (SUSPICIOUS_TLDS.some((tld) => domain.endsWith(tld))) {
    signals.push("High-risk disposable top-level domain");
    rawSignals.push({
      code: "SUSPICIOUS_URL_PHISHING",
      evidence: `Disposable or high-risk top-level domain on ${domain}`,
      evidenceHi: `${domain} पर उच्च जोखिम वाला डिस्पोज़ेबल डोमेन एक्सटेंशन`,
      evidenceKey: `url:tld:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  const isOfficial = OFFICIAL_DOMAINS.has(domain) || domain.endsWith(".gov.in") || domain.endsWith(".nic.in");
  let looksLikeImpersonation = false;
  if (!isOfficial) {
    const matchedBrand = IMPERSONATION_BRANDS.find((b) => domain.includes(b) || parsed.pathname.toLowerCase().includes(b));
    if (matchedBrand) {
      looksLikeImpersonation = true;
      const msg = `Mentions '${matchedBrand.toUpperCase()}' outside an official bank or government domain`;
      signals.push(msg);
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: `आधिकारिक बैंक/सरकारी डोमेन के बाहर '${matchedBrand.toUpperCase()}' नाम का उपयोग`,
        evidenceKey: `url:impersonation:${domain}:${matchedBrand}`,
        verified: true,
        sourceName: "Static URL & Domain Inspector",
      });
    }
  }

  const fullLower = `${domain}${parsed.pathname}${parsed.search}`.toLowerCase();
  if (/(kyc|verify|update-pan|unlock|refund|reward|apk|download|claim)/.test(fullLower)) {
    const msg = "URL path contains credential, refund, or APK download lure keywords";
    signals.push(msg);
    rawSignals.push({
      code: "DECEPTIVE_PAYMENT_REQUEST",
      evidence: msg,
      evidenceHi: "URL में KYC, रिफंड या APK डाउनलोड जैसे जाल शब्द मौजूद हैं",
      evidenceKey: `url:lure:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  if (/\.apk(\?|$)/i.test(parsed.pathname)) {
    const msg = "Direct Android APK download link";
    signals.push(msg);
    rawSignals.push({
      code: "MALICIOUS_QR_DESTINATION",
      evidence: msg,
      evidenceHi: "सीधा Android APK डाउनलोड लिंक (उच्च खतरा)",
      evidenceKey: `url:apk:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  if (options?.contextText && /(urgent|block|suspend|kyc|otp|pin)/i.test(options.contextText)) {
    const msg = "Accompanying message uses urgency or account-block pressure";
    signals.push(msg);
    rawSignals.push({
      code: "DECEPTIVE_PAYMENT_REQUEST",
      evidence: msg,
      evidenceHi: "संदेश में खाते के बंद होने या तुरंत कार्रवाई का दबाव है",
      evidenceKey: `url:urgency:${domain}`,
      verified: true,
      sourceName: "Static URL & Domain Inspector",
    });
  }

  let familyCacheFlagged = false;
  let familyTrusted = false;
  let familyReportCount = 0;
  if (options?.userId) {
    const domainHash = crypto.createHash("sha256").update(domain).digest("hex");
    const intel = (await db
      .prepare("SELECT reputation_label, report_count FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ? LIMIT 1")
      .get(options.userId, domainHash)) as { reputation_label: string; report_count: number } | undefined;
    if (intel?.reputation_label === "trusted") {
      familyTrusted = true;
    }
    if (intel?.reputation_label === "malicious" || (intel && intel.report_count > 0)) {
      familyCacheFlagged = true;
      familyReportCount = Math.max(1, Number(intel.report_count || 1));
      signals.push("Previously flagged by your family protection hub");
      rawSignals.push({
        code: "VERIFIED_FRAUD_MATCH",
        evidence: "Domain matched a confirmed malicious report in your family threat intelligence cache",
        evidenceHi: "यह डोमेन आपके परिवार सुरक्षा कैश में पहले से दर्ज धोखाधड़ी रिपोर्ट से मेल खाता है",
        evidenceKey: `intel:${domainHash}`,
        verified: true,
        sourceName: "Guardian Family Threat Cache",
      });
      if (familyReportCount >= 2) {
        rawSignals.push({
          code: "MULTIPLE_INDEPENDENT_REPORTS",
          evidence: `Multiple independent reports recorded (${familyReportCount} reports)`,
          evidenceHi: `कई स्वतंत्र रिपोर्ट दर्ज हैं (${familyReportCount} रिपोर्ट)`,
          evidenceKey: `intel-multi:${domainHash}`,
          verified: true,
          sourceName: "Guardian Family Threat Cache",
          reportKeys: Array.from({ length: familyReportCount }, (_, idx) => `${domainHash}:rep:${idx}`),
        });
      }
    }
  }

  const prelimCount = rawSignals.length;
  const sourceChecks: SourceCheckEntry[] = [
    {
      sourceName: "Static URL & Domain Inspector",
      sourceNameHi: "स्थैतिक URL और डोमेन निरीक्षक",
      informationChecked: "Protocol encryption, punycode, shorteners, disposable TLDs, and bank/gov impersonation",
      verificationStatus:
        looksLikeImpersonation || isIpLiteral || /\.apk(\?|$)/i.test(parsed.pathname)
          ? "HIGH RISK"
          : prelimCount > 0
            ? "CAUTION"
            : isOfficial
              ? "NO KNOWN THREAT DETECTED"
              : "MANUAL VERIFICATION REQUIRED",
      result:
        signals.length > 0
          ? `${signals.length} phishing indicator(s) triggered on ${domain}`
          : `No structural phishing flags matched on ${domain}`,
      resultHi:
        signals.length > 0
          ? `${domain} पर ${signals.length} फ़िशिंग संकेत मिले`
          : `${domain} की संरचना में कोई स्पष्ट फ़िशिंग संकेत नहीं मिला`,
      lastCheckedAt: checkedAt,
      limitations: "Static inspection only — URL was NOT opened, downloaded, or executed.",
      limitationsHi: "केवल स्थैतिक जांच — URL को खोला, डाउनलोड या चलाया नहीं गया है।",
    },
    {
      sourceName: "Guardian Family Threat Cache",
      sourceNameHi: "गार्जियन परिवार थ्रेट कैश",
      informationChecked: "SHA-256 domain hash against previously flagged family links",
      verificationStatus: familyCacheFlagged ? "HIGH RISK" : "NO KNOWN THREAT DETECTED",
      result: familyCacheFlagged
        ? `Previously reported as suspicious in this family's threat history (${familyReportCount} report(s))`
        : "Not present in this family's prior flagged domains",
      resultHi: familyCacheFlagged
        ? `इस परिवार के थ्रेट इतिहास में संदिग्ध दर्ज (${familyReportCount} रिपोर्ट)`
        : "इस परिवार के पहले से चिह्नित डोमेन रिकॉर्ड में मौजूद नहीं है",
      lastCheckedAt: checkedAt,
      limitations: "Scoped only to reports recorded within this family workspace.",
      limitationsHi: "केवल इस परिवार के कार्यक्षेत्र में दर्ज रिपोर्ट तक सीमित।",
    },
    {
      sourceName: "External Real-Time URL Threat Feed",
      sourceNameHi: "बाहरी रीयल-टाइम URL थ्रेट फ़ीड",
      informationChecked: "Live third-party Safe Browsing / registrar WHOIS feed",
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Live external domain reputation feed is not connected in this environment",
      resultHi: "इस वातावरण में लाइव बाहरी डोमेन प्रतिष्ठा फ़ीड कनेक्ट नहीं है",
      lastCheckedAt: checkedAt,
      limitations: "Visit official bank/government portals directly via bookmarks instead of unfamiliar links.",
      limitationsHi: "अनजान लिंक के बजाय अपने बुकमार्क या आधिकारिक ऐप से बैंक/सरकारी पोर्टल खोलें।",
    },
  ];

  const suspicionAssessment = evaluateSuspicionScore({
    category: "Website and URL Analysis",
    maskedIdentifier: parsed.hostname.toLowerCase(),
    rawSignals,
    sourceChecks,
    markedTrustedLocally: familyTrusted,
    requiresManualVerification: !isOfficial,
    evaluatedAt: checkedAt,
  });

  const riskLevel = suspicionAssessment.riskLevel;
  let summary = "No obvious phishing traits found in domain structure, though verify sender identity before logging in.";
  if (riskLevel === "HIGH") {
    summary = "High phishing risk. Do not tap this link or enter bank/UPI/OTP details.";
  } else if (riskLevel === "MODERATE") {
    summary = "Moderate risk — caution advised. Confirm with your guardian or visit the official website directly.";
  }

  return {
    normalizedUrl: parsed.toString().slice(0, 320),
    domain,
    scheme: parsed.protocol,
    riskScore: suspicionAssessment.score,
    riskLevel,
    signals,
    isShortener,
    isIpLiteral,
    looksLikeImpersonation,
    summary,
    sourceChecks,
    suspicionAssessment,
    rawSignals,
  };
}
