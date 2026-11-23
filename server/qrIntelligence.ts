import crypto from "node:crypto";
import { db } from "./db.ts";
import { analyzeUrlIntelligence } from "./linkIntelligence.ts";
import {
  createNotification,
  ensureDefaultConsent,
  ensureDefaultQrNotificationPrefs,
  generateId,
  getActiveGuardiansForParent,
  writeAudit,
} from "./security.ts";
import type { SourceCheckEntry } from "./cyberSafetyCheck.ts";
import {
  evaluateSuspicionScore,
  type RawEvidenceSignal,
  type SuspicionAssessment,
  type UnifiedRiskLevel,
} from "./suspicionScoring.ts";
import { recordRiskHistory } from "./riskHistory.ts";

export interface QrIntelligenceReport {
  id: string;
  qrFormat: "UPI" | "BHARAT_QR" | "WEB_URL" | "TEXT" | "UNKNOWN";
  qrClassification: "payment" | "website" | "plain_text" | "unknown";
  upiId: string | null;
  payeeName: string | null;
  merchantCode: string | null;
  transactionNote: string | null;
  amount: number | null;
  amountState: "preset_fixed" | "editable_open" | "not_applicable";
  securityRiskScore: number;
  securityRiskLevel: UnifiedRiskLevel;
  paymentLoadCategory: "NONE" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  paymentLoadRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  repeatScanCount: number;
  signals: string[];
  guidance: string;
  rawPreview: string;
  createdAt: number;
  sourceChecks: SourceCheckEntry[];
  suspicionAssessment: SuspicionAssessment;
}

function maskQrTarget(qrFormat: string, upiId: string | null, payeeName: string | null): string {
  if (upiId && upiId.includes("@")) {
    const [local, host] = upiId.split("@");
    return `${local.slice(0, 3)}•••@${host}`;
  }
  if (payeeName) return payeeName.slice(0, 60);
  return `${qrFormat} payload`;
}

export async function runFullQrIntelligencePipeline(params: {
  userId: string;
  userName: string;
  rawPayload: string;
  lang?: "en" | "hi";
}): Promise<QrIntelligenceReport> {
  const payload = String(params.rawPayload || "").trim();
  const lang = params.lang === "hi" ? "hi" : "en";
  await ensureDefaultConsent(params.userId);
  const consent = (await db.prepare("SELECT * FROM consents WHERE user_id = ?").get(params.userId)) as Record<
    string,
    number
  >;
  const prefs = await ensureDefaultQrNotificationPrefs(params.userId);

  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");
  const priorScans = (await db
    .prepare("SELECT COUNT(*) as cnt FROM qr_scan_records WHERE user_id = ? AND payload_hash = ?")
    .get(params.userId, payloadHash)) as { cnt: number } | undefined;
  const repeatScanCount = Number(priorScans?.cnt || 0) + 1;

  let qrFormat: QrIntelligenceReport["qrFormat"] = "UNKNOWN";
  let qrClassification: QrIntelligenceReport["qrClassification"] = "unknown";
  let upiId: string | null = null;
  let payeeName: string | null = null;
  let merchantCode: string | null = null;
  let transactionNote: string | null = null;
  let amount: number | null = null;
  let amountState: QrIntelligenceReport["amountState"] = "not_applicable";
  const signals: string[] = [];
  const rawSignals: RawEvidenceSignal[] = [];
  let extraUrlSources: SourceCheckEntry[] = [];
  let familyIntelFlagged = false;
  let familyIntelTrusted = false;

  if (/^upi:\/\/pay/i.test(payload)) {
    qrFormat = "UPI";
    qrClassification = "payment";
    const queryIdx = payload.indexOf("?");
    const search = new URLSearchParams(queryIdx >= 0 ? payload.slice(queryIdx + 1) : "");
    upiId = search.get("pa")?.trim() || null;
    payeeName = search.get("pn")?.trim() || null;
    merchantCode = search.get("mc")?.trim() || null;
    transactionNote = search.get("tn")?.trim() || null;
    const amStr = search.get("am")?.trim();
    if (amStr && Number.isFinite(Number(amStr)) && Number(amStr) > 0) {
      amount = Number(amStr);
      amountState = "preset_fixed";
      signals.push(`Pre-filled fixed payment amount of ₹${amount.toLocaleString("en-IN")}`);
    } else {
      amountState = "editable_open";
    }

    if (!upiId || !upiId.includes("@")) {
      const msg = "Missing or malformed UPI handle (pa parameter)";
      signals.push(msg);
      rawSignals.push({
        code: "SUSPICIOUS_UPI_PAYMENT_PATTERN",
        evidence: msg,
        evidenceHi: "UPI हैंडल (pa पैरामीटर) अनुपस्थित या गलत प्रारूप में है",
        evidenceKey: `qr:malformed-upi:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    } else {
      if (/(kyc|refund|cashback|prize|lottery|claim|helpdesk|support)/i.test(upiId)) {
        const msg = "UPI payment identifier contains scam lure terms (refund/cashback/KYC)";
        signals.push(msg);
        rawSignals.push({
          code: "SUSPICIOUS_UPI_PAYMENT_PATTERN",
          evidence: msg,
          evidenceHi: "UPI ID में रिफंड, कैशबैक या KYC जैसे जोखिम भरे शब्द हैं",
          evidenceKey: `qr:upi-lure:${upiId.toLowerCase()}`,
          verified: true,
          sourceName: "QR Payload & UPI Structural Parser",
        });
      }
      const upiHash = crypto.createHash("sha256").update(upiId.toLowerCase()).digest("hex").slice(0, 24);
      const intel = (await db
        .prepare("SELECT reputation_label, report_count FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ? LIMIT 1")
        .get(params.userId, upiHash)) as { reputation_label: string; report_count: number } | undefined;
      if (intel?.reputation_label === "trusted") familyIntelTrusted = true;
      if (intel?.reputation_label === "malicious" || (intel && intel.report_count > 0)) {
        familyIntelFlagged = true;
        const repCnt = Math.max(1, Number(intel.report_count || 1));
        signals.push(`UPI destination flagged in family threat intelligence (${repCnt} report(s))`);
        rawSignals.push({
          code: "VERIFIED_FRAUD_MATCH",
          evidence: `Confirmed match for UPI handle in family fraud-intelligence cache (${repCnt} report(s))`,
          evidenceHi: `परिवार धोखाधड़ी कैश में इस UPI हैंडल के विरुद्ध पुष्टि किया गया मैच (${repCnt} रिपोर्ट)`,
          evidenceKey: `qr:intel:${upiHash}`,
          verified: true,
          sourceName: "Guardian Family Threat Cache",
        });
        if (repCnt >= 2) {
          rawSignals.push({
            code: "MULTIPLE_INDEPENDENT_REPORTS",
            evidence: `${repCnt} independent fraud reports recorded for this UPI handle`,
            evidenceHi: `इस UPI हैंडल पर ${repCnt} स्वतंत्र धोखाधड़ी रिपोर्ट दर्ज हैं`,
            evidenceKey: `qr:intel-multi:${upiHash}`,
            verified: true,
            sourceName: "Guardian Family Threat Cache",
            reportKeys: Array.from({ length: repCnt }, (_, idx) => `${upiHash}:r:${idx}`),
          });
        }
      }
    }

    if (!payeeName) {
      const msg = "Payee name is missing from QR payload";
      signals.push(msg);
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: msg,
        evidenceHi: "QR पेलोड में प्राप्तकर्ता का नाम गायब है",
        evidenceKey: `qr:missing-payee:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    }

    if (transactionNote && /(refund|cashback|lottery|prize|kyc|claim|receive)/i.test(transactionNote)) {
      const msg = "Suspicious 'refund/reward' note — scanning a QR always PAYS money, never receives it";
      signals.push(msg);
      rawSignals.push({
        code: "MALICIOUS_QR_DESTINATION",
        evidence: msg,
        evidenceHi: "संदिग्ध 'रिफंड/पुरस्कार' नोट — QR स्कैन करने से पैसे कटते हैं, कभी मिलते नहीं",
        evidenceKey: `qr:refund-lure:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
      rawSignals.push({
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: "Deceptive QR transaction note claims refund, prize, or KYC release",
        evidenceHi: "भ्रामक QR नोट रिफंड, इनाम या KYC का दावा करता है",
        evidenceKey: `qr:deceptive-note:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    }

    if (payeeName && upiId) {
      const handleUser = upiId.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanName = payeeName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        cleanName.length >= 4 &&
        handleUser.length >= 4 &&
        !handleUser.includes(cleanName.slice(0, 4)) &&
        !cleanName.includes(handleUser.slice(0, 4)) &&
        !merchantCode
      ) {
        const msg = "Personal UPI handle does not visibly match displayed payee name";
        signals.push(msg);
        rawSignals.push({
          code: "UNVERIFIED_IDENTITY_MISMATCH",
          evidence: msg,
          evidenceHi: "व्यक्तिगत UPI हैंडल प्रदर्शित प्राप्तकर्ता नाम से मेल नहीं खाता",
          evidenceKey: `qr:name-mismatch:${payloadHash}`,
          verified: true,
          sourceName: "QR Payload & UPI Structural Parser",
        });
      }
    }
  } else if (/^000201/i.test(payload)) {
    qrFormat = "BHARAT_QR";
    qrClassification = "payment";
    signals.push("EMVCo / BharatQR merchant payment structure detected");
  } else if (/^https?:\/\//i.test(payload)) {
    qrFormat = "WEB_URL";
    qrClassification = "website";
    const urlRes = await analyzeUrlIntelligence(payload, { userId: params.userId });
    signals.push(...urlRes.signals);
    if (urlRes.rawSignals?.length) {
      rawSignals.push(...urlRes.rawSignals);
    }
    if (urlRes.riskScore >= 30 || urlRes.looksLikeImpersonation || urlRes.isIpLiteral) {
      rawSignals.push({
        code: "MALICIOUS_QR_DESTINATION",
        evidence: `QR points to suspicious or phishing web destination (${urlRes.domain})`,
        evidenceHi: `QR कोड एक संदिग्ध या फ़िशिंग वेबसाइट (${urlRes.domain}) की ओर ले जाता है`,
        evidenceKey: `qr:web-dest:${urlRes.domain}`,
        verified: true,
        sourceName: "Static URL & Domain Inspector",
      });
    }
    extraUrlSources = urlRes.sourceChecks;
    payeeName = urlRes.domain;
  } else {
    qrFormat = "TEXT";
    qrClassification = "plain_text";
    if (/(otp|pin|password|kyc|urgent|http)/i.test(payload)) {
      const msg = "Plain-text QR contains sensitive or urgent phrasing";
      signals.push(msg);
      rawSignals.push({
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: msg,
        evidenceHi: "सादे टेक्स्ट QR में संवेदनशील या दबाव बनाने वाले शब्द हैं",
        evidenceKey: `qr:text-lure:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    }
  }

  if (repeatScanCount >= 3) {
    const msg = `Same QR code scanned ${repeatScanCount} times`;
    signals.push(msg);
    rawSignals.push({
      code: "REPEATED_COMMUNITY_REPORTS",
      evidence: msg,
      evidenceHi: `एक ही QR कोड ${repeatScanCount} बार स्कैन किया गया`,
      evidenceKey: `qr:repeat:${payloadHash}`,
      verified: false,
      sourceName: "QR Payload & UPI Structural Parser",
    });
  }

  const modMax = Number(consent?.load_moderate_max ?? 2000);
  const highMax = Number(consent?.load_high_max ?? 10000);
  const veryHighMin = Number(consent?.load_very_high_min ?? 25000);

  let paymentLoadCategory: QrIntelligenceReport["paymentLoadCategory"] = "NONE";
  let paymentLoadRiskLevel: QrIntelligenceReport["paymentLoadRiskLevel"] = "LOW";

  if (amount !== null) {
    if (amount >= veryHighMin) {
      paymentLoadCategory = "VERY_HIGH";
      paymentLoadRiskLevel = "CRITICAL";
      const msg = `Very high preset financial load (≥ ₹${veryHighMin.toLocaleString("en-IN")})`;
      signals.push(msg);
      rawSignals.push({
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: msg,
        evidenceHi: `बहुत अधिक पूर्व-निर्धारित राशि (≥ ₹${veryHighMin.toLocaleString("en-IN")})`,
        evidenceKey: `qr:high-preset:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    } else if (amount > highMax) {
      paymentLoadCategory = "HIGH";
      paymentLoadRiskLevel = "HIGH";
      const msg = `High preset financial load (> ₹${highMax.toLocaleString("en-IN")})`;
      signals.push(msg);
      rawSignals.push({
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: msg,
        evidenceHi: `उच्च पूर्व-निर्धारित राशि (> ₹${highMax.toLocaleString("en-IN")})`,
        evidenceKey: `qr:high-preset:${payloadHash}`,
        verified: true,
        sourceName: "QR Payload & UPI Structural Parser",
      });
    } else if (amount > modMax) {
      paymentLoadCategory = "MODERATE";
      paymentLoadRiskLevel = "MEDIUM";
    } else {
      paymentLoadCategory = "LOW";
      paymentLoadRiskLevel = "LOW";
    }
  }

  const id = generateId("qr");
  const now = Date.now();
  const checkedInfo = maskQrTarget(qrFormat, upiId, payeeName);

  const sourceChecks: SourceCheckEntry[] = [
    {
      sourceName: "QR Payload & UPI Structural Parser",
      sourceNameHi: "QR पेलोड व UPI संरचना विश्लेषक",
      informationChecked: checkedInfo,
      verificationStatus:
        rawSignals.some((r) => r.code === "MALICIOUS_QR_DESTINATION" || r.code === "VERIFIED_FRAUD_MATCH")
          ? "HIGH RISK"
          : rawSignals.length > 0
            ? "CAUTION"
            : qrFormat === "UPI"
              ? "MANUAL VERIFICATION REQUIRED"
              : "NO KNOWN THREAT DETECTED",
      result:
        signals.length > 0
          ? signals.join("; ")
          : `Parsed ${qrFormat} structure with no immediate local risk patterns.`,
      resultHi:
        signals.length > 0
          ? signals.join("; ")
          : `${qrFormat} संरचना में कोई तात्कालिक जोखिम पैटर्न नहीं मिला।`,
      lastCheckedAt: now,
      limitations: "Does not auto-open links or verify real bank account ownership.",
      limitationsHi: "लिंक को खोले बिना जांच की गई; बैंक खाताधारक का नाम यहाँ सत्यापित नहीं होता।",
    },
    ...(extraUrlSources.length > 0
      ? extraUrlSources
      : [
          {
            sourceName: "NPCI / Bank Beneficiary Registry",
            sourceNameHi: "NPCI / बैंक लाभार्थी नाम रजिस्ट्री",
            informationChecked: checkedInfo,
            verificationStatus: (qrFormat === "UPI" || qrFormat === "BHARAT_QR"
              ? "MANUAL VERIFICATION REQUIRED"
              : "SOURCE UNAVAILABLE") as SourceCheckEntry["verificationStatus"],
            result:
              qrFormat === "UPI" || qrFormat === "BHARAT_QR"
                ? "Recipient identity is NOT verified here. Confirm the bank-verified payee name in your UPI app."
                : "Not applicable for non-payment QR codes.",
            resultHi:
              qrFormat === "UPI" || qrFormat === "BHARAT_QR"
                ? "प्राप्तकर्ता की पहचान यहाँ सत्यापित नहीं है। अपने UPI ऐप में बैंक-सत्यापित नाम अवश्य देखें।"
                : "गैर-भुगतान QR कोड के लिए लागू नहीं।",
            lastCheckedAt: now,
            limitations: "External PSP beneficiary lookup is not connected; never scan a QR to receive money.",
            limitationsHi: "बाहरी बैंक नाम जांच उपलब्ध नहीं है; पैसे प्राप्त करने के लिए कभी QR स्कैन न करें।",
          },
        ]),
  ];

  const suspicionAssessment = evaluateSuspicionScore({
    category: "QR Intelligence",
    maskedIdentifier: checkedInfo,
    rawSignals,
    sourceChecks,
    markedTrustedLocally: familyIntelTrusted,
    requiresManualVerification: qrFormat === "UPI" || qrFormat === "BHARAT_QR" || !familyIntelFlagged,
    lang,
    evaluatedAt: now,
  });

  const finalScore = suspicionAssessment.score;
  const securityRiskLevel: UnifiedRiskLevel = suspicionAssessment.riskLevel;

  let guidance =
    lang === "hi"
      ? "प्राप्तकर्ता का नाम और राशि जांचने के बाद ही भुगतान ऐप में आगे बढ़ें।"
      : "Verify the payee name and amount before confirming inside your payment app.";
  if (securityRiskLevel === "HIGH") {
    guidance =
      lang === "hi"
        ? "रुकें! यह QR कोड उच्च जोखिम वाला है। पैसे प्राप्त करने के लिए कभी भी QR स्कैन न करें।"
        : "Stop! High-risk QR detected. Remember: scanning a QR code sends money—it never receives refunds or prizes.";
  } else if (securityRiskLevel === "MODERATE") {
    guidance =
      lang === "hi"
        ? "सावधानी आवश्यक: भुगतान या लिंक खोलने से पहले प्राप्तकर्ता की स्वतंत्र पुष्टि करें।"
        : "Moderate risk detected. Confirm the payee independently before confirming any payment or link.";
  }

  const report: QrIntelligenceReport = {
    id,
    qrFormat,
    qrClassification,
    upiId,
    payeeName,
    merchantCode,
    transactionNote,
    amount,
    amountState,
    securityRiskScore: finalScore,
    securityRiskLevel,
    paymentLoadCategory,
    paymentLoadRiskLevel,
    repeatScanCount,
    signals,
    guidance,
    rawPreview: payload.slice(0, 120),
    createdAt: now,
    sourceChecks,
    suspicionAssessment,
  };

  await db
    .prepare(
      `INSERT INTO qr_scan_records (id, user_id, payload_hash, qr_format, qr_classification, upi_id, payee_name, amount, amount_state, security_risk_level, payment_load_category, payment_load_risk_level, report_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      payloadHash,
      qrFormat,
      qrClassification,
      upiId,
      payeeName,
      amount,
      amountState,
      securityRiskLevel,
      paymentLoadCategory,
      paymentLoadRiskLevel,
      JSON.stringify(report),
      now
    );

  await recordRiskHistory({
    userId: params.userId,
    identifierType: qrFormat.toLowerCase(),
    assessment: suspicionAssessment,
  });

  await writeAudit(params.userId, `QR Intelligence analyzed (${qrFormat}, ${finalScore}/100 ${securityRiskLevel})`);

  const shouldNotify =
    consent?.guardian_alerts &&
    !consent?.paused &&
    ((securityRiskLevel === "HIGH" && (prefs.highRiskQrAlert || prefs.criticalRiskQrAlert)) ||
      (paymentLoadCategory === "VERY_HIGH" && prefs.veryHighLoadAlert) ||
      (repeatScanCount >= 3 && prefs.repeatedQrAlert));

  if (shouldNotify) {
    const guardians = await getActiveGuardiansForParent(params.userId);
    for (const g of guardians) {
      await createNotification(
        g.guardian_id,
        params.userId,
        "qr_risk_alert",
        `QR Alert (${securityRiskLevel} · ${finalScore}/100)`,
        `${params.userName} scanned a ${qrFormat} QR (${payeeName || checkedInfo})${amount ? ` for ₹${amount.toLocaleString("en-IN")}` : ""}.`
      );
    }
  }

  return report;
}
