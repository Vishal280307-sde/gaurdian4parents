import crypto from "node:crypto";
import type express from "express";
import { db } from "./db.ts";

export type UserGender = "male" | "female" | "other" | "prefer_not_to_say";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: "parent" | "guardian";
  gender?: UserGender | null;
  profilePicture?: string | null;
}

export function validateGender(raw: unknown): UserGender | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const normalized = String(raw).trim().toLowerCase();
  if (
    normalized === "male" ||
    normalized === "female" ||
    normalized === "other" ||
    normalized === "prefer_not_to_say"
  ) {
    return normalized;
  }
  throw new Error("Invalid gender selection.");
}

export function validateProfilePictureDataUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") {
    throw new Error("Profile picture must be a valid image.");
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(trimmed);
  if (!match) {
    throw new Error("Unsupported profile image format. Please use JPEG, PNG, or WebP.");
  }
  const mime = match[1].toLowerCase();
  const b64 = match[2];
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0 || buf.length > 512 * 1024) {
    throw new Error("Profile image must be under 512 KB.");
  }
  // Verify actual magic bytes to prevent spoofed MIME headers
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isWebp =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP";

  if ((mime === "image/jpeg" && !isJpeg) || (mime === "image/png" && !isPng) || (mime === "image/webp" && !isWebp)) {
    throw new Error("Profile image file signature does not match its declared format.");
  }
  return `data:${mime};base64,${b64}`;
}

export interface AuthedRequest extends express.Request {
  authUser?: AuthUser;
  sessionTokenHash?: string;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(secret, salt, 64);
  const storedBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sanitizeAuditText(raw: string): string {
  return String(raw || "")
    .replace(/\b\d{4,16}\b/g, "[REDACTED_NUM]")
    .replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+/g, "[REDACTED_ID]")
    .slice(0, 180);
}

export async function writeAudit(userId: string, event: string): Promise<void> {
  const clean = sanitizeAuditText(event);
  const now = Date.now();
  const prev = (await db
    .prepare("SELECT hash FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(userId)) as { hash: string } | undefined;
  const hash = crypto
    .createHash("sha256")
    .update(`${prev?.hash || "GENESIS"}|${userId}|${clean}|${now}`)
    .digest("hex")
    .slice(0, 16);
  await db
    .prepare("INSERT INTO audit_logs (id, user_id, event, hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(generateId("aud"), userId, clean, hash, now);
}

export async function createSession(req: express.Request, res: express.Response, user: AuthUser): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  await db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, user.id, expiresAt, now);

  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (isHttps) {
    res.cookie("guardian_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  return token;
}

export async function clearSession(req: AuthedRequest, res: express.Response): Promise<void> {
  if (req.sessionTokenHash) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.sessionTokenHash);
  }
  res.clearCookie("guardian_session");
}

function parseBearerOrCookie(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "guardian_session") {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export async function attachAuth(req: AuthedRequest, _res: express.Response, next: express.NextFunction): Promise<void> {
  const rawToken = parseBearerOrCookie(req);
  if (!rawToken) {
    next();
    return;
  }
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const row = (await db
    .prepare(
      `SELECT s.token_hash, s.expires_at, u.id, u.username, u.name, u.role, u.gender, u.profile_picture
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash)) as
    | {
        token_hash: string;
        expires_at: number;
        id: string;
        username: string;
        name: string;
        role: "parent" | "guardian";
        gender: UserGender | null;
        profile_picture: string | null;
      }
    | undefined;

  if (!row || row.expires_at < now) {
    if (row) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    next();
    return;
  }

  req.sessionTokenHash = row.token_hash;
  req.authUser = {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    gender: row.gender || null,
    profilePicture: row.profile_picture || null,
  };
  next();
}

export function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

export function requireRole(role: "parent" | "guardian") {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (req.authUser.role !== role) {
      res.status(403).json({ error: `This action requires a ${role} account.` });
      return;
    }
    next();
  };
}

export async function ensureDefaultConsent(userId: string): Promise<void> {
  const existing = await db.prepare("SELECT user_id FROM consents WHERE user_id = ?").get(userId);
  if (!existing) {
    await db
      .prepare(
        `INSERT INTO consents (user_id, text_analysis, guardian_alerts, guardian_approve, call_timing, paused, payment_limit, med_threshold, high_threshold, retention_days, load_moderate_max, load_high_max, load_very_high_min, red_alert_cooldown_sec, updated_at)
         VALUES (?, 1, 1, 1, 1, 0, 10000, 25, 50, 30, 2000, 10000, 25000, 600, ?)`
      )
      .run(userId, Date.now());
  }
}

export async function ensureDefaultQrNotificationPrefs(userId: string) {
  let row = (await db.prepare("SELECT * FROM qr_notification_prefs WHERE user_id = ?").get(userId)) as
    | Record<string, number>
    | undefined;
  if (!row) {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO qr_notification_prefs (user_id, qr_scan_notify, high_risk_qr_alert, critical_risk_qr_alert, high_amount_alert, very_high_load_alert, repeated_qr_alert, merchant_warning_alert, suspicious_qr_alert, updated_at)
         VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, ?)`
      )
      .run(userId, now);
    row = (await db.prepare("SELECT * FROM qr_notification_prefs WHERE user_id = ?").get(userId)) as Record<string, number>;
  }
  return {
    qrScanNotify: Boolean(row.qr_scan_notify),
    highRiskQrAlert: Boolean(row.high_risk_qr_alert),
    criticalRiskQrAlert: Boolean(row.critical_risk_qr_alert),
    highAmountAlert: Boolean(row.high_amount_alert),
    veryHighLoadAlert: Boolean(row.very_high_load_alert),
    repeatedQrAlert: Boolean(row.repeated_qr_alert),
    merchantWarningAlert: Boolean(row.merchant_warning_alert),
    suspiciousQrAlert: Boolean(row.suspicious_qr_alert),
  };
}

export async function createNotification(
  recipientId: string,
  parentId: string,
  kind: string,
  title: string,
  body: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notifications (id, recipient_id, parent_id, kind, title, body, delivery_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?)`
    )
    .run(generateId("ntf"), recipientId, parentId, kind, title.slice(0, 120), body.slice(0, 400), Date.now());
}

export async function getActiveGuardiansForParent(parentId: string): Promise<{ guardian_id: string; is_secondary: number }[]> {
  return (await db
    .prepare("SELECT guardian_id, is_secondary FROM guardian_links WHERE parent_id = ? AND status = 'active' AND guardian_id IS NOT NULL")
    .all(parentId)) as { guardian_id: string; is_secondary: number }[];
}

export async function getActiveLinkedParentIds(guardianId: string): Promise<string[]> {
  const rows = (await db
    .prepare("SELECT parent_id FROM guardian_links WHERE guardian_id = ? AND status = 'active'")
    .all(guardianId)) as { parent_id: string }[];
  return rows.map((r) => r.parent_id);
}

export async function seedInitialDemoUsersIfEmpty(): Promise<void> {
  const shouldSeed =
    process.env.ENABLE_DEMO_ACCOUNTS === "true" ||
    process.env.NODE_ENV !== "production";
  if (!shouldSeed) {
    return;
  }

  const existingParent = (await db
    .prepare("SELECT id FROM users WHERE username = 'ramesh_parent'")
    .get()) as { id: string } | undefined;

  let parentId = existingParent?.id;
  const now = Date.now();

  if (!existingParent) {
    parentId = generateId("usr");
    const recCode = "GRD-PARENT-DEMO";
    await db
      .prepare(
        `INSERT INTO users (id, username, name, role, gender, password_hash, recovery_code_hash, created_at)
         VALUES (?, 'ramesh_parent', 'Ramesh Kulkarni', 'parent', 'male', ?, ?, ?)`
      )
      .run(parentId, hashSecret("GuardianPreview!2026"), hashSecret(recCode), now);
    await ensureDefaultConsent(parentId);
    await ensureDefaultQrNotificationPrefs(parentId);
  }

  const existingGuardian = (await db
    .prepare("SELECT id FROM users WHERE username = 'ananya_guardian'")
    .get()) as { id: string } | undefined;

  let guardianId = existingGuardian?.id;

  if (!existingGuardian) {
    guardianId = generateId("usr");
    const recCode = "GRD-GUARD-DEMO";
    await db
      .prepare(
        `INSERT INTO users (id, username, name, role, gender, password_hash, recovery_code_hash, created_at)
         VALUES (?, 'ananya_guardian', 'Ananya Kulkarni', 'guardian', 'female', ?, ?, ?)`
      )
      .run(guardianId, hashSecret("GuardianPreview!2026"), hashSecret(recCode), now);
  }

  if (parentId && guardianId) {
    const existingLink = await db
      .prepare(
        "SELECT id FROM guardian_links WHERE parent_id = ? AND guardian_id = ? AND status = 'active'"
      )
      .get(parentId, guardianId);
    if (!existingLink) {
      await db
        .prepare(
          `INSERT INTO guardian_links (id, parent_id, guardian_id, invite_code, status, is_secondary, created_at, verified_at)
           VALUES (?, ?, ?, ?, 'active', 0, ?, ?)`
        )
        .run(generateId("lnk"), parentId, guardianId, "DEMO-INVITE-2026", now, now);
    }
  }
}
