import { db } from "./db.ts";
import { generateId, getActiveLinkedParentIds, writeAudit, type AuthUser } from "./security.ts";
import { resolveEmergencyCallTarget, type EmergencyCallResolution } from "./bankDirectory.ts";

export interface JoinedUserBankRow {
  id: string;
  userId: string;
  bankId: string;
  bankName: string;
  shortCode: string;
  supportPhone: string;
  fraudPhone: string | null;
  officialWebsite: string | null;
  sourceUrl: string | null;
  lastVerifiedDate: string | null;
  upiBlockUrl: string | null;
  debitBlockUrl: string | null;
  creditBlockUrl: string | null;
  netbankingUrl: string | null;
  fraudReportUrl: string | null;
  verificationStatus: string;
  notes: string | null;
  accountNickname: string | null;
  lastFourDigits: string | null;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
  callResolution: EmergencyCallResolution;
}

function mapJoinedBankRow(row: Record<string, unknown>): JoinedUserBankRow {
  const bankShape = {
    bank_name: String(row.bank_name || ""),
    short_code: String(row.short_code || ""),
    support_phone: row.support_phone ? String(row.support_phone) : null,
    fraud_phone: row.fraud_phone ? String(row.fraud_phone) : null,
    official_website: row.official_website ? String(row.official_website) : null,
    source_url: row.source_url ? String(row.source_url) : null,
    last_verified_date: row.last_verified_date ? String(row.last_verified_date) : null,
  };
  return {
    id: String(row.id),
    userId: String(row.user_id),
    bankId: String(row.bank_id),
    bankName: bankShape.bank_name,
    shortCode: bankShape.short_code,
    supportPhone: bankShape.support_phone || "",
    fraudPhone: bankShape.fraud_phone,
    officialWebsite: bankShape.official_website,
    sourceUrl: bankShape.source_url,
    lastVerifiedDate: bankShape.last_verified_date,
    upiBlockUrl: row.upi_block_url ? String(row.upi_block_url) : null,
    debitBlockUrl: row.debit_block_url ? String(row.debit_block_url) : null,
    creditBlockUrl: row.credit_block_url ? String(row.credit_block_url) : null,
    netbankingUrl: row.netbanking_url ? String(row.netbanking_url) : null,
    fraudReportUrl: row.fraud_report_url ? String(row.fraud_report_url) : null,
    verificationStatus: String(row.verification_status || "verified"),
    notes: row.notes ? String(row.notes) : null,
    accountNickname: row.account_nickname ? String(row.account_nickname) : null,
    lastFourDigits: row.last_four_digits ? String(row.last_four_digits) : null,
    isPrimary: Boolean(row.is_primary),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    callResolution: resolveEmergencyCallTarget(bankShape),
  };
}

export async function getUserBanks(userId: string): Promise<JoinedUserBankRow[]> {
  const rows = (await db
    .prepare(
      `SELECT uba.id, uba.user_id, uba.bank_id, uba.account_nickname, uba.last_four_digits, uba.is_primary, uba.created_at, uba.updated_at,
              bd.bank_name, bd.short_code, bd.support_phone, bd.fraud_phone, bd.official_website, bd.source_url, bd.last_verified_date,
              bd.upi_block_url, bd.debit_block_url, bd.credit_block_url, bd.netbanking_url, bd.fraud_report_url, bd.verification_status, bd.notes
       FROM user_bank_accounts uba
       JOIN epp_bank_directory bd ON bd.id = uba.bank_id
       WHERE uba.user_id = ?
       ORDER BY uba.is_primary DESC, uba.created_at ASC`
    )
    .all(userId)) as Record<string, unknown>[];

  return rows.map(mapJoinedBankRow);
}

export async function getLinkedParentsPrimaryBanks(guardianId: string) {
  const parentIds = await getActiveLinkedParentIds(guardianId);
  if (!parentIds.length) return [];

  const rows = (await db
    .prepare(
      `SELECT uba.id, uba.user_id, uba.bank_id, uba.account_nickname, uba.last_four_digits, uba.is_primary, uba.created_at, uba.updated_at,
              u.name as parent_name,
              bd.bank_name, bd.short_code, bd.support_phone, bd.fraud_phone, bd.official_website, bd.source_url, bd.last_verified_date,
              bd.upi_block_url, bd.debit_block_url, bd.credit_block_url, bd.netbanking_url, bd.fraud_report_url, bd.verification_status, bd.notes
       FROM user_bank_accounts uba
       JOIN users u ON u.id = uba.user_id
       JOIN consents c ON c.user_id = uba.user_id
       JOIN epp_bank_directory bd ON bd.id = uba.bank_id
       WHERE uba.user_id IN (${parentIds.map(() => "?").join(",")})
         AND uba.is_primary = 1
         AND c.paused = 0
         AND c.guardian_alerts = 1
       ORDER BY u.name ASC`
    )
    .all(...parentIds)) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...mapJoinedBankRow(row),
    parentName: String(row.parent_name || "Parent"),
  }));
}

export async function addUserBank(params: {
  userId: string;
  bankId: string;
  accountNickname?: string | null;
  lastFourDigits?: string | null;
  isPrimary?: boolean;
}): Promise<JoinedUserBankRow[]> {
  const bank = (await db
    .prepare("SELECT id, bank_name FROM epp_bank_directory WHERE id = ? OR short_code = ?")
    .get(params.bankId.trim(), params.bankId.trim().toUpperCase())) as { id: string; bank_name: string } | undefined;

  if (!bank) {
    throw new Error("Selected bank was not found in the verified directory.");
  }

  const nickname = params.accountNickname ? params.accountNickname.trim().slice(0, 48) : null;
  let lastFour: string | null = null;
  if (params.lastFourDigits && params.lastFourDigits.trim()) {
    const cleaned = params.lastFourDigits.trim();
    if (!/^\d{4}$/.test(cleaned)) {
      throw new Error("Last 4 digits (optional) must be exactly 4 numeric digits.");
    }
    lastFour = cleaned;
  }

  const existingBanks = await getUserBanks(params.userId);
  const shouldBePrimary = Boolean(params.isPrimary) || existingBanks.length === 0;
  const now = Date.now();

  if (shouldBePrimary) {
    await db.prepare("UPDATE user_bank_accounts SET is_primary = 0, updated_at = ? WHERE user_id = ?").run(now, params.userId);
  }

  const id = generateId("ubk");
  await db
    .prepare(
      `INSERT INTO user_bank_accounts (id, user_id, bank_id, account_nickname, last_four_digits, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, params.userId, bank.id, nickname, lastFour, shouldBePrimary ? 1 : 0, now, now);

  await writeAudit(params.userId, `Saved bank profile (${bank.bank_name}${shouldBePrimary ? " · Primary" : ""})`);
  return getUserBanks(params.userId);
}

export async function setPrimaryUserBank(userId: string, accountId: string): Promise<JoinedUserBankRow[]> {
  const existing = (await db
    .prepare(
      `SELECT uba.id, bd.bank_name
       FROM user_bank_accounts uba
       JOIN epp_bank_directory bd ON bd.id = uba.bank_id
       WHERE uba.id = ? AND uba.user_id = ?`
    )
    .get(accountId, userId)) as { id: string; bank_name: string } | undefined;

  if (!existing) {
    throw new Error("Saved bank account not found.");
  }

  const now = Date.now();
  await db.prepare("UPDATE user_bank_accounts SET is_primary = 0, updated_at = ? WHERE user_id = ?").run(now, userId);
  await db
    .prepare("UPDATE user_bank_accounts SET is_primary = 1, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(now, accountId, userId);

  await writeAudit(userId, `Changed primary emergency bank to ${existing.bank_name}`);
  return getUserBanks(userId);
}

export async function removeUserBank(userId: string, accountId: string): Promise<JoinedUserBankRow[]> {
  const existing = (await db
    .prepare(
      `SELECT uba.id, uba.is_primary, bd.bank_name
       FROM user_bank_accounts uba
       JOIN epp_bank_directory bd ON bd.id = uba.bank_id
       WHERE uba.id = ? AND uba.user_id = ?`
    )
    .get(accountId, userId)) as { id: string; is_primary: number; bank_name: string } | undefined;

  if (!existing) {
    throw new Error("Saved bank account not found.");
  }

  await db.prepare("DELETE FROM user_bank_accounts WHERE id = ? AND user_id = ?").run(accountId, userId);

  if (existing.is_primary) {
    const next = (await db
      .prepare("SELECT id FROM user_bank_accounts WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
      .get(userId)) as { id: string } | undefined;
    if (next) {
      await db
        .prepare("UPDATE user_bank_accounts SET is_primary = 1, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(Date.now(), next.id, userId);
    }
  }

  await writeAudit(userId, `Removed saved bank profile (${existing.bank_name})`);
  return getUserBanks(userId);
}

export async function recordEmergencyCallIntent(params: {
  actor: AuthUser;
  bankId?: string | null;
  reason?: string;
  launchMethod: "tel_dialer" | "copy_number" | "national_1930";
  dialNumber?: string | null;
}) {
  const ownerId = params.actor.id;
  const reasonClean = String(params.reason || "Suspected financial fraud").trim().slice(0, 100);
  let bankName = "National Cybercrime Helpline (1930)";
  let bankId = "national_1930";

  if (params.bankId && params.launchMethod !== "national_1930") {
    const bank = (await db
      .prepare("SELECT id, bank_name FROM epp_bank_directory WHERE id = ?")
      .get(params.bankId)) as { id: string; bank_name: string } | undefined;
    if (bank) {
      bankId = bank.id;
      bankName = bank.bank_name;
    }
  }

  const now = Date.now();
  const id = generateId("eba");
  await db
    .prepare(
      `INSERT INTO epp_bank_action_logs (id, family_owner_id, actor_id, bank_id, bank_name, service_type, launch_type, bank_confirmed_by_user, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(id, ownerId, params.actor.id, bankId, bankName, reasonClean.slice(0, 40), params.launchMethod, now);

  const actionSummary =
    params.launchMethod === "tel_dialer"
      ? `Confirmed phone dialer launch for ${bankName} (${reasonClean})`
      : params.launchMethod === "national_1930"
        ? `Confirmed phone dialer launch for Cybercrime Helpline 1930 (${reasonClean})`
        : `Copied verified helpline for ${bankName} (${reasonClean})`;

  await writeAudit(ownerId, actionSummary);
  return {
    ok: true,
    logId: id,
    note: "User initiated dialer or copy action; Guardian does not place or record calls automatically.",
  };
}

export async function deleteUserBanksForOwner(userId: string): Promise<void> {
  await db.prepare("DELETE FROM user_bank_accounts WHERE user_id = ?").run(userId);
}
