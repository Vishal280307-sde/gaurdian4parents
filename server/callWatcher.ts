import crypto from "node:crypto";
import { db } from "./db.ts";
import { redactSensitive } from "./ai.ts";
import { upsertGcihEntity } from "./gcih.ts";
import { ingestGsiEvent } from "./gsi.ts";
import { analyzeScamText } from "./scamEngine.ts";
import {
  createNotification,
  generateId,
  getActiveGuardiansForParent,
  writeAudit,
} from "./security.ts";
import type { SourceCheckEntry } from "./cyberSafetyCheck.ts";
import {
  evaluateSuspicionScore,
  type RawEvidenceSignal,
  type SuspicionAssessment,
} from "./suspicionScoring.ts";
import { recordRiskHistory } from "./riskHistory.ts";

export type ProtectionStatus =
  | "Protection active"
  | "Protection partially active"
  | "Permission required"
  | "Background execution restricted"
  | "Offline intelligence"
  | "Protection unavailable";

export type CallRiskClassification =
  | "HIGH RISK"
  | "CAUTION"
  | "NO KNOWN THREAT DETECTED"
  | "UNKNOWN NUMBER";

export const PRIVACY_GUARANTEES = {
  microphoneActivated: false,
  audioRecorded: false,
  audioTranscribed: false,
  metadataOnly: true,
} as const;

function normalizePhone(identifier: string): string {
  const trimmed = String(identifier || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.length === 10 ? `91${digits}` : digits;
  }
  return trimmed.toLowerCase();
}

function hashCaller(identifier: string): string {
  return crypto.createHash("sha256").update(normalizePhone(identifier)).digest("hex").slice(0, 24);
}

function maskCaller(identifier: string): string {
  const clean = identifier.trim();
  if (!clean || /^(unknown|private|withheld|anonymous)$/i.test(clean)) return "Unknown / Withheld";
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
  }
  return clean.slice(0, 2) + "•••" + clean.slice(-2);
}

function deriveCallRiskClassification(verdict: string, callerClassification: string, hasSignals: boolean): CallRiskClassification {
  if (verdict === "allow_with_warning") return "HIGH RISK";
  if (verdict === "allow_caution") {
    return hasSignals ? "CAUTION" : callerClassification === "Known Contact" ? "CAUTION" : "UNKNOWN NUMBER";
  }
  return "NO KNOWN THREAT DETECTED";
}

async function ensureCallWatcherSettings(userId: string) {
  let row = (await db.prepare("SELECT * FROM call_watcher_settings WHERE user_id = ?").get(userId)) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO call_watcher_settings (user_id, consent_status, notify_unknown_calls, permission_call_state, permission_sms_state, permission_notif_state, permission_call_log_state, call_screening_role_state, battery_restricted, app_lifecycle_state, boot_restore_pending, updated_at)
         VALUES (?, 'active', 1, 'browser_mode', 'browser_mode', 'granted', 'not_applicable', 'browser_mode', 0, 'active', 0, ?)`
      )
      .run(userId, now);
    row = (await db.prepare("SELECT * FROM call_watcher_settings WHERE user_id = ?").get(userId)) as Record<
      string,
      unknown
    >;
  }
  return row;
}

function deriveProtectionStatus(row: Record<string, unknown>): ProtectionStatus {
  const consent = String(row.consent_status || "pending");
  if (consent === "revoked" || consent === "paused") return "Protection unavailable";
  if (Number(row.battery_restricted)) return "Background execution restricted";
  const callState = String(row.permission_call_state || "browser_mode");
  if (callState === "denied") return "Permission required";
  if (callState === "browser_mode") return "Protection partially active";
  return "Protection active";
}

export async function updateCallWatcherConsent(
  userId: string,
  action: "activate" | "pause" | "resume" | "revoke" | "update_prefs",
  opts?: {
    notifyUnknownCalls?: boolean;
    permissionCallState?: string;
    permissionSmsState?: string;
    permissionNotifState?: string;
    permissionCallLogState?: string;
    callScreeningRoleState?: string;
    batteryRestricted?: boolean;
    appLifecycleState?: string;
    bootRestorePending?: boolean;
  }
) {
  const current = await ensureCallWatcherSettings(userId);
  let nextConsent = String(current.consent_status || "active");
  if (action === "activate" || action === "resume") nextConsent = "active";
  else if (action === "pause") nextConsent = "paused";
  else if (action === "revoke") nextConsent = "revoked";

  await db
    .prepare(
      `UPDATE call_watcher_settings SET
         consent_status = ?,
         notify_unknown_calls = ?,
         permission_call_state = ?,
         permission_sms_state = ?,
         permission_notif_state = ?,
         permission_call_log_state = ?,
         call_screening_role_state = ?,
         battery_restricted = ?,
         app_lifecycle_state = ?,
         boot_restore_pending = ?,
         updated_at = ?
       WHERE user_id = ?`
    )
    .run(
      nextConsent,
      opts?.notifyUnknownCalls !== undefined ? (opts.notifyUnknownCalls ? 1 : 0) : Number(current.notify_unknown_calls),
      opts?.permissionCallState ? String(opts.permissionCallState).slice(0, 30) : String(current.permission_call_state),
      opts?.permissionSmsState ? String(opts.permissionSmsState).slice(0, 30) : String(current.permission_sms_state),
      opts?.permissionNotifState ? String(opts.permissionNotifState).slice(0, 30) : String(current.permission_notif_state),
      opts?.permissionCallLogState ? String(opts.permissionCallLogState).slice(0, 30) : String(current.permission_call_log_state),
      opts?.callScreeningRoleState ? String(opts.callScreeningRoleState).slice(0, 30) : String(current.call_screening_role_state),
      opts?.batteryRestricted !== undefined ? (opts.batteryRestricted ? 1 : 0) : Number(current.battery_restricted),
      opts?.appLifecycleState ? String(opts.appLifecycleState).slice(0, 30) : String(current.app_lifecycle_state),
      opts?.bootRestorePending !== undefined ? (opts.bootRestorePending ? 1 : 0) : Number(current.boot_restore_pending),
      Date.now(),
      userId
    );
  await writeAudit(userId, `Call Watcher consent updated (${nextConsent}, metadata-only)`);
  const updated = await ensureCallWatcherSettings(userId);
  return { ...updated, protectionStatus: deriveProtectionStatus(updated) };
}

export async function updateCallWatcherDeviceStatus(
  userId: string,
  status: {
    appLifecycleState?: string;
    batteryRestricted?: boolean;
    callScreeningRoleState?: string;
    permissionCallLogState?: string;
    permissionCallState?: string;
    permissionNotifState?: string;
    bootRestorePending?: boolean;
  }
) {
  return updateCallWatcherConsent(userId, "update_prefs", status);
}

export async function screenIncomingCaller(
  userId: string,
  params: {
    callerIdentifier?: string;
    callerClassification?: string;
    callScreeningRoleGranted?: boolean;
  }
) {
  const started = Date.now();
  const identifier = String(params.callerIdentifier || "").trim();
  const isWithheld = !identifier || /^(unknown|private|withheld|anonymous)$/i.test(identifier);
  const callerHash = isWithheld ? null : hashCaller(identifier);
  const masked = isWithheld ? "Unknown / Withheld" : maskCaller(identifier);
  const digits = identifier.replace(/\D/g, "");

  let verdict: "allow_normal" | "allow_caution" | "allow_with_warning" = "allow_normal";
  let riskClassification: CallRiskClassification = "NO KNOWN THREAT DETECTED";
  let reason = "No prior fraud reports matched in available family intelligence. Absence of reports does not guarantee the caller is genuine.";
  let reasonHi = "उपलब्ध परिवार सुरक्षा डेटाबेस में कोई पूर्व धोखाधड़ी रिपोर्ट नहीं मिली। रिपोर्ट न होना कॉलर के असली होने की गारंटी नहीं है।";
  let patternFinding: string | null = null;
  let patternFindingHi: string | null = null;

  // 1. Check Family / Local Threat Intelligence Cache
  let intel: { reputation_label: string; report_count: number } | undefined;
  if (callerHash) {
    intel = (await db
      .prepare("SELECT reputation_label, report_count FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ? LIMIT 1")
      .get(userId, callerHash)) as { reputation_label: string; report_count: number } | undefined;
  }

  // 2. Check Calling Metadata & Recent Burst Patterns (no audio/content)
  if (!isWithheld && callerHash) {
    const recentRepeats = (await db
      .prepare("SELECT COUNT(*) as c FROM call_watcher_calls WHERE user_id = ? AND caller_hash = ? AND incoming_at >= ?")
      .get(userId, callerHash, Date.now() - 30 * 60_000)) as { c: number } | undefined;
    if ((recentRepeats?.c || 0) >= 3 && intel?.reputation_label !== "trusted") {
      patternFinding = "Repeated calls from this number within 30 minutes (high-pressure call pattern).";
      patternFindingHi = "पिछले 30 मिनट में इस नंबर से बार-बार कॉल आई है (दबाव बनाने वाला पैटर्न)।";
    }
  }

  if (!patternFinding && digits.length >= 6) {
    if (/^(140|160)/.test(digits)) {
      patternFinding = "Registered telemarketing/service header prefix (140/160). Never share OTPs or remote-access codes.";
      patternFindingHi = "टेलीमार्केटिंग/सेवा प्रीफ़िक्स (140/160) नंबर। कॉल पर OTP या रिमोट-एक्सेस कोड कभी न बताएं।";
    } else if (/^\+(92|88|234|447|1800)/.test(identifier) && params.callerClassification !== "Known Contact") {
      patternFinding = "Unfamiliar international or toll-free style prefix from an unsaved caller.";
      patternFindingHi = "अज्ञात सहेजे न गए कॉलर से अंतरराष्ट्रीय या टोल-फ़्री जैसा प्रीफ़िक्स।";
    }
  }

  // 3. Assign Risk Classification per Section D
  if (intel?.reputation_label === "malicious" || (intel && intel.report_count >= 1)) {
    verdict = "allow_with_warning";
    riskClassification = "HIGH RISK";
    const repCount = intel.report_count || 1;
    reason = `Warning: This number has ${repCount} fraud/scam report(s) in your family threat intelligence. Never share OTPs, UPI PIN, or banking details.`;
    reasonHi = `चेतावनी: इस नंबर के विरुद्ध आपके परिवार सुरक्षा डेटाबेस में ${repCount} धोखाधड़ी रिपोर्ट दर्ज हैं। कभी OTP, UPI PIN या बैंक विवरण साझा न करें।`;
  } else if (intel?.reputation_label === "trusted") {
    verdict = "allow_normal";
    riskClassification = "NO KNOWN THREAT DETECTED";
    reason = "Marked as trusted by family, with no negative reports found. Still never share OTP or PIN over any call.";
    reasonHi = "परिवार द्वारा विश्वसनीय के रूप में सहेजा गया है और कोई नकारात्मक रिपोर्ट नहीं मिली। फिर भी कॉल पर OTP या PIN कभी साझा न करें।";
  } else if (patternFinding) {
    verdict = "allow_caution";
    riskClassification = "CAUTION";
    reason = patternFinding;
    reasonHi = patternFindingHi || patternFinding;
  } else if (isWithheld || params.callerClassification === "Unknown Number") {
    verdict = "allow_caution";
    riskClassification = "UNKNOWN NUMBER";
    reason = "Insufficient caller reputation history (unknown or unsaved number). Verify identity independently before sharing details.";
    reasonHi = "कॉलर की जानकारी अपर्याप्त है (अज्ञात या सहेजा न गया नंबर)। कोई भी जानकारी देने से पहले स्वतंत्र रूप से पुष्टि करें।";
  } else {
    verdict = "allow_normal";
    riskClassification = "NO KNOWN THREAT DETECTED";
  }

  const checkedAt = Date.now();
  const rawSignals: RawEvidenceSignal[] = [];

  if (intel?.reputation_label === "malicious" || (intel && intel.report_count >= 1)) {
    const repCount = Math.max(1, intel.report_count || 1);
    rawSignals.push({
      code: "VERIFIED_FRAUD_MATCH",
      evidence: `Confirmed match in family fraud intelligence (${repCount} report(s))`,
      evidenceHi: `परिवार धोखाधड़ी इंटेलिजेंस में पुष्टि किया गया मैच (${repCount} रिपोर्ट)`,
      evidenceKey: `call:intel:${callerHash}`,
      verified: true,
      sourceName: "Guardian Family Threat Cache",
    });
    if (repCount >= 2) {
      rawSignals.push({
        code: "MULTIPLE_INDEPENDENT_REPORTS",
        evidence: `Multiple independent fraud reports (${repCount} reports)`,
        evidenceHi: `कई स्वतंत्र धोखाधड़ी रिपोर्ट (${repCount} रिपोर्ट)`,
        evidenceKey: `call:intel-multi:${callerHash}`,
        verified: true,
        sourceName: "Guardian Family Threat Cache",
        reportKeys: Array.from({ length: repCount }, (_, i) => `${callerHash}:r:${i}`),
      });
    }
    if (params.callerClassification !== "Known Contact") {
      rawSignals.push({
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: "Flagged caller is not in your saved known contacts",
        evidenceHi: "चिह्नित कॉलर आपके सहेजे गए संपर्कों में नहीं है",
        evidenceKey: `call:unverified-flagged:${callerHash}`,
        verified: true,
        sourceName: "Call Metadata & Calling Pattern Analyzer",
      });
    }
  }

  if (patternFinding) {
    const isRepeatPattern = patternFinding.includes("Repeated calls");
    rawSignals.push({
      code: isRepeatPattern ? "REPEATED_COMMUNITY_REPORTS" : "UNVERIFIED_IDENTITY_MISMATCH",
      evidence: patternFinding,
      evidenceHi: patternFindingHi || patternFinding,
      evidenceKey: `call:pattern:${callerHash || masked}`,
      verified: !isRepeatPattern,
      sourceName: "Call Metadata & Calling Pattern Analyzer",
    });
  }

  const sourceChecks: SourceCheckEntry[] = [
    {
      sourceName: "Guardian Family Threat Cache",
      sourceNameHi: "गार्जियन परिवार थ्रेट कैश",
      informationChecked: masked,
      verificationStatus:
        riskClassification === "HIGH RISK"
          ? "HIGH RISK"
          : riskClassification === "CAUTION"
            ? "CAUTION"
            : riskClassification === "UNKNOWN NUMBER"
              ? "MANUAL VERIFICATION REQUIRED"
              : "NO KNOWN THREAT DETECTED",
      result: reason,
      resultHi: reasonHi,
      lastCheckedAt: checkedAt,
      limitations: "Local family intelligence only; absence of a match does not guarantee the caller is genuine.",
      limitationsHi: "केवल स्थानीय परिवार डेटाबेस पर आधारित; मैच न मिलने का अर्थ कॉलर के असली होने की गारंटी नहीं है।",
    },
    {
      sourceName: "Call Metadata & Calling Pattern Analyzer",
      sourceNameHi: "कॉल मेटाडेटा व पैटर्न विश्लेषक",
      informationChecked: `${masked} (${params.callerClassification || "Unknown Number"})`,
      verificationStatus: patternFinding ? "CAUTION" : "NO KNOWN THREAT DETECTED",
      result: patternFinding || "No burst-calling or telemarketing/VoIP pattern anomalies detected in call metadata.",
      resultHi: patternFindingHi || "कॉल मेटाडेटा में कोई बार-बार कॉल या टेलीमार्केटिंग पैटर्न विसंगति नहीं मिली।",
      lastCheckedAt: checkedAt,
      limitations: "Metadata only — microphone is never activated and call audio is never recorded or transcribed.",
      limitationsHi: "केवल मेटाडेटा जांच — माइक्रोफ़ोन कभी चालू नहीं होता और कॉल ऑडियो रिकॉर्ड या ट्रांसक्राइब नहीं किया जाता।",
    },
    {
      sourceName: "External Telecom / Chakshu Live Registry",
      sourceNameHi: "बाहरी टेलीकॉम / चक्षु लाइव रजिस्ट्री",
      informationChecked: masked,
      verificationStatus: "SOURCE UNAVAILABLE",
      result: "Live external carrier/Chakshu lookup is not connected in browser preview mode.",
      resultHi: "ब्राउज़र प्रीव्यू मोड में लाइव बाहरी टेलीकॉम/चक्षु डेटाबेस कनेक्ट नहीं है।",
      lastCheckedAt: checkedAt,
      limitations: "Caller ID can be spoofed; hang up and dial saved official bank numbers.",
      limitationsHi: "कॉलर ID नकली हो सकती है; हमेशा सहेजे गए आधिकारिक नंबर पर ही वापस कॉल करें।",
    },
  ];

  const suspicionAssessment: SuspicionAssessment = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: masked,
    rawSignals,
    sourceChecks,
    markedTrustedLocally: intel?.reputation_label === "trusted",
    requiresManualVerification: isWithheld || params.callerClassification !== "Known Contact",
    evaluatedAt: checkedAt,
  });

  return {
    verdict,
    riskClassification,
    riskScore: suspicionAssessment.score,
    callerMasked: masked,
    callerHash,
    reason,
    reasonHi,
    neverAutoBlocks: true,
    privacyGuarantees: PRIVACY_GUARANTEES,
    callScreeningRoleGranted: Boolean(params.callScreeningRoleGranted),
    latencyMs: Math.max(1, Date.now() - started),
    sourceChecks,
    suspicionAssessment,
  };
}

export async function getLocalCallThreatCache(userId: string) {
  const rows = (await db
    .prepare(
      "SELECT id, indicator_hash, indicator_display, reputation_label, confidence, report_count, updated_at FROM gsi_threat_intel WHERE user_id = ? AND indicator_type = 'phone' ORDER BY updated_at DESC LIMIT 100"
    )
    .all(userId)) as Record<string, unknown>[];
  return {
    hashedOnly: true,
    count: rows.length,
    entries: rows,
    syncedAt: Date.now(),
  };
}

export async function recordCallWatcherCall(
  userId: string,
  userName: string,
  input: {
    externalEventId?: string;
    callerIdentifier?: string;
    callerClassification?: string;
    callStatus?: string;
    callLifecyclePhase?: string;
    incomingAt?: number;
    startedAt?: number | null;
    endedAt?: number | null;
    durationMs?: number | null;
    screeningVerdict?: string;
    screeningLatencyMs?: number | null;
    simInfo?: string;
    source?: string;
  },
  lang: "en" | "hi" = "en"
) {
  await ensureCallWatcherSettings(userId);
  if (input.externalEventId) {
    const existing = (await db
      .prepare("SELECT * FROM call_watcher_calls WHERE user_id = ? AND external_event_id = ?")
      .get(userId, input.externalEventId)) as Record<string, unknown> | undefined;
    if (existing) {
      return { duplicate: true, call: existing };
    }
  }

  const incomingAt = Number(input.incomingAt || Date.now());
  const startedAt = input.startedAt ?? incomingAt;
  const endedAt = input.endedAt ?? null;
  const durationMs =
    input.durationMs !== undefined && input.durationMs !== null
      ? Math.max(0, Number(input.durationMs))
      : endedAt !== null && startedAt !== null && endedAt >= startedAt
        ? endedAt - startedAt
        : null;

  const rawId = String(input.callerIdentifier || "").trim();
  const callerHash = rawId ? hashCaller(rawId) : null;
  const callerMasked = rawId ? maskCaller(rawId) : String(input.callerClassification || "Unknown Number");
  const classification = String(input.callerClassification || (rawId ? "Unknown Number" : "Unknown Number")).slice(0, 40);
  const callStatus = String(input.callStatus || (endedAt ? "Ended" : "Active")).slice(0, 30);
  const phase = String(input.callLifecyclePhase || (endedAt ? "ended" : "active")).slice(0, 30);
  const id = generateId("cwc");

  await db
    .prepare(
      `INSERT INTO call_watcher_calls (id, user_id, external_event_id, caller_hash, caller_masked, caller_classification, call_status, call_lifecycle_phase, incoming_at, started_at, ended_at, duration_ms, screening_verdict, screening_latency_ms, sim_info, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      input.externalEventId || null,
      callerHash,
      callerMasked,
      classification,
      callStatus,
      phase,
      incomingAt,
      startedAt,
      endedAt,
      durationMs,
      String(input.screeningVerdict || "allow_normal"),
      input.screeningLatencyMs ?? null,
      input.simInfo ? String(input.simInfo).slice(0, 40) : null,
      String(input.source || "manual").slice(0, 30),
      Date.now()
    );

  if (rawId) {
    await upsertGcihEntity({
      familyOwnerId: userId,
      entityType: "phone",
      rawValue: rawId,
      sourceModule: "module_a_call_watcher",
      riskClassification: input.screeningVerdict === "allow_with_warning" ? "Suspicious" : "Neutral",
    });
  }

  await writeAudit(userId, `Call Watcher recorded ${classification} call (metadata only, no audio)`);

  // Non-blocking GSI check (isolated long calls remain LOW severity!)
  await ingestGsiEvent({
    familyOwnerId: userId,
    familyOwnerName: userName,
    eventType: "call_event",
    eventTimestamp: incomingAt,
    sourceModule: "module_a_call_watcher",
    lang,
    skipAi: true,
    callData: {
      callerClassification: classification,
      callStatus,
      durationMs,
      known: classification === "Known Contact",
      callerMasked,
    },
  });

  const call = (await db.prepare("SELECT * FROM call_watcher_calls WHERE id = ?").get(id)) as Record<string, unknown>;
  return { duplicate: false, call };
}

export async function endActiveCallEvent(
  userId: string,
  userName: string,
  callId: string,
  params: {
    endedAt?: number | null;
    startedAt?: number;
    callStatus?: string;
    durationMs?: number;
    lang?: "en" | "hi";
  }
) {
  const row = (await db.prepare("SELECT * FROM call_watcher_calls WHERE id = ? AND user_id = ?").get(callId, userId)) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new Error("Call event not found.");

  const startedAt = params.startedAt ?? (row.started_at !== null ? Number(row.started_at) : Number(row.incoming_at));
  const endedAt = params.endedAt === null ? null : Number(params.endedAt ?? Date.now());
  const durationMs =
    params.durationMs !== undefined
      ? Math.max(0, Number(params.durationMs))
      : endedAt !== null && Number.isFinite(startedAt) && endedAt >= startedAt
        ? endedAt - startedAt
        : null;

  await db
    .prepare(
      "UPDATE call_watcher_calls SET ended_at = ?, duration_ms = ?, call_status = ?, call_lifecycle_phase = 'ended' WHERE id = ?"
    )
    .run(endedAt, durationMs, params.callStatus || "Ended", callId);

  await writeAudit(userId, `Call Watcher call closed (duration ${durationMs !== null ? `${Math.round(durationMs / 1000)}s` : "unknown"})`);
  const call = (await db.prepare("SELECT * FROM call_watcher_calls WHERE id = ?").get(callId)) as Record<string, unknown>;

  // Note: Long isolated call safeguard (e.g., 18+ min) does NOT raise a red alert by itself
  if (durationMs !== null && durationMs >= 1_080_000) {
    await ingestGsiEvent({
      familyOwnerId: userId,
      familyOwnerName: userName,
      eventType: "call_event",
      sourceModule: "module_a_call_watcher",
      lang: params.lang || "en",
      skipAi: true,
      callData: {
        callerClassification: String(row.caller_classification),
        callStatus: "Ended",
        durationMs,
        known: String(row.caller_classification) === "Known Contact",
      },
    });
  }

  return { ok: true, call };
}

export async function recordPaymentMessageEvent(
  userId: string,
  userName: string,
  input: {
    rawMessageText: string;
    senderLabel?: string;
    messageTs?: number;
    source?: string;
    linkedCallId?: string;
  },
  lang: "en" | "hi" = "en"
) {
  const raw = String(input.rawMessageText || "").trim();
  if (!raw) throw new Error("Payment message text is required.");

  const messageTs = Number(input.messageTs || Date.now());
  const dedupHash = crypto.createHash("sha256").update(`${userId}:${raw.slice(0, 200)}`).digest("hex").slice(0, 24);
  const dup = (await db
    .prepare("SELECT * FROM payment_message_events WHERE user_id = ? AND dedup_hash = ? AND created_at > ?")
    .get(userId, dedupHash, Date.now() - 120_000)) as Record<string, unknown> | undefined;
  if (dup) {
    return { duplicate: true, event: dup };
  }

  const amtMatch = raw.match(/(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) : null;
  const scamRes = analyzeScamText(raw);
  const redactedSummary = redactSensitive(raw).slice(0, 220);
  const id = generateId("pme");

  await db
    .prepare(
      `INSERT INTO payment_message_events (id, user_id, dedup_hash, sender_label, message_ts, amount, currency, tx_type, account_masked, merchant_or_recipient, payment_status, redacted_summary, risk_score, risk_level, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'INR', 'debit_intent', NULL, NULL, 'detected', ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      dedupHash,
      String(input.senderLabel || "SMS / Alert").slice(0, 40),
      messageTs,
      amount,
      redactedSummary,
      scamRes.score,
      scamRes.level,
      String(input.source || "manual").slice(0, 30),
      Date.now()
    );

  // Correlate with any recent call within +/- 20 minutes
  const recentCall = input.linkedCallId
    ? ((await db.prepare("SELECT * FROM call_watcher_calls WHERE id = ? AND user_id = ?").get(input.linkedCallId, userId)) as
        | Record<string, unknown>
        | undefined)
    : ((await db
        .prepare("SELECT * FROM call_watcher_calls WHERE user_id = ? AND incoming_at >= ? ORDER BY incoming_at DESC LIMIT 1")
        .get(userId, messageTs - 20 * 60_000)) as Record<string, unknown> | undefined);

  let correlation: Record<string, unknown> | null = null;
  if (recentCall) {
    const callTs = Number(recentCall.incoming_at);
    const diffMs = Math.abs(messageTs - callTs);
    const duringCall = recentCall.ended_at === null || (messageTs >= callTs && messageTs <= Number(recentCall.ended_at) + 60_000);
    const unknownCaller = String(recentCall.caller_classification) !== "Known Contact";
    const combinedScore = Math.min(
      100,
      scamRes.score + (duringCall ? 25 : 15) + (unknownCaller ? 25 : 5) + (amount && amount >= 5000 ? 15 : 0)
    );
    const corrId = generateId("cor");
    const summary =
      lang === "hi"
        ? `कॉल और भुगतान संदेश के बीच ${Math.round(diffMs / 1000)} सेकंड का समय मेल (${duringCall ? "कॉल के दौरान" : "कॉल के तुरंत बाद"})`
        : `Payment activity occurred ${duringCall ? "during an active call" : `${Math.round(diffMs / 1000)}s after a call`} with ${String(recentCall.caller_masked)}`;
    const guidance =
      lang === "hi"
        ? "कॉल पर रहते हुए कभी भुगतान न करें या OTP/PIN न बताएं। कॉल काटकर परिवार के सदस्य से बात करें।"
        : "Never authorize a payment or share OTP/PIN while on a phone call. Hang up and call a trusted family member.";

    await db
      .prepare(
        `INSERT INTO call_payment_correlations (id, user_id, call_id, payment_event_id, time_diff_ms, during_call, call_risk_level, payment_risk_level, combined_risk_score, status, summary, guidance, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`
      )
      .run(
        corrId,
        userId,
        String(recentCall.id),
        id,
        diffMs,
        duringCall ? 1 : 0,
        unknownCaller ? "MEDIUM" : "LOW",
        scamRes.level,
        combinedScore,
        summary,
        guidance,
        Date.now()
      );
    correlation = (await db
      .prepare("SELECT * FROM call_payment_correlations WHERE id = ?")
      .get(corrId)) as Record<string, unknown>;

    if (combinedScore >= 45) {
      const guardians = await getActiveGuardiansForParent(userId);
      for (const g of guardians) {
        await createNotification(
          g.guardian_id,
          userId,
          "call_payment_correlation",
          "Call + Payment Timing Alert",
          `${userName}: ${summary}`
        );
      }
    }
  }

  const event = (await db.prepare("SELECT * FROM payment_message_events WHERE id = ?").get(id)) as Record<string, unknown>;
  return { duplicate: false, event, correlation };
}

export async function submitSafetyQuestionnaire(
  userId: string,
  userName: string,
  input: {
    correlationId: string;
    askedToDo?: string;
    urgencyPressure?: boolean;
    askedSensitiveCreds?: boolean;
    emotionalFeeling?: string;
    dismissed?: boolean;
  },
  lang: "en" | "hi" = "en"
) {
  const corr = (await db
    .prepare("SELECT * FROM call_payment_correlations WHERE id = ? AND user_id = ?")
    .get(input.correlationId, userId)) as Record<string, unknown> | undefined;
  if (!corr) throw new Error("Correlation record not found.");

  await db
    .prepare(
      `INSERT INTO safety_questionnaire_responses (id, user_id, correlation_id, asked_to_do, urgency_pressure, asked_sensitive_creds, emotional_feeling, dismissed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      generateId("qnr"),
      userId,
      input.correlationId,
      input.askedToDo ? String(input.askedToDo).slice(0, 120) : null,
      input.urgencyPressure ? 1 : 0,
      input.askedSensitiveCreds ? 1 : 0,
      input.emotionalFeeling ? String(input.emotionalFeeling).slice(0, 60) : null,
      input.dismissed ? 1 : 0,
      Date.now()
    );

  const nextStatus = input.dismissed
    ? "dismissed"
    : input.askedSensitiveCreds || input.urgencyPressure
      ? "escalated_risk"
      : "reviewed";

  await db.prepare("UPDATE call_payment_correlations SET status = ? WHERE id = ?").run(nextStatus, input.correlationId);

  if (input.askedSensitiveCreds || input.urgencyPressure) {
    const guardians = await getActiveGuardiansForParent(userId);
    for (const g of guardians) {
      await createNotification(
        g.guardian_id,
        userId,
        "questionnaire_alert",
        lang === "hi" ? "तुरंत कॉल सहायता" : "Parent Reported Call Pressure",
        `${userName} indicated urgency or credential requests on a recent call.`
      );
    }
  }

  return db.prepare("SELECT * FROM call_payment_correlations WHERE id = ?").get(input.correlationId);
}

export async function markCallerTrustedWithSafeguard(
  userId: string,
  params: { callerIdentifier?: string; callerHash?: string; entityId?: string; note?: string }
) {
  const hash =
    params.callerHash ||
    (params.callerIdentifier ? hashCaller(params.callerIdentifier) : null);
  if (!hash && !params.entityId) {
    throw new Error("Provide a caller identifier or entity ID.");
  }
  const now = Date.now();
  if (hash) {
    const existing = (await db
      .prepare("SELECT id FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ?")
      .get(userId, hash)) as { id: string } | undefined;
    if (existing) {
      await db
        .prepare("UPDATE gsi_threat_intel SET reputation_label = 'trusted', confidence = 0.9, updated_at = ? WHERE id = ?")
        .run(now, existing.id);
    } else {
      await db
        .prepare(
          "INSERT INTO gsi_threat_intel (id, user_id, indicator_type, indicator_hash, indicator_display, reputation_label, confidence, report_count, false_positive_count, updated_at) VALUES (?, ?, 'phone', ?, ?, 'trusted', 0.9, 0, 0, ?)"
        )
        .run(
          generateId("thr"),
          userId,
          hash,
          params.callerIdentifier ? maskCaller(params.callerIdentifier) : "Trusted caller",
          now
        );
    }
  }
  await writeAudit(userId, "Marked caller trusted (OTP/PIN safeguard remains active)");
  return {
    ok: true,
    safeguardReminder: "Even trusted contacts can be spoofed—never share OTP, UPI PIN, or bank passwords.",
  };
}

export async function notifyLinkedGuardiansFromAssistant(
  userId: string,
  userName: string,
  params: { correlationId?: string; message?: string }
) {
  const guardians = await getActiveGuardiansForParent(userId);
  if (guardians.length === 0) {
    return { ok: false, sentCount: 0, message: "No active linked guardian found." };
  }
  const body =
    String(params.message || "").trim().slice(0, 240) ||
    `${userName} asked for a quick family check on a recent phone call.`;
  for (const g of guardians) {
    await createNotification(g.guardian_id, userId, "assistant_guardian_ping", "Family Call Check Request", body);
  }
  await writeAudit(userId, "Notified linked guardian from Call Safety Assistant");
  return { ok: true, sentCount: guardians.length };
}

export async function processAutomaticIncomingCall(
  userId: string,
  userName: string,
  input: {
    callerIdentifier?: string;
    callerClassification?: string;
    callScreeningRoleGranted?: boolean;
    source?: string;
    externalEventId?: string;
  },
  lang: "en" | "hi" = "en"
) {
  const settings = await ensureCallWatcherSettings(userId);
  if (String(settings.consent_status) !== "active") {
    return {
      skipped: true,
      autoDetectionEnabled: false,
      reason:
        lang === "hi"
          ? "स्वचालित कॉल पहचान अभी बंद (OFF) है। इसे चालू करने पर आने वाली कॉल की पृष्ठभूमि जांच होगी।"
          : "Automatic background call detection is currently OFF. Enable it to screen incoming calls.",
      privacyGuarantees: PRIVACY_GUARANTEES,
    };
  }

  const screening = await screenIncomingCaller(userId, {
    callerIdentifier: input.callerIdentifier,
    callerClassification: input.callerClassification,
    callScreeningRoleGranted: input.callScreeningRoleGranted,
  });

  const recorded = await recordCallWatcherCall(
    userId,
    userName,
    {
      externalEventId: input.externalEventId,
      callerIdentifier: input.callerIdentifier,
      callerClassification: input.callerClassification || "Unknown Number",
      callStatus:
        screening.riskClassification === "HIGH RISK"
          ? "Flagged (High Risk)"
          : screening.riskClassification === "CAUTION"
            ? "Flagged (Caution)"
            : "Screened",
      callLifecyclePhase: "ringing",
      incomingAt: Date.now(),
      startedAt: null,
      endedAt: null,
      durationMs: null,
      screeningVerdict: screening.verdict,
      screeningLatencyMs: screening.latencyMs,
      source: input.source || "background_call_screening",
    },
    lang
  );

  if (!recorded.duplicate && screening.suspicionAssessment) {
    await recordRiskHistory({
      userId,
      identifierType: "mobile",
      assessment: screening.suspicionAssessment,
    });
  }

  let alertTriggered = false;
  if (
    Number(settings.notify_unknown_calls) &&
    (screening.riskClassification === "HIGH RISK" || screening.riskClassification === "CAUTION")
  ) {
    alertTriggered = true;
    const alertTitle =
      screening.riskClassification === "HIGH RISK"
        ? lang === "hi"
          ? `उच्च जोखिम इनकमिंग कॉल: ${screening.callerMasked}`
          : `High-Risk Incoming Call: ${screening.callerMasked}`
        : lang === "hi"
          ? `संदिग्ध इनकमिंग कॉल सावधानी: ${screening.callerMasked}`
          : `Suspicious Call Caution: ${screening.callerMasked}`;
    const alertBody = lang === "hi" ? screening.reasonHi : screening.reason;
    await createNotification(userId, userId, "incoming_call_risk", alertTitle, alertBody);

    if (screening.riskClassification === "HIGH RISK") {
      const guardians = await getActiveGuardiansForParent(userId);
      for (const g of guardians) {
        await createNotification(
          g.guardian_id,
          userId,
          "incoming_call_risk_guardian",
          lang === "hi"
            ? `${userName}: उच्च जोखिम कॉल चेतावनी`
            : `${userName}: High-Risk Incoming Call Screened`,
          `${screening.callerMasked} · ${alertBody}`
        );
      }
    }
  }

  return {
    skipped: false,
    autoDetectionEnabled: true,
    screening,
    call: recorded.call,
    alertTriggered,
    userActionsAvailable: ["answer_caution", "reject", "block_and_flag"] as const,
    privacyGuarantees: PRIVACY_GUARANTEES,
  };
}

export async function applyUserCallDecision(
  userId: string,
  params: {
    callId?: string;
    callerIdentifier?: string;
    decision: "answer_caution" | "reject" | "block_and_flag";
  },
  lang: "en" | "hi" = "en"
) {
  const now = Date.now();
  const rawId = String(params.callerIdentifier || "").trim();
  const callerHash = rawId ? hashCaller(rawId) : null;
  const masked = rawId ? maskCaller(rawId) : "Unknown caller";

  let statusText = "Answered (Caution)";
  if (params.decision === "reject") statusText = "Rejected by User";
  else if (params.decision === "block_and_flag") statusText = "Blocked & Flagged";

  if (params.callId) {
    await db
      .prepare(
        `UPDATE call_watcher_calls
         SET call_status = ?, call_lifecycle_phase = 'ended', ended_at = COALESCE(ended_at, ?)
         WHERE id = ? AND user_id = ?`
      )
      .run(statusText, now, params.callId, userId);
  }

  if (params.decision === "block_and_flag" && callerHash) {
    const existing = (await db
      .prepare("SELECT id, report_count FROM gsi_threat_intel WHERE user_id = ? AND indicator_hash = ? LIMIT 1")
      .get(userId, callerHash)) as { id: string; report_count: number } | undefined;

    if (existing) {
      await db
        .prepare(
          "UPDATE gsi_threat_intel SET reputation_label = 'malicious', confidence = 0.95, report_count = ?, updated_at = ? WHERE id = ?"
        )
        .run((existing.report_count || 0) + 1, now, existing.id);
    } else {
      await db
        .prepare(
          "INSERT INTO gsi_threat_intel (id, user_id, indicator_type, indicator_hash, indicator_display, reputation_label, confidence, report_count, false_positive_count, updated_at) VALUES (?, ?, 'phone', ?, ?, 'malicious', 0.95, 1, 0, ?)"
        )
        .run(generateId("thr"), userId, callerHash, masked, now);
    }

    if (params.callId) {
      await db
        .prepare("UPDATE call_watcher_calls SET screening_verdict = 'allow_with_warning' WHERE id = ? AND user_id = ?")
        .run(params.callId, userId);
    }
  }

  await writeAudit(
    userId,
    `User decision on screened call (${masked}): ${statusText}`
  );

  return {
    ok: true,
    decision: params.decision,
    statusText,
    callerMasked: masked,
    message:
      params.decision === "block_and_flag"
        ? lang === "hi"
          ? `${masked} को आपकी थ्रेट सूची में ब्लॉक/फ़्लैग किया गया। Android उपकरण पर कॉल रोकने के लिए CallScreeningService भूमिका आवश्यक है।`
          : `${masked} has been flagged & added to your block cache. Carrier-level call blocking requires Android CallScreeningService permission on device.`
        : params.decision === "reject"
          ? lang === "hi"
            ? `${masked} की कॉल अस्वीकृत के रूप में दर्ज की गई।`
            : `Recorded call rejection for ${masked}.`
          : lang === "hi"
            ? `${masked} को सावधानी के साथ उत्तरित चिह्नित किया गया (OTP/PIN कभी साझा न करें)।`
            : `Marked ${masked} as answered with caution (never share OTP or PIN).`,
  };
}

export async function getCallWatcherDashboard(userId: string) {
  const settings = await ensureCallWatcherSettings(userId);
  const [calls, paymentMessages, correlations, totalRow, suspRow, highRow] = await Promise.all([
    db
      .prepare("SELECT * FROM call_watcher_calls WHERE user_id = ? ORDER BY incoming_at DESC LIMIT 25")
      .all(userId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT * FROM payment_message_events WHERE user_id = ? ORDER BY message_ts DESC LIMIT 20")
      .all(userId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT * FROM call_payment_correlations WHERE user_id = ? ORDER BY created_at DESC LIMIT 15")
      .all(userId) as Promise<Record<string, unknown>[]>,
    db.prepare("SELECT COUNT(*) as c FROM call_watcher_calls WHERE user_id = ?").get(userId) as Promise<{ c: number }>,
    db
      .prepare(
        "SELECT COUNT(*) as c FROM call_watcher_calls WHERE user_id = ? AND screening_verdict IN ('allow_with_warning', 'allow_caution')"
      )
      .get(userId) as Promise<{ c: number }>,
    db
      .prepare(
        "SELECT COUNT(*) as c FROM call_watcher_calls WHERE user_id = ? AND screening_verdict = 'allow_with_warning'"
      )
      .get(userId) as Promise<{ c: number }>,
  ]);

  const recentlyFlagged = calls
    .filter((c) => c.screening_verdict === "allow_with_warning" || c.screening_verdict === "allow_caution")
    .slice(0, 5)
    .map((c) => ({
      id: String(c.id),
      caller_masked: String(c.caller_masked),
      caller_classification: String(c.caller_classification),
      screening_verdict: String(c.screening_verdict),
      risk_classification: deriveCallRiskClassification(
        String(c.screening_verdict),
        String(c.caller_classification),
        String(c.call_status || "").includes("Flagged") || c.screening_verdict === "allow_with_warning"
      ),
      call_status: String(c.call_status),
      incoming_at: Number(c.incoming_at),
      source: String(c.source || "manual"),
    }));

  const autoDetectionEnabled = String(settings.consent_status) === "active";
  const lastScreeningAt = calls.length > 0 ? Number(calls[0].incoming_at) : null;

  return {
    settings: {
      ...settings,
      autoDetectionEnabled,
      protectionStatus: deriveProtectionStatus(settings),
    },
    summary: {
      autoDetectionEnabled,
      callsScreened: Number(totalRow?.c || 0),
      suspiciousIdentified: Number(suspRow?.c || 0),
      highRiskCount: Number(highRow?.c || 0),
      recentlyFlagged,
      lastScreeningAt,
      privacyGuarantees: PRIVACY_GUARANTEES,
      androidArchitecture: {
        runtimeMode: "browser_preview",
        requiredRole: "android.app.role.CALL_SCREENING",
        minimumAndroidApi: "Android 10 (API 29+)",
        microphonePermissionRequested: false,
        supportsCallAudioCapture: false,
        limitationNotice:
          "Browser preview cannot hook OS carrier calls directly. On Android 10+, Guardian uses Android CallScreeningService (metadata only, zero microphone/audio permissions) subject to user role approval and OEM battery rules.",
        limitationNoticeHi:
          "ब्राउज़र प्रीव्यू सीधे फोन कॉल नहीं पकड़ सकता। Android 10+ पर Guardian बिना माइक्रोफ़ोन या ऑडियो अनुमति के केवल CallScreeningService (मेटाडेटा आधारित) का उपयोग करता है, जो उपयोगकर्ता अनुमति और बैटरी नियमों के अधीन है।",
      },
    },
    calls,
    paymentMessages,
    correlations,
  };
}

export async function getGuardianSharedCallWatcher(parents: { id: string; name: string }[]) {
  if (!parents.length) return [];
  const ids = parents.map((p) => p.id);
  const nameMap = new Map(parents.map((p) => [p.id, p.name]));
  const rows = (await db
    .prepare(
      `SELECT * FROM call_payment_correlations WHERE user_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT 20`
    )
    .all(...ids)) as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, parentName: nameMap.get(String(r.user_id)) || "Parent" }));
}

export async function getGuardianCallProtectionSummary(parents: { id: string; name: string }[]) {
  if (!parents.length) return [];
  const summaries = await Promise.all(
    parents.map(async (p) => {
      const dash = await getCallWatcherDashboard(p.id);
      return {
        parentId: p.id,
        parentName: p.name,
        autoDetectionEnabled: dash.summary.autoDetectionEnabled,
        callsScreened: dash.summary.callsScreened,
        suspiciousIdentified: dash.summary.suspiciousIdentified,
        lastScreeningAt: dash.summary.lastScreeningAt,
        recentlyFlagged: dash.summary.recentlyFlagged.slice(0, 3),
      };
    })
  );
  return summaries;
}

export async function cleanupCallWatcherRetention(userId: string, retentionDays: number): Promise<void> {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 86_400_000;
  await db.prepare("DELETE FROM call_watcher_calls WHERE user_id = ? AND created_at < ?").run(userId, cutoff);
  await db.prepare("DELETE FROM payment_message_events WHERE user_id = ? AND created_at < ?").run(userId, cutoff);
  await db.prepare("DELETE FROM call_payment_correlations WHERE user_id = ? AND created_at < ?").run(userId, cutoff);
}
