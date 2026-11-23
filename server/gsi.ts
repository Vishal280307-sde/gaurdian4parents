import crypto from "node:crypto";
import { db } from "./db.ts";
import { analyzeUrlIntelligence, extractUrlsFromText } from "./linkIntelligence.ts";
import { analyzeScamText } from "./scamEngine.ts";
import {
  createNotification,
  ensureDefaultConsent,
  generateId,
  getActiveGuardiansForParent,
  getActiveLinkedParentIds,
  writeAudit,
} from "./security.ts";
import { lookupSharedEntitiesForQuery, recordGcihDomainEvent, upsertGcihEntity } from "./gcih.ts";

export type GsiAlertLevel = "GREEN" | "YELLOW" | "RED" | "CRITICAL_RED";

export interface GsiIngestInput {
  familyOwnerId: string;
  familyOwnerName: string;
  deviceId?: string;
  eventType: "call_event" | "sms_event" | "link_event" | "qr_event" | "payment_event";
  eventTimestamp?: number;
  sourceModule: string;
  lang?: "en" | "hi";
  allowNetworkProbe?: boolean;
  skipAi?: boolean;
  callData?: {
    callerClassification?: string;
    callStatus?: string;
    durationMs?: number | null;
    known?: boolean;
    callerMasked?: string;
  };
  smsData?: {
    rawText: string;
    senderLabel?: string | null;
  };
  linkData?: {
    url: string;
    contextText?: string;
  };
  qrData?: {
    payload: string;
    score?: number;
  };
  paymentData?: {
    direction?: string;
    amount: number;
    beneficiary?: string | null;
    knownDeclared?: boolean;
    baseScore?: number;
    signals?: string[];
  };
}

export async function ingestGsiEvent(input: GsiIngestInput) {
  await ensureDefaultConsent(input.familyOwnerId);
  const consent = (await db.prepare("SELECT * FROM consents WHERE user_id = ?").get(input.familyOwnerId)) as Record<
    string,
    number
  >;
  const now = input.eventTimestamp || Date.now();
  const eventId = generateId("gev");
  let riskScore = 0;
  let incidentCategory = "safety_check";
  const reasons: string[] = [];
  let recommendedAction = "Continue with standard awareness.";
  let paymentIntel: { sharedAssociations: Record<string, unknown>[] } | undefined;

  if (input.eventType === "sms_event" && input.smsData) {
    const res = analyzeScamText(input.smsData.rawText);
    riskScore = res.score;
    incidentCategory = res.category;
    reasons.push(...res.signals);
    recommendedAction = input.lang === "hi" ? res.guidanceHi : res.guidance;

    const urls = extractUrlsFromText(input.smsData.rawText);
    for (const u of urls.slice(0, 2)) {
      const linkRes = await analyzeUrlIntelligence(u, { userId: input.familyOwnerId, contextText: input.smsData.rawText });
      if (linkRes.riskScore > riskScore) riskScore = linkRes.riskScore;
      reasons.push(...linkRes.signals);
      await upsertGcihEntity({
        familyOwnerId: input.familyOwnerId,
        entityType: "domain",
        rawValue: linkRes.domain,
        sourceModule: input.sourceModule,
        riskClassification: linkRes.riskScore >= 45 ? "Suspicious" : "Neutral",
      });
    }
    if (input.smsData.senderLabel) {
      await upsertGcihEntity({
        familyOwnerId: input.familyOwnerId,
        entityType: "sender",
        rawValue: input.smsData.senderLabel,
        sourceModule: input.sourceModule,
        riskClassification: riskScore >= 45 ? "Suspicious" : "Neutral",
      });
    }
  } else if (input.eventType === "link_event" && input.linkData) {
    const linkRes = await analyzeUrlIntelligence(input.linkData.url, {
      userId: input.familyOwnerId,
      contextText: input.linkData.contextText,
    });
    riskScore = linkRes.riskScore;
    incidentCategory = linkRes.looksLikeImpersonation ? "brand_impersonation_link" : "link_inspection";
    reasons.push(...linkRes.signals);
    recommendedAction = linkRes.summary;
    await upsertGcihEntity({
      familyOwnerId: input.familyOwnerId,
      entityType: "domain",
      rawValue: linkRes.domain,
      sourceModule: input.sourceModule,
      riskClassification: riskScore >= 45 ? "Suspicious" : "Neutral",
    });
  } else if (input.eventType === "call_event" && input.callData) {
    const known = Boolean(input.callData.known);
    const dur = input.callData.durationMs ?? 0;
    incidentCategory = "call_metadata_watch";
    // Long isolated call safeguard: an isolated long call alone never triggers high/red alert
    if (!known) {
      riskScore = dur > 900_000 ? 18 : 12;
      reasons.push("Unknown caller timing logged (metadata only, no audio)");
      recommendedAction = "Only treat an unknown call as urgent if the caller asks for OTP, PIN, or money.";
    } else {
      riskScore = 5;
      reasons.push("Saved contact call timing logged");
    }
  } else if (input.eventType === "payment_event" && input.paymentData) {
    riskScore = Number(input.paymentData.baseScore || 0);
    incidentCategory = "payment_intent_review";
    reasons.push(...(input.paymentData.signals || []));
    const ben = input.paymentData.beneficiary || "";
    if (ben) {
      const candidates = [{ type: ben.includes("@") ? "upi" : "merchant", value: ben }];
      const shared = await lookupSharedEntitiesForQuery({
        familyOwnerId: input.familyOwnerId,
        candidates,
        currentSection: "payment_safety",
      });
      if (shared.some((s) => s.risk_classification === "Suspicious")) {
        riskScore = Math.min(100, riskScore + 25);
        reasons.push("Beneficiary previously flagged across family safety checks");
      }
      paymentIntel = { sharedAssociations: shared };
      await upsertGcihEntity({
        familyOwnerId: input.familyOwnerId,
        entityType: ben.includes("@") ? "upi" : "merchant",
        rawValue: ben,
        sourceModule: input.sourceModule,
        riskClassification: riskScore >= 45 ? "Suspicious" : "Neutral",
      });
    }
    recommendedAction =
      riskScore >= 45
        ? "Verify payee on an independently saved phone number or request guardian approval."
        : "Confirm payee details before completing payment.";
  } else if (input.eventType === "qr_event" && input.qrData) {
    riskScore = Number(input.qrData.score || 25);
    incidentCategory = "qr_inspection";
  }

  const severity =
    riskScore >= 75 ? "CRITICAL" : riskScore >= 45 ? "HIGH" : riskScore >= 20 ? "MEDIUM" : "LOW";
  const alertLevel: GsiAlertLevel =
    riskScore >= 75 ? "CRITICAL_RED" : riskScore >= 45 ? "RED" : riskScore >= 20 ? "YELLOW" : "GREEN";

  await db
    .prepare(
      `INSERT INTO gsi_events (event_id, family_owner_id, device_id, event_type, source_module, risk_score, severity, metadata_json, event_timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      eventId,
      input.familyOwnerId,
      input.deviceId || "web_session",
      input.eventType,
      input.sourceModule,
      riskScore,
      severity,
      JSON.stringify({ reasons }),
      now,
      now
    );

  const dedupKey = crypto
    .createHash("sha256")
    .update(`${input.familyOwnerId}:${incidentCategory}:${alertLevel}`)
    .digest("hex")
    .slice(0, 16);
  const cooldownMs = Number(consent?.red_alert_cooldown_sec ?? 600) * 1000;

  const recentSame = (await db
    .prepare(
      "SELECT * FROM gsi_incidents WHERE family_owner_id = ? AND dedup_key = ? AND updated_at > ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(input.familyOwnerId, dedupKey, now - cooldownMs)) as Record<string, unknown> | undefined;

  let incidentId: string;
  if (recentSame) {
    incidentId = String(recentSame.incident_id);
    await db
      .prepare("UPDATE gsi_incidents SET risk_score = MAX(risk_score, ?), updated_at = ? WHERE incident_id = ?")
      .run(riskScore, now, incidentId);
  } else {
    incidentId = generateId("inc");
    await db
      .prepare(
        `INSERT INTO gsi_incidents (incident_id, family_owner_id, incident_category, risk_score, severity, alert_level, confidence, detection_source, reasoning_summary, recommended_action, acknowledgement_status, resolution_status, workflow_status, dedup_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unacknowledged', 'open', 'New', ?, ?, ?)`
      )
      .run(
        incidentId,
        input.familyOwnerId,
        incidentCategory,
        riskScore,
        severity,
        alertLevel,
        riskScore >= 45 ? 0.88 : 0.72,
        input.sourceModule,
        reasons.slice(0, 4).join(" · ") || "Routine safety inspection",
        recommendedAction,
        dedupKey,
        now,
        now
      );

    if ((alertLevel === "RED" || alertLevel === "CRITICAL_RED") && consent?.guardian_alerts && !consent?.paused) {
      const guardians = await getActiveGuardiansForParent(input.familyOwnerId);
      for (const g of guardians) {
        await createNotification(
          g.guardian_id,
          input.familyOwnerId,
          "gsi_red_alert",
          `${alertLevel === "CRITICAL_RED" ? "Critical" : "Red"} Safety Alert`,
          `${input.familyOwnerName}: ${reasons[0] || incidentCategory} (score ${riskScore}/100).`
        );
      }
    }
  }

  await recordGcihDomainEvent({
    familyOwnerId: input.familyOwnerId,
    sourceModule: input.sourceModule,
    eventType: input.eventType,
    summary: `${incidentCategory} (${alertLevel}, ${riskScore}/100)`,
    eventTimestamp: now,
  });

  const incidentRow = (await db
    .prepare("SELECT * FROM gsi_incidents WHERE incident_id = ?")
    .get(incidentId)) as Record<string, unknown>;

  return {
    eventId,
    incident: {
      incidentId: String(incidentRow.incident_id),
      incidentCategory: String(incidentRow.incident_category),
      riskScore: Number(incidentRow.risk_score),
      severity: String(incidentRow.severity),
      alertLevel: String(incidentRow.alert_level) as GsiAlertLevel,
      reasoningSummary: String(incidentRow.reasoning_summary),
      recommendedAction: String(incidentRow.recommended_action),
      workflowStatus: String(incidentRow.workflow_status),
    },
    decision: {
      alertLevel,
      riskScore,
      severity,
    },
    paymentIntel,
  };
}

export async function recordGsiFeedback(params: {
  actorId: string;
  actorRole: "parent" | "guardian";
  incidentId: string;
  action: "acknowledge" | "resolve" | "confirm_threat" | "false_positive";
  note?: string;
}) {
  const row = (await db.prepare("SELECT * FROM gsi_incidents WHERE incident_id = ?").get(params.incidentId)) as
    | { incident_id: string; family_owner_id: string }
    | undefined;
  if (!row) throw new Error("Incident not found.");
  if (params.actorRole === "parent" && row.family_owner_id !== params.actorId) {
    throw new Error("Unauthorized incident access.");
  }
  if (params.actorRole === "guardian") {
    const linked = await getActiveLinkedParentIds(params.actorId);
    if (!linked.includes(row.family_owner_id)) throw new Error("Unauthorized guardian access.");
  }

  let ack = "acknowledged";
  let resStatus = "open";
  let wf = "Acknowledged";
  if (params.action === "resolve") {
    resStatus = "resolved";
    wf = "Resolved";
  } else if (params.action === "false_positive") {
    resStatus = "false_positive";
    wf = "False positive";
  } else if (params.action === "confirm_threat") {
    wf = "Investigating";
  }

  await db
    .prepare("UPDATE gsi_incidents SET acknowledgement_status = ?, resolution_status = ?, workflow_status = ?, updated_at = ? WHERE incident_id = ?")
    .run(ack, resStatus, wf, Date.now(), row.incident_id);
  await writeAudit(params.actorId, `GSI incident ${row.incident_id} marked ${params.action}`);
  return db.prepare("SELECT * FROM gsi_incidents WHERE incident_id = ?").get(row.incident_id);
}

export async function buildPeriodicReport(familyOwnerId: string, periodType: "daily" | "weekly" | "monthly") {
  const days = periodType === "daily" ? 1 : periodType === "weekly" ? 7 : 30;
  const since = Date.now() - days * 86_400_000;
  const incidents = (await db
    .prepare("SELECT severity, alert_level, resolution_status FROM gsi_incidents WHERE family_owner_id = ? AND created_at >= ?")
    .all(familyOwnerId, since)) as { severity: string; alert_level: string; resolution_status: string }[];

  const summary = {
    periodType,
    totalIncidents: incidents.length,
    redAlerts: incidents.filter((i) => i.alert_level === "RED" || i.alert_level === "CRITICAL_RED").length,
    resolved: incidents.filter((i) => i.resolution_status === "resolved").length,
    falsePositives: incidents.filter((i) => i.resolution_status === "false_positive").length,
    generatedAt: Date.now(),
  };

  const id = generateId("rep");
  const periodKey = `${periodType}-${new Date().toISOString().slice(0, 10)}`;
  await db
    .prepare("INSERT INTO gsi_reports (id, family_owner_id, period_type, period_key, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, familyOwnerId, periodType, periodKey, JSON.stringify(summary), Date.now());
  return { id, periodKey, ...summary };
}

export async function getGsiDashboardState(familyOwnerId: string) {
  const [incidents, reports] = await Promise.all([
    db
      .prepare("SELECT * FROM gsi_incidents WHERE family_owner_id = ? ORDER BY updated_at DESC LIMIT 25")
      .all(familyOwnerId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT id, period_type, period_key, report_json, created_at FROM gsi_reports WHERE family_owner_id = ? ORDER BY created_at DESC LIMIT 10")
      .all(familyOwnerId) as Promise<Record<string, unknown>[]>,
  ]);
  const activeRedAlerts = incidents.filter(
    (i) => (i.alert_level === "RED" || i.alert_level === "CRITICAL_RED") && i.resolution_status === "open"
  );
  return { incidents, activeRedAlerts, reports };
}

export async function getGuardianSharedGsiOverview(parents: { id: string; name: string }[]) {
  if (!parents.length) return { incidents: [], activeRedAlerts: [], reports: [] };
  const ids = parents.map((p) => p.id);
  const nameMap = new Map(parents.map((p) => [p.id, p.name]));
  const incidents: Record<string, unknown>[] = (
    (await db
      .prepare(
        `SELECT * FROM gsi_incidents WHERE family_owner_id IN (${ids.map(() => "?").join(",")}) ORDER BY updated_at DESC LIMIT 25`
      )
      .all(...ids)) as Record<string, unknown>[]
  ).map((i) => ({ ...i, parent_name: nameMap.get(String(i.family_owner_id)) || "Parent" }));
  const activeRedAlerts = incidents.filter(
    (i) => (i.alert_level === "RED" || i.alert_level === "CRITICAL_RED") && i.resolution_status === "open"
  );
  return { incidents, activeRedAlerts, reports: [] };
}

export async function cleanupGsiRetention(familyOwnerId: string, retentionDays: number): Promise<void> {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 86_400_000;
  await db.prepare("DELETE FROM gsi_events WHERE family_owner_id = ? AND created_at < ?").run(familyOwnerId, cutoff);
}
