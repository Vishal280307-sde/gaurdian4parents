import type { SourceCheckEntry, TransparencyStatus } from "./cyberSafetyCheck.ts";

export type UnifiedRiskLevel = "LOW" | "MODERATE" | "HIGH";
export type UnifiedRiskLabel = "LOW RISK" | "MODERATE RISK" | "HIGH RISK";
export type SuspicionCategory =
  | "QR Intelligence"
  | "Phone Fraud Detection"
  | "Personal Cyber Safety Check"
  | "Website and URL Analysis";

export type IndicatorCode =
  | "VERIFIED_FRAUD_MATCH"
  | "MULTIPLE_INDEPENDENT_REPORTS"
  | "SUSPICIOUS_URL_PHISHING"
  | "MALICIOUS_QR_DESTINATION"
  | "SUSPICIOUS_UPI_PAYMENT_PATTERN"
  | "UNVERIFIED_IDENTITY_MISMATCH"
  | "REPEATED_COMMUNITY_REPORTS"
  | "DECEPTIVE_PAYMENT_REQUEST";

export const INDICATOR_WEIGHTS: Record<
  IndicatorCode,
  { points: number; label: string; labelHi: string }
> = {
  VERIFIED_FRAUD_MATCH: {
    points: 40,
    label: "Confirmed match in a trusted fraud-intelligence source",
    labelHi: "विश्वसनीय धोखाधड़ी-इंटेलिजेंस स्रोत में पुष्टि किया गया मैच",
  },
  MULTIPLE_INDEPENDENT_REPORTS: {
    points: 20,
    label: "Multiple independent fraud reports",
    labelHi: "कई स्वतंत्र धोखाधड़ी रिपोर्टें",
  },
  SUSPICIOUS_URL_PHISHING: {
    points: 30,
    label: "Suspicious URL or phishing-domain detection",
    labelHi: "संदिग्ध URL या फ़िशिंग डोमेन पहचान",
  },
  MALICIOUS_QR_DESTINATION: {
    points: 35,
    label: "Known malicious QR destination",
    labelHi: "ज्ञात दुर्भावनापूर्ण QR गंतव्य",
  },
  SUSPICIOUS_UPI_PAYMENT_PATTERN: {
    points: 15,
    label: "Suspicious UPI or payment identifier pattern",
    labelHi: "संदिग्ध UPI या भुगतान पहचान पैटर्न",
  },
  UNVERIFIED_IDENTITY_MISMATCH: {
    points: 15,
    label: "Unverified identity or recipient mismatch",
    labelHi: "असत्यापित पहचान या प्राप्तकर्ता नाम बेमेल",
  },
  REPEATED_COMMUNITY_REPORTS: {
    points: 10,
    label: "Repeated suspicious community reports",
    labelHi: "बार-बार संदिग्ध सामुदायिक रिपोर्टें",
  },
  DECEPTIVE_PAYMENT_REQUEST: {
    points: 15,
    label: "Unusual or deceptive payment request indicators",
    labelHi: "असामान्य या भ्रामक भुगतान अनुरोध संकेत",
  },
};

export interface RawEvidenceSignal {
  code: IndicatorCode;
  evidence: string;
  evidenceHi?: string;
  /** Canonical evidence key used to deduplicate identical underlying evidence/reports. */
  evidenceKey: string;
  /** Whether this signal comes from a verified/trusted source rather than unverified community input. */
  verified: boolean;
  sourceName: string;
  /** Optional distinct independent report keys (used for MULTIPLE_INDEPENDENT_REPORTS). */
  reportKeys?: string[];
}

export interface SuspicionIndicatorItem {
  code: IndicatorCode;
  label: string;
  labelHi: string;
  points: number;
  evidence: string[];
  evidenceHi: string[];
  sourceName: string;
  verified: boolean;
}

export interface SuspicionAssessment {
  score: number;
  riskLevel: UnifiedRiskLevel;
  riskLabel: UnifiedRiskLabel;
  formattedScore: string;
  category: SuspicionCategory;
  maskedIdentifier: string;
  verificationStatus: TransparencyStatus;
  indicators: SuspicionIndicatorItem[];
  deduplicatedCount: number;
  sourcesChecked: SourceCheckEntry[];
  sourcesUnavailable: string[];
  conflictingSources: boolean;
  conflictNote?: string;
  conflictNoteHi?: string;
  mainReason: string;
  mainReasonHi: string;
  recommendedActions: string[];
  recommendedActionsHi: string[];
  disclaimer: string;
  disclaimerHi: string;
  evaluatedAt: number;
}

export interface EvaluateSuspicionInput {
  category: SuspicionCategory;
  maskedIdentifier: string;
  rawSignals: RawEvidenceSignal[];
  sourceChecks: SourceCheckEntry[];
  /** Explicit verified trusted status from local allowlist/trusted contact (used to surface conflicts transparently). */
  markedTrustedLocally?: boolean;
  requiresManualVerification?: boolean;
  lang?: "en" | "hi";
  evaluatedAt?: number;
}

export function classifySuspicionScore(score: number): {
  riskLevel: UnifiedRiskLevel;
  riskLabel: UnifiedRiskLabel;
} {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 70) {
    return { riskLevel: "HIGH", riskLabel: "HIGH RISK" };
  }
  if (clamped >= 30) {
    return { riskLevel: "MODERATE", riskLabel: "MODERATE RISK" };
  }
  return { riskLevel: "LOW", riskLabel: "LOW RISK" };
}

export function evaluateSuspicionScore(input: EvaluateSuspicionInput): SuspicionAssessment {
  const evaluatedAt = input.evaluatedAt ?? Date.now();
  const seenKeys = new Set<string>();
  let deduplicatedCount = 0;

  const grouped = new Map<
    IndicatorCode,
    {
      evidence: string[];
      evidenceHi: string[];
      evidenceKeys: Set<string>;
      reportKeys: Set<string>;
      sourceNames: Set<string>;
      verified: boolean;
    }
  >();

  for (const raw of input.rawSignals || []) {
    // Safeguard 1: Never allow an unverified report to trigger VERIFIED_FRAUD_MATCH (+40).
    // Downgrade unverified fraud-match claims to REPEATED_COMMUNITY_REPORTS (+10) if they represent community reports.
    let effectiveCode: IndicatorCode = raw.code;
    if (raw.code === "VERIFIED_FRAUD_MATCH" && !raw.verified) {
      effectiveCode = "REPEATED_COMMUNITY_REPORTS";
    }

    const normKey = `${effectiveCode}::${String(raw.evidenceKey || raw.evidence)
      .trim()
      .toLowerCase()}`;

    if (seenKeys.has(normKey)) {
      deduplicatedCount += 1;
      continue;
    }
    seenKeys.add(normKey);

    let bucket = grouped.get(effectiveCode);
    if (!bucket) {
      bucket = {
        evidence: [],
        evidenceHi: [],
        evidenceKeys: new Set<string>(),
        reportKeys: new Set<string>(),
        sourceNames: new Set<string>(),
        verified: raw.verified,
      };
      grouped.set(effectiveCode, bucket);
    }

    const evText = String(raw.evidence || "").trim();
    const evHiText = String(raw.evidenceHi || evText).trim();
    if (evText && !bucket.evidence.includes(evText)) {
      bucket.evidence.push(evText);
      bucket.evidenceHi.push(evHiText);
    }
    bucket.evidenceKeys.add(String(raw.evidenceKey || evText).trim().toLowerCase());
    if (Array.isArray(raw.reportKeys)) {
      for (const rk of raw.reportKeys) {
        const cleanRk = String(rk || "").trim().toLowerCase();
        if (cleanRk) bucket.reportKeys.add(cleanRk);
      }
    }
    if (raw.sourceName) bucket.sourceNames.add(raw.sourceName);
    if (raw.verified) bucket.verified = true;
  }

  // Safeguard 2: MULTIPLE_INDEPENDENT_REPORTS (+20) strictly requires >= 2 unique reportKeys
  // (or >= 2 distinct evidenceKeys when explicit reportKeys are omitted).
  // Duplicate copies of a single report must NEVER unlock MULTIPLE_INDEPENDENT_REPORTS.
  const multiBucket = grouped.get("MULTIPLE_INDEPENDENT_REPORTS");
  if (multiBucket) {
    const distinctReportCount =
      multiBucket.reportKeys.size > 0 ? multiBucket.reportKeys.size : multiBucket.evidenceKeys.size;
    if (distinctReportCount < 2 || !multiBucket.verified) {
      grouped.delete("MULTIPLE_INDEPENDENT_REPORTS");
      // Ensure the single/unverified report still counts at most once as REPEATED_COMMUNITY_REPORTS (+10) only if unverified >=2 or drop if single duplicate
      if (!multiBucket.verified && distinctReportCount >= 2 && !grouped.has("REPEATED_COMMUNITY_REPORTS")) {
        grouped.set("REPEATED_COMMUNITY_REPORTS", multiBucket);
      }
    }
  }

  // Build ordered indicator list and deterministic sum (each indicator code contributes at most once)
  const codeOrder: IndicatorCode[] = [
    "VERIFIED_FRAUD_MATCH",
    "MALICIOUS_QR_DESTINATION",
    "SUSPICIOUS_URL_PHISHING",
    "MULTIPLE_INDEPENDENT_REPORTS",
    "SUSPICIOUS_UPI_PAYMENT_PATTERN",
    "UNVERIFIED_IDENTITY_MISMATCH",
    "DECEPTIVE_PAYMENT_REQUEST",
    "REPEATED_COMMUNITY_REPORTS",
  ];

  const indicators: SuspicionIndicatorItem[] = [];
  let rawTotal = 0;

  for (const code of codeOrder) {
    const bucket = grouped.get(code);
    if (!bucket) continue;
    const weight = INDICATOR_WEIGHTS[code];
    rawTotal += weight.points;
    indicators.push({
      code,
      label: weight.label,
      labelHi: weight.labelHi,
      points: weight.points,
      evidence: bucket.evidence,
      evidenceHi: bucket.evidenceHi,
      sourceName: [...bucket.sourceNames].join(", "),
      verified: bucket.verified,
    });
  }

  const score = Math.min(100, Math.max(0, rawTotal));
  const { riskLevel, riskLabel } = classifySuspicionScore(score);
  const formattedScore = `${score}/100 — ${riskLabel}`;

  // Track unavailable sources separately; NEVER add points for unavailable sources.
  const sourcesChecked = input.sourceChecks || [];
  const sourcesUnavailable = sourcesChecked
    .filter((s) => s.verificationStatus === "SOURCE UNAVAILABLE")
    .map((s) => s.sourceName);

  // Conflict detection: one source shows HIGH RISK / malicious match while another checked source explicitly shows NO KNOWN THREAT DETECTED or local trusted marker.
  const hasHighRiskSource =
    sourcesChecked.some((s) => s.verificationStatus === "HIGH RISK") || indicators.some((i) => i.verified);
  const hasCleanCheckedSource =
    Boolean(input.markedTrustedLocally) ||
    sourcesChecked.some((s) => s.verificationStatus === "NO KNOWN THREAT DETECTED");
  const conflictingSources = Boolean(hasHighRiskSource && hasCleanCheckedSource && indicators.length > 0);

  let conflictNote: string | undefined;
  let conflictNoteHi: string | undefined;
  if (conflictingSources) {
    conflictNote = input.markedTrustedLocally
      ? "Conflicting signals: locally marked trusted, yet risk/fraud evidence was also found. Verify via a saved phone number before acting."
      : "Conflicting source results: some checks found no match while other intelligence detected risk indicators. Treat with caution.";
    conflictNoteHi = input.markedTrustedLocally
      ? "परस्पर विरोधी संकेत: स्थानीय रूप से विश्वसनीय चिह्नित होने के बावजूद जोखिम साक्ष्य मिले हैं। कार्रवाई से पहले सहेजे गए नंबर से पुष्टि करें।"
      : "स्रोत परिणामों में अंतर: कुछ जांच में कोई खतरा नहीं मिला जबकि अन्य ने जोखिम संकेत पाए। सावधानी बरतें।";
  }

  // Honest verification status (do not inflate unknown numbers or claim guaranteed safety at score 0)
  let verificationStatus: TransparencyStatus;
  if (riskLevel === "HIGH") {
    verificationStatus = "HIGH RISK";
  } else if (riskLevel === "MODERATE") {
    verificationStatus = indicators.some((i) => i.code === "VERIFIED_FRAUD_MATCH") ? "HIGH RISK" : "CAUTION";
  } else if (indicators.length > 0) {
    verificationStatus = "CAUTION";
  } else if (input.requiresManualVerification || sourcesUnavailable.length > 0) {
    verificationStatus = "MANUAL VERIFICATION REQUIRED";
  } else {
    verificationStatus = "NO KNOWN THREAT DETECTED";
  }

  const mainReason =
    indicators.length > 0
      ? indicators[0].evidence[0] || indicators[0].label
      : input.requiresManualVerification
        ? "No fraud reports found, but identity is unverified — manual confirmation required."
        : "No suspicious indicators matched in available checks (not a guarantee of safety).";

  const mainReasonHi =
    indicators.length > 0
      ? indicators[0].evidenceHi[0] || indicators[0].labelHi
      : input.requiresManualVerification
        ? "कोई धोखाधड़ी रिपोर्ट नहीं मिली, लेकिन पहचान असत्यापित है — स्वयं पुष्टि आवश्यक है।"
        : "उपलब्ध जांच में कोई संदिग्ध संकेत नहीं मिला (यह सुरक्षा की गारंटी नहीं है)।";

  const recommendedActions: string[] = [];
  const recommendedActionsHi: string[] = [];

  if (riskLevel === "HIGH") {
    recommendedActions.push(
      "Stop immediately: do not pay, scan the QR code, tap links, or share any OTP or UPI PIN.",
      "Verify independently by calling your family guardian or official bank helpline (India Cyber Crime: 1930)."
    );
    recommendedActionsHi.push(
      "तुरंत रुकें: कोई भुगतान न करें, QR स्कैन न करें, लिंक न खोलें और OTP या UPI PIN साझा न करें।",
      "सहेजे गए नंबर पर अपने अभिभावक या बैंक हेल्पलाइन (राष्ट्रीय साइबर हेल्पलाइन: 1930) से पुष्टि करें।"
    );
  } else if (riskLevel === "MODERATE") {
    recommendedActions.push(
      "Proceed only after independent confirmation via a saved phone number or official app.",
      "Never approve a payment or enter your UPI PIN to 'receive' a refund or cashback."
    );
    recommendedActionsHi.push(
      "केवल सहेजे गए फ़ोन नंबर या आधिकारिक ऐप से स्वतंत्र पुष्टि करने के बाद ही आगे बढ़ें।",
      "रिफंड या कैशबैक 'पाने' के लिए कभी भुगतान स्वीकृत न करें और न ही UPI PIN डालें।"
    );
  } else {
    recommendedActions.push(
      "A low suspicion score is NOT a guarantee of safety — confirm the recipient before sending money.",
      "Never share OTP, UPI PIN, ATM PIN, or remote-access codes with anyone."
    );
    recommendedActionsHi.push(
      "कम संदेह स्कोर सुरक्षा की गारंटी नहीं है — पैसे भेजने से पहले प्राप्तकर्ता की पुष्टि अवश्य करें।",
      "किसी के साथ OTP, UPI PIN, ATM PIN या स्क्रीन-शेयरिंग कोड साझा न करें।"
    );
  }

  if (sourcesUnavailable.length > 0) {
    recommendedActions.push(
      `Some external live registries (${sourcesUnavailable.join(", ")}) were unavailable; confirm directly inside your official bank or UPI app.`
    );
    recommendedActionsHi.push(
      `कुछ बाहरी लाइव स्रोत (${sourcesUnavailable.join(", ")}) उपलब्ध नहीं थे; अपने आधिकारिक बैंक या UPI ऐप में नाम स्वयं जांचें।`
    );
  }

  const disclaimer =
    "A high score indicates risk, not proof of criminal activity. A score of 0 does not guarantee safety.";
  const disclaimerHi =
    "उच्च स्कोर केवल जोखिम दर्शाता है, अपराध का प्रमाण नहीं। 0 स्कोर होने का अर्थ पूर्ण सुरक्षा की गारंटी नहीं है।";

  return {
    score,
    riskLevel,
    riskLabel,
    formattedScore,
    category: input.category,
    maskedIdentifier: input.maskedIdentifier,
    verificationStatus,
    indicators,
    deduplicatedCount,
    sourcesChecked,
    sourcesUnavailable,
    conflictingSources,
    ...(conflictNote ? { conflictNote, conflictNoteHi } : {}),
    mainReason,
    mainReasonHi,
    recommendedActions,
    recommendedActionsHi,
    disclaimer,
    disclaimerHi,
    evaluatedAt,
  };
}
