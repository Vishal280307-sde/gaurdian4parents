import { db } from "./db.ts";
import { generateParentsAiGuidance } from "./ai.ts";
import { generateId, getActiveLinkedParentIds } from "./security.ts";
import type { AuthUser } from "./security.ts";

const CREDENTIAL_PATTERNS = [
  /\b(atm\s*pin|upi\s*pin|mpin|cvv|card\s*number|netbanking\s*password|internet\s*banking\s*password|otp)\b/i,
  /\b\d{12,19}\b/,
];

const ACTUAL_CREDENTIAL_VALUE_PATTERNS = [
  /\b\d{12,19}\b/,
  /\b(atm\s*pin|upi\s*pin|mpin|cvv|otp)\s*(is|=|:)?\s*\d{3,8}\b/i,
  /\b\d{3,8}\s*(is\s+my\s+)?(atm\s*pin|upi\s*pin|mpin|cvv|otp)\b/i,
  /\b(netbanking\s*password|internet\s*banking\s*password|bank\s*password)\s*(is|=|:)\s*\S{4,}/i,
];

export function assertNoBankingCredentials(payload: unknown): void {
  const serialized = JSON.stringify(payload || {});
  for (const pat of CREDENTIAL_PATTERNS) {
    if (pat.test(serialized)) {
      throw new Error(
        "Parents AI never accepts bank passwords, card numbers, CVV, PINs, or OTPs. Only read-only insights and budgets are stored."
      );
    }
  }
}

export function assertNoCredentialValues(text: string): void {
  const clean = String(text || "");
  for (const pat of ACTUAL_CREDENTIAL_VALUE_PATTERNS) {
    if (pat.test(clean)) {
      throw new Error(
        "Guardian AI never accepts actual bank passwords, card numbers, CVV, PIN digits, or OTP codes."
      );
    }
  }
}

async function resolveOwnerId(actor: AuthUser, requestedOwnerId?: string): Promise<string> {
  if (actor.role === "parent") return actor.id;
  const linked = await getActiveLinkedParentIds(actor.id);
  if (requestedOwnerId) {
    if (!linked.includes(requestedOwnerId)) throw new Error("Not linked to this family account.");
    return requestedOwnerId;
  }
  if (!linked.length) throw new Error("Link with a parent account first to view shared Parents AI tools.");
  return linked[0];
}

export async function getParentsAiState(actor: AuthUser, requestedOwnerId?: string) {
  const ownerId = await resolveOwnerId(actor, requestedOwnerId);
  const [items, aaConnections, budgets, accessRow] = await Promise.all([
    db
      .prepare("SELECT * FROM parents_ai_items WHERE owner_id = ? ORDER BY created_at DESC LIMIT 40")
      .all(ownerId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT * FROM parents_ai_aa_connections WHERE owner_id = ? ORDER BY created_at DESC")
      .all(ownerId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT * FROM parents_ai_budgets WHERE owner_id = ? ORDER BY updated_at DESC")
      .all(ownerId) as Promise<Record<string, unknown>[]>,
    db
      .prepare("SELECT * FROM parents_ai_access_controls WHERE owner_id = ?")
      .get(ownerId) as Promise<Record<string, unknown> | undefined>,
  ]);

  const accessControl = accessRow
    ? {
        childFinancialAccess: Boolean(accessRow.child_financial_access),
        guardianFinancialAccess: Boolean(accessRow.guardian_financial_access),
        requireGuardianAuth: Boolean(accessRow.require_guardian_auth),
      }
    : {
        childFinancialAccess: false,
        guardianFinancialAccess: true,
        requireGuardianAuth: true,
      };

  const hasActiveAa = aaConnections.some((c) => String(c.status) === "active");
  const sampleSpendSummary = hasActiveAa
    ? [
        { category: "Groceries & Household", spent: 14200, trend: "steady" },
        { category: "Healthcare & Pharmacy", spent: 6850, trend: "up_8pct" },
        { category: "Utilities & Telecom", spent: 4100, trend: "steady" },
        { category: "Family & Grandchildren", spent: 5500, trend: "steady" },
      ]
    : [];

  return {
    ownerId,
    items: items.map((it) => ({
      ...it,
      metadata: JSON.parse(String(it.metadata_json || "{}")),
      sharedWithGuardian: Boolean(it.shared_with_guardian),
    })),
    aaConnections: aaConnections.map((c) => ({
      ...c,
      scopes: JSON.parse(String(c.scopes_json || "[]")),
    })),
    budgets,
    accessControl,
    sampleSpendSummary,
  };
}

export async function askParentsAiTool(params: {
  actor: AuthUser;
  toolKey: string;
  prompt: string;
  requestedOwnerId?: string;
  lang?: string;
  provider?: "gemini" | "guardian";
}) {
  const prompt = String(params.prompt || "").trim();
  if (!prompt) throw new Error("Enter a question or planning prompt.");
  const ownerId = await resolveOwnerId(params.actor, params.requestedOwnerId);
  const budgets = (await db
    .prepare("SELECT category, monthly_limit FROM parents_ai_budgets WHERE owner_id = ?")
    .all(ownerId)) as { category: string; monthly_limit: number }[];

  const contextSummary = budgets.length
    ? `Active household budget categories: ${budgets.map((b) => `${b.category} (₹${b.monthly_limit}/mo)`).join(", ")}`
    : "No custom budgets configured yet.";

  const selectedProvider = params.provider === "guardian" ? "guardian" : "gemini";
  try {
    const answer = await generateParentsAiGuidance({
      toolKey: params.toolKey,
      prompt,
      contextSummary,
      lang: params.lang || "en",
      provider: selectedProvider,
    });
    return { toolKey: params.toolKey, answer, source: selectedProvider };
  } catch (err) {
    // Propagate explicit Gemini configuration/API error if unavailable or key unset
    throw new Error(err instanceof Error ? err.message : "Parents AI service unavailable.");
  }
}

export async function createToolItem(params: {
  actor: AuthUser;
  requestedOwnerId?: string;
  toolKey: string;
  title: string;
  category?: string;
  status?: string;
  dueAt?: number | null;
  metadata?: Record<string, unknown>;
  sharedWithGuardian?: boolean;
}) {
  const ownerId = await resolveOwnerId(params.actor, params.requestedOwnerId);
  const title = String(params.title || "").trim().slice(0, 140);
  if (!title) throw new Error("Item title is required.");
  const id = generateId("pai");
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO parents_ai_items (id, owner_id, tool_key, title, category, status, due_at, metadata_json, shared_with_guardian, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      ownerId,
      String(params.toolKey || "routine").slice(0, 40),
      title,
      String(params.category || "general").slice(0, 40),
      String(params.status || "active").slice(0, 30),
      params.dueAt ? Number(params.dueAt) : null,
      JSON.stringify(params.metadata || {}),
      params.sharedWithGuardian === false ? 0 : 1,
      now,
      now
    );
  return { id };
}

export async function updateToolItem(params: {
  actor: AuthUser;
  itemId: string;
  status?: string;
  title?: string;
  dueAt?: number | null;
}) {
  const item = (await db.prepare("SELECT * FROM parents_ai_items WHERE id = ?").get(params.itemId)) as
    | { id: string; owner_id: string; status: string; title: string; due_at: number | null }
    | undefined;
  if (!item) throw new Error("Item not found.");
  if (params.actor.role === "parent" && item.owner_id !== params.actor.id) {
    throw new Error("Unauthorized item access.");
  }
  if (params.actor.role === "guardian") {
    const linked = await getActiveLinkedParentIds(params.actor.id);
    if (!linked.includes(item.owner_id)) throw new Error("Unauthorized item access.");
  }
  await db
    .prepare("UPDATE parents_ai_items SET status = ?, title = ?, due_at = ?, updated_at = ? WHERE id = ?")
    .run(
      params.status ? String(params.status).slice(0, 30) : item.status,
      params.title ? String(params.title).trim().slice(0, 140) : item.title,
      params.dueAt !== undefined ? params.dueAt : item.due_at,
      Date.now(),
      item.id
    );
  return { ok: true };
}

export async function deleteToolItem(actor: AuthUser, itemId: string) {
  const item = (await db.prepare("SELECT owner_id FROM parents_ai_items WHERE id = ?").get(itemId)) as
    | { owner_id: string }
    | undefined;
  if (!item) throw new Error("Item not found.");
  if (actor.role === "parent" && item.owner_id !== actor.id) {
    throw new Error("Unauthorized item deletion.");
  }
  if (actor.role === "guardian") {
    const linked = await getActiveLinkedParentIds(actor.id);
    if (!linked.includes(item.owner_id)) throw new Error("Unauthorized item deletion.");
  }
  await db.prepare("DELETE FROM parents_ai_items WHERE id = ?").run(itemId);
  return { ok: true };
}

export async function connectSampleAaBank(params: {
  actor: AuthUser;
  requestedOwnerId?: string;
  institutionName?: string;
  aaHandle?: string;
  mode?: string;
  scopes?: string[];
  consentDays?: number;
}) {
  const ownerId = await resolveOwnerId(params.actor, params.requestedOwnerId);
  const id = generateId("aa");
  const now = Date.now();
  const days = Math.max(7, Math.min(365, Number(params.consentDays || 90)));
  const scopes = params.scopes?.length ? params.scopes.slice(0, 6) : ["balances_read", "category_summary_read"];
  await db
    .prepare(
      `INSERT INTO parents_ai_aa_connections (id, owner_id, institution_name, aa_handle, mode, scopes_json, status, consent_expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(
      id,
      ownerId,
      String(params.institutionName || "Demo RBI AA Sample Bank").slice(0, 80),
      String(params.aaHandle || "family@anumati.demo").slice(0, 80),
      String(params.mode || "demo_sample").slice(0, 30),
      JSON.stringify(scopes),
      now + days * 86_400_000,
      now
    );
  return { id, status: "active", mode: "demo_sample", readOnly: true };
}

export async function revokeBankConnection(actor: AuthUser, connectionId: string) {
  const row = (await db.prepare("SELECT owner_id FROM parents_ai_aa_connections WHERE id = ?").get(connectionId)) as
    | { owner_id: string }
    | undefined;
  if (!row) throw new Error("Bank connection not found.");
  if (actor.role === "parent" && row.owner_id !== actor.id) throw new Error("Unauthorized.");
  await db.prepare("UPDATE parents_ai_aa_connections SET status = 'revoked' WHERE id = ?").run(connectionId);
  return { ok: true };
}

export async function updateFinancialAccessControl(params: {
  actor: AuthUser;
  childFinancialAccess?: boolean;
  guardianFinancialAccess?: boolean;
  requireGuardianAuth?: boolean;
}) {
  if (params.actor.role !== "parent") {
    throw new Error("Only the parent account holder can change financial visibility controls.");
  }
  const existing = (await db
    .prepare("SELECT * FROM parents_ai_access_controls WHERE owner_id = ?")
    .get(params.actor.id)) as Record<string, number> | undefined;

  const child = params.childFinancialAccess ?? Boolean(existing?.child_financial_access ?? 0);
  const guardian = params.guardianFinancialAccess ?? Boolean(existing?.guardian_financial_access ?? 1);
  const reqAuth = params.requireGuardianAuth ?? Boolean(existing?.require_guardian_auth ?? 1);

  await db
    .prepare(
      `INSERT INTO parents_ai_access_controls (owner_id, child_financial_access, guardian_financial_access, require_guardian_auth, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_id) DO UPDATE SET child_financial_access = excluded.child_financial_access, guardian_financial_access = excluded.guardian_financial_access, require_guardian_auth = excluded.require_guardian_auth, updated_at = excluded.updated_at`
    )
    .run(params.actor.id, child ? 1 : 0, guardian ? 1 : 0, reqAuth ? 1 : 0, Date.now());

  return {
    childFinancialAccess: child,
    guardianFinancialAccess: guardian,
    requireGuardianAuth: reqAuth,
  };
}

export async function upsertFamilyBudget(params: {
  actor: AuthUser;
  requestedOwnerId?: string;
  category: string;
  monthlyLimit: number;
  savingsGoalName?: string;
  savingsTarget?: number;
  savingsCurrent?: number;
}) {
  const ownerId = await resolveOwnerId(params.actor, params.requestedOwnerId);
  const category = String(params.category || "").trim().slice(0, 60);
  if (!category || !Number.isFinite(params.monthlyLimit) || params.monthlyLimit <= 0) {
    throw new Error("Category name and positive monthly limit are required.");
  }
  const id = generateId("bud");
  await db
    .prepare(
      `INSERT INTO parents_ai_budgets (id, owner_id, category, monthly_limit, savings_goal_name, savings_target, savings_current, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      ownerId,
      category,
      Math.round(params.monthlyLimit),
      params.savingsGoalName ? String(params.savingsGoalName).slice(0, 80) : null,
      Math.max(0, Math.round(Number(params.savingsTarget || 0))),
      Math.max(0, Math.round(Number(params.savingsCurrent || 0))),
      Date.now()
    );
  return { ok: true, id };
}

export async function deleteFamilyBudget(actor: AuthUser, budgetId: string) {
  const row = (await db.prepare("SELECT owner_id FROM parents_ai_budgets WHERE id = ?").get(budgetId)) as
    | { owner_id: string }
    | undefined;
  if (!row) throw new Error("Budget not found.");
  if (actor.role === "parent" && row.owner_id !== actor.id) throw new Error("Unauthorized.");
  await db.prepare("DELETE FROM parents_ai_budgets WHERE id = ?").run(budgetId);
  return { ok: true };
}

export async function deleteParentsAiDataForOwner(ownerId: string): Promise<void> {
  await db.prepare("DELETE FROM parents_ai_items WHERE owner_id = ?").run(ownerId);
  await db.prepare("DELETE FROM parents_ai_aa_connections WHERE owner_id = ?").run(ownerId);
  await db.prepare("DELETE FROM parents_ai_budgets WHERE owner_id = ?").run(ownerId);
  await db.prepare("DELETE FROM parents_ai_access_controls WHERE owner_id = ?").run(ownerId);
}
