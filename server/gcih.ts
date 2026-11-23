import crypto from "node:crypto";
import { db } from "./db.ts";
import { generateId, getActiveLinkedParentIds, writeAudit } from "./security.ts";

export type GcihSectionKey = "call_scam" | "sms_scam" | "qr_scam" | "link_scam" | "payment_safety";
export type GcihIncidentWorkflowStatus =
  | "New"
  | "Investigating"
  | "Acknowledged"
  | "Resolved"
  | "False positive"
  | "Reopened";

export interface GcihDevicePermissions {
  shareCalls: boolean;
  shareSms: boolean;
  shareQr: boolean;
  shareLinks: boolean;
  sharePayments: boolean;
  receiveRedAlerts: boolean;
}

const DEFAULT_PERMISSIONS: GcihDevicePermissions = {
  shareCalls: true,
  shareSms: true,
  shareQr: true,
  shareLinks: true,
  sharePayments: true,
  receiveRedAlerts: true,
};

function normalizeEntityKey(type: string, raw: string): string {
  return `${type}:${crypto.createHash("sha256").update(raw.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
}

function maskEntityDisplay(type: string, raw: string): string {
  const s = raw.trim();
  if (type === "phone") {
    const digits = s.replace(/\D/g, "");
    if (digits.length >= 6) return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
  }
  return s.slice(0, 48);
}

export function extractEntitiesFromPayment(params: {
  beneficiary?: string | null;
  signals?: string[];
}): { type: string; value: string }[] {
  const out: { type: string; value: string }[] = [];
  if (params.beneficiary && params.beneficiary.trim()) {
    const b = params.beneficiary.trim();
    out.push({ type: b.includes("@") ? "upi" : "merchant", value: b });
  }
  return out;
}

export async function upsertGcihEntity(params: {
  familyOwnerId: string;
  entityType: string;
  rawValue: string;
  sourceModule: string;
  riskClassification?: "Suspicious" | "Neutral" | "Trusted" | "Confirmed Safe";
}): Promise<string> {
  const normalizedKey = normalizeEntityKey(params.entityType, params.rawValue);
  const maskedDisplay = maskEntityDisplay(params.entityType, params.rawValue);
  const now = Date.now();
  const existing = (await db
    .prepare("SELECT id, source_modules_json, version, risk_classification FROM gcih_entities WHERE family_owner_id = ? AND normalized_key = ?")
    .get(params.familyOwnerId, normalizedKey)) as
    | { id: string; source_modules_json: string; version: number; risk_classification: string }
    | undefined;

  if (existing) {
    const modules = new Set<string>(JSON.parse(existing.source_modules_json || "[]") as string[]);
    modules.add(params.sourceModule);
    const nextRisk =
      existing.risk_classification === "Confirmed Safe"
        ? "Confirmed Safe"
        : params.riskClassification || existing.risk_classification;
    await db
      .prepare(
        "UPDATE gcih_entities SET source_modules_json = ?, risk_classification = ?, version = ?, updated_at = ? WHERE id = ?"
      )
      .run(JSON.stringify([...modules]), nextRisk, existing.version + 1, now, existing.id);
    return existing.id;
  }

  const id = generateId("ent");
  await db
    .prepare(
      `INSERT INTO gcih_entities (id, family_owner_id, entity_type, normalized_key, masked_display, risk_classification, verification_status, source_modules_json, version, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unverified', ?, 1, ?, ?)`
    )
    .run(
      id,
      params.familyOwnerId,
      params.entityType,
      normalizedKey,
      maskedDisplay,
      params.riskClassification || "Neutral",
      JSON.stringify([params.sourceModule]),
      now,
      now
    );
  return id;
}

export async function recordGcihDomainEvent(params: {
  familyOwnerId: string;
  sourceModule: string;
  eventType: string;
  summary: string;
  eventTimestamp?: number;
}): Promise<string> {
  const id = generateId("gev");
  await db
    .prepare(
      `INSERT INTO gcih_domain_events (id, family_owner_id, source_module, event_type, sync_status, summary, event_timestamp)
       VALUES (?, ?, ?, ?, 'Successfully synchronised', ?, ?)`
    )
    .run(
      id,
      params.familyOwnerId,
      params.sourceModule,
      params.eventType,
      params.summary.slice(0, 220),
      params.eventTimestamp || Date.now()
    );
  return id;
}

export async function lookupSharedEntitiesForQuery(params: {
  familyOwnerId: string;
  candidates: { type: string; value: string }[];
  currentSection: GcihSectionKey;
}) {
  if (!params.candidates.length) return [];
  const results: Record<string, unknown>[] = [];
  for (const c of params.candidates) {
    const key = normalizeEntityKey(c.type, c.value);
    const row = (await db
      .prepare(
        "SELECT id, entity_type, masked_display, risk_classification, verification_status, source_modules_json, updated_at FROM gcih_entities WHERE family_owner_id = ? AND normalized_key = ?"
      )
      .get(params.familyOwnerId, key)) as Record<string, unknown> | undefined;
    if (row) {
      results.push({
        ...row,
        sourceModules: JSON.parse(String(row.source_modules_json || "[]")),
        section: params.currentSection,
      });
    }
  }
  return results;
}

export async function getSharedIntelligenceForSection(familyOwnerId: string, section: GcihSectionKey) {
  const rows = (await db
    .prepare(
      "SELECT id, entity_type, masked_display, risk_classification, verification_status, source_modules_json, updated_at FROM gcih_entities WHERE family_owner_id = ? ORDER BY updated_at DESC LIMIT 30"
    )
    .all(familyOwnerId)) as Record<string, unknown>[];
  return rows.map((r) => ({
    ...r,
    sourceModules: JSON.parse(String(r.source_modules_json || "[]")),
    section,
  }));
}

export async function registerFamilyDevice(params: {
  deviceId?: string;
  userId: string;
  familyOwnerId: string;
  deviceLabel: string;
  platform: string;
  role: "parent" | "guardian";
  permissions?: Partial<GcihDevicePermissions>;
}) {
  const id = params.deviceId?.trim().slice(0, 60) || generateId("dev");
  const now = Date.now();
  const perms = { ...DEFAULT_PERMISSIONS, ...(params.permissions || {}) };
  const existing = await db.prepare("SELECT id FROM gcih_devices WHERE id = ?").get(id);
  if (existing) {
    await db
      .prepare("UPDATE gcih_devices SET device_label = ?, platform = ?, status = 'active', last_seen_at = ? WHERE id = ?")
      .run(params.deviceLabel.slice(0, 80), params.platform.slice(0, 30), now, id);
  } else {
    await db
      .prepare(
        `INSERT INTO gcih_devices (id, user_id, family_owner_id, device_label, platform, role, status, permissions_json, last_seen_at, last_sync_cursor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
      )
      .run(id, params.userId, params.familyOwnerId, params.deviceLabel.slice(0, 80), params.platform.slice(0, 30), params.role, JSON.stringify(perms), now, now, now);
  }
  await writeAudit(params.userId, `Registered device ${params.deviceLabel}`);
  return db.prepare("SELECT * FROM gcih_devices WHERE id = ?").get(id);
}

export async function revokeFamilyDevice(params: { actorId: string; deviceId: string }) {
  const dev = (await db.prepare("SELECT * FROM gcih_devices WHERE id = ?").get(params.deviceId)) as
    | { id: string; user_id: string; family_owner_id: string }
    | undefined;
  if (!dev) throw new Error("Device not found.");
  if (dev.family_owner_id !== params.actorId && dev.user_id !== params.actorId) {
    throw new Error("Unauthorized: cannot revoke another family member's device.");
  }
  await db.prepare("UPDATE gcih_devices SET status = 'revoked', revoked_at = ? WHERE id = ?").run(Date.now(), dev.id);
  await writeAudit(params.actorId, `Revoked device ${dev.id}`);
  return db.prepare("SELECT * FROM gcih_devices WHERE id = ?").get(dev.id);
}

export async function updateDevicePermissions(params: {
  actorId: string;
  actorRole: "parent" | "guardian";
  deviceId: string;
  permissions: Partial<GcihDevicePermissions>;
}) {
  const dev = (await db.prepare("SELECT * FROM gcih_devices WHERE id = ?").get(params.deviceId)) as
    | { id: string; user_id: string; family_owner_id: string; permissions_json: string }
    | undefined;
  if (!dev) throw new Error("Device not found.");
  if (dev.family_owner_id !== params.actorId && dev.user_id !== params.actorId) {
    throw new Error("Unauthorized: cannot edit device permissions.");
  }
  const merged = {
    ...DEFAULT_PERMISSIONS,
    ...(JSON.parse(dev.permissions_json || "{}") as Partial<GcihDevicePermissions>),
    ...params.permissions,
  };
  await db.prepare("UPDATE gcih_devices SET permissions_json = ? WHERE id = ?").run(JSON.stringify(merged), dev.id);
  return db.prepare("SELECT * FROM gcih_devices WHERE id = ?").get(dev.id);
}

export async function submitEntityFeedback(params: {
  actorId: string;
  actorRole: "parent" | "guardian";
  entityId: string;
  feedbackType: "suspicious" | "legitimate" | "false_positive" | "request_review" | "incorrect_association";
  eventId?: string;
  incidentId?: string;
  note?: string;
}) {
  const ent = (await db.prepare("SELECT * FROM gcih_entities WHERE id = ?").get(params.entityId)) as
    | { id: string; family_owner_id: string; version: number }
    | undefined;
  if (!ent) throw new Error("Entity not found.");

  if (params.actorRole === "parent" && ent.family_owner_id !== params.actorId) {
    throw new Error("Unauthorized entity access.");
  }
  if (params.actorRole === "guardian") {
    const linked = await getActiveLinkedParentIds(params.actorId);
    if (!linked.includes(ent.family_owner_id)) throw new Error("Unauthorized guardian access.");
  }

  let nextRisk = "Neutral";
  let nextVerify = "reviewed";
  if (params.feedbackType === "suspicious") nextRisk = "Suspicious";
  else if (params.feedbackType === "legitimate" || params.feedbackType === "false_positive") {
    nextRisk = "Confirmed Safe";
    nextVerify = "confirmed_safe";
  } else if (params.feedbackType === "request_review") {
    nextVerify = "needs_review";
  }

  await db
    .prepare("UPDATE gcih_entities SET risk_classification = ?, verification_status = ?, version = ?, updated_at = ? WHERE id = ?")
    .run(nextRisk, nextVerify, ent.version + 1, Date.now(), ent.id);
  await writeAudit(params.actorId, `Entity ${ent.id} marked ${params.feedbackType}`);

  return { entity: await db.prepare("SELECT * FROM gcih_entities WHERE id = ?").get(ent.id) };
}

export async function correctRelationship(params: {
  actorId: string;
  actorRole: "parent" | "guardian";
  relationshipId: string;
  action: "dispute" | "correct" | "restore";
  note?: string;
}) {
  const rel = (await db.prepare("SELECT * FROM gcih_relationships WHERE id = ?").get(params.relationshipId)) as
    | { id: string; family_owner_id: string }
    | undefined;
  if (!rel) throw new Error("Relationship not found.");
  if (params.actorRole === "parent" && rel.family_owner_id !== params.actorId) {
    throw new Error("Unauthorized relationship access.");
  }
  if (params.actorRole === "guardian") {
    const linked = await getActiveLinkedParentIds(params.actorId);
    if (!linked.includes(rel.family_owner_id)) throw new Error("Unauthorized guardian access.");
  }
  const status = params.action === "dispute" ? "disputed" : params.action === "correct" ? "corrected" : "active";
  await db.prepare("UPDATE gcih_relationships SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), rel.id);
  return db.prepare("SELECT * FROM gcih_relationships WHERE id = ?").get(rel.id);
}

export async function updateIncidentWorkflow(params: {
  actorId: string;
  actorRole: "parent" | "guardian";
  incidentId: string;
  workflowStatus: GcihIncidentWorkflowStatus;
  note?: string;
}) {
  const inc = (await db.prepare("SELECT * FROM gsi_incidents WHERE incident_id = ?").get(params.incidentId)) as
    | { incident_id: string; family_owner_id: string }
    | undefined;
  if (!inc) throw new Error("Incident not found.");
  if (params.actorRole === "parent" && inc.family_owner_id !== params.actorId) {
    throw new Error("Unauthorized incident access.");
  }
  if (params.actorRole === "guardian") {
    const linked = await getActiveLinkedParentIds(params.actorId);
    if (!linked.includes(inc.family_owner_id)) throw new Error("Unauthorized guardian access.");
  }
  const ack = params.workflowStatus === "Acknowledged" ? "acknowledged" : params.workflowStatus === "New" ? "unacknowledged" : "acknowledged";
  const resStatus =
    params.workflowStatus === "Resolved"
      ? "resolved"
      : params.workflowStatus === "False positive"
        ? "false_positive"
        : "open";
  await db
    .prepare(
      "UPDATE gsi_incidents SET workflow_status = ?, acknowledgement_status = ?, resolution_status = ?, updated_at = ? WHERE incident_id = ?"
    )
    .run(params.workflowStatus, ack, resStatus, Date.now(), inc.incident_id);
  await writeAudit(params.actorId, `Incident ${inc.incident_id} workflow set to ${params.workflowStatus}`);
  return db.prepare("SELECT * FROM gsi_incidents WHERE incident_id = ?").get(inc.incident_id);
}

export async function buildFamilySyncPayload(params: {
  familyOwnerId: string;
  since?: number;
  devicePermissions?: Partial<GcihDevicePermissions>;
}) {
  const since = Number(params.since || 0);
  const [devices, entities, relationships, domainEvents] = await Promise.all([
    db
      .prepare("SELECT id, device_label, platform, role, status, permissions_json, last_seen_at FROM gcih_devices WHERE family_owner_id = ? ORDER BY last_seen_at DESC")
      .all(params.familyOwnerId),
    db
      .prepare("SELECT id, entity_type, masked_display, risk_classification, verification_status, source_modules_json, version, updated_at FROM gcih_entities WHERE family_owner_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 40")
      .all(params.familyOwnerId, since),
    db
      .prepare("SELECT id, first_entity_id, second_entity_id, relationship_type, status, confidence, updated_at FROM gcih_relationships WHERE family_owner_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 30")
      .all(params.familyOwnerId, since),
    db
      .prepare("SELECT id, source_module, event_type, sync_status, summary, event_timestamp FROM gcih_domain_events WHERE family_owner_id = ? AND event_timestamp >= ? ORDER BY event_timestamp DESC LIMIT 30")
      .all(params.familyOwnerId, since),
  ]);

  return {
    familyOwnerId: params.familyOwnerId,
    serverTimestamp: Date.now(),
    devices,
    entities,
    relationships,
    domainEvents,
  };
}

export async function deleteGcihDataForOwner(familyOwnerId: string): Promise<void> {
  await db.prepare("DELETE FROM gcih_domain_events WHERE family_owner_id = ?").run(familyOwnerId);
  await db.prepare("DELETE FROM gcih_relationships WHERE family_owner_id = ?").run(familyOwnerId);
  await db.prepare("DELETE FROM gcih_entities WHERE family_owner_id = ?").run(familyOwnerId);
  await db.prepare("DELETE FROM gcih_devices WHERE family_owner_id = ?").run(familyOwnerId);
}
