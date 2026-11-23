import { db } from "./db.ts";
import { generateId } from "./security.ts";
import type { SuspicionAssessment, SuspicionCategory, UnifiedRiskLevel } from "./suspicionScoring.ts";

export interface RiskHistoryRecord {
  id: string;
  userId: string;
  parentName?: string;
  category: SuspicionCategory;
  identifierType: string;
  maskedIdentifier: string;
  score: number;
  riskLevel: UnifiedRiskLevel;
  verificationStatus: string;
  mainReason: string;
  createdAt: number;
  assessment?: SuspicionAssessment;
}

export async function recordRiskHistory(params: {
  userId: string;
  identifierType: string;
  assessment: SuspicionAssessment;
}): Promise<RiskHistoryRecord> {
  const id = generateId("rsk");
  const createdAt = params.assessment.evaluatedAt || Date.now();
  const masked = String(params.assessment.maskedIdentifier || "Masked identifier").slice(0, 140);
  const mainReason = String(params.assessment.mainReason || "Safety check completed").slice(0, 240);

  await db
    .prepare(
      `INSERT INTO risk_history (id, user_id, category, identifier_type, masked_identifier, score, risk_level, verification_status, main_reason, assessment_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.assessment.category,
      String(params.identifierType || "general").slice(0, 40),
      masked,
      params.assessment.score,
      params.assessment.riskLevel,
      params.assessment.verificationStatus,
      mainReason,
      JSON.stringify(params.assessment),
      createdAt
    );

  return {
    id,
    userId: params.userId,
    category: params.assessment.category,
    identifierType: params.identifierType,
    maskedIdentifier: masked,
    score: params.assessment.score,
    riskLevel: params.assessment.riskLevel,
    verificationStatus: params.assessment.verificationStatus,
    mainReason,
    createdAt,
    assessment: params.assessment,
  };
}

function mapRow(row: Record<string, unknown>, includeFullAssessment = false): RiskHistoryRecord {
  let assessment: SuspicionAssessment | undefined;
  if (includeFullAssessment && typeof row.assessment_json === "string") {
    try {
      assessment = JSON.parse(row.assessment_json) as SuspicionAssessment;
    } catch {
      assessment = undefined;
    }
  }
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ...(row.parent_name ? { parentName: String(row.parent_name) } : {}),
    category: String(row.category) as SuspicionCategory,
    identifierType: String(row.identifier_type),
    maskedIdentifier: String(row.masked_identifier),
    score: Number(row.score),
    riskLevel: String(row.risk_level) as UnifiedRiskLevel,
    verificationStatus: String(row.verification_status),
    mainReason: String(row.main_reason),
    createdAt: Number(row.created_at),
    ...(assessment ? { assessment } : {}),
  };
}

export async function getRiskHistoryForUser(userId: string, limit = 25): Promise<RiskHistoryRecord[]> {
  const rows = (await db
    .prepare(
      `SELECT id, user_id, category, identifier_type, masked_identifier, score, risk_level, verification_status, main_reason, assessment_json, created_at
       FROM risk_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(userId, limit)) as Record<string, unknown>[];
  return rows.map((r) => mapRow(r, true));
}

export async function getLinkedParentsRiskHistory(parentIds: string[], limit = 25): Promise<RiskHistoryRecord[]> {
  if (!parentIds.length) return [];
  const rows = (await db
    .prepare(
      `SELECT r.id, r.user_id, u.name as parent_name, r.category, r.identifier_type, r.masked_identifier,
              r.score, r.risk_level, r.verification_status, r.main_reason, r.assessment_json, r.created_at
       FROM risk_history r
       JOIN users u ON u.id = r.user_id
       JOIN consents c ON c.user_id = r.user_id
       WHERE r.user_id IN (${parentIds.map(() => "?").join(",")})
         AND c.guardian_alerts = 1 AND c.paused = 0
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .all(...parentIds, limit)) as Record<string, unknown>[];
  return rows.map((r) => mapRow(r, true));
}

export async function getRiskHistoryDetail(
  actorId: string,
  actorRole: "parent" | "guardian",
  entryId: string
): Promise<RiskHistoryRecord | null> {
  const row = (await db
    .prepare(
      `SELECT r.*, u.name as parent_name
       FROM risk_history r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?
       LIMIT 1`
    )
    .get(entryId)) as Record<string, unknown> | undefined;

  if (!row) return null;
  const ownerId = String(row.user_id);

  if (actorRole === "parent") {
    if (ownerId !== actorId) {
      throw new Error("Unauthorized: you can only view your own risk history.");
    }
    return mapRow(row, true);
  }

  const linked = await db
    .prepare(
      `SELECT gl.id
       FROM guardian_links gl
       JOIN consents c ON c.user_id = gl.parent_id
       WHERE gl.parent_id = ? AND gl.guardian_id = ? AND gl.status = 'active'
         AND c.guardian_alerts = 1 AND c.paused = 0
       LIMIT 1`
    )
    .get(ownerId, actorId);

  if (!linked) {
    throw new Error("Unauthorized: guardian access is not permitted for this record.");
  }
  return mapRow(row, true);
}

export async function cleanupRiskHistoryRetention(userId: string, retentionDays: number): Promise<void> {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 86_400_000;
  await db.prepare("DELETE FROM risk_history WHERE user_id = ? AND created_at < ?").run(userId, cutoff);
}

export async function deleteRiskHistoryForOwner(userId: string): Promise<void> {
  await db.prepare("DELETE FROM risk_history WHERE user_id = ?").run(userId);
}
