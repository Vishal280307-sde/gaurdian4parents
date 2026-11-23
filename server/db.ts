import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export class DbNotConfiguredError extends Error {
  statusCode = 503;
  code = "DB_NOT_CONFIGURED";
  constructor(message = "Database is not configured.") {
    super(message);
    this.name = "DbNotConfiguredError";
  }
}

let sqliteInstance: DatabaseSync | null = null;

function resolveDbPath(): string {
  if (process.env.VERCEL) {
    const tmpDir = path.resolve("/tmp");
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        return ":memory:";
      }
    }
    return path.join(tmpDir, "guardian.db");
  }

  const configured = (process.env.GUARDIAN_DB_PATH || "./data/guardian.db").trim();
  if (configured === ":memory:") return ":memory:";

  try {
    const resolved = path.resolve(process.cwd(), configured);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return resolved;
  } catch {
    // If working directory is read-only, fallback to /tmp
    const tmpDir = path.resolve("/tmp");
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, path.basename(configured) || "guardian.db");
    } catch {
      return ":memory:";
    }
  }
}

function getSqlite(): DatabaseSync {
  if (!sqliteInstance) {
    const dbPath = resolveDbPath();
    sqliteInstance = new DatabaseSync(dbPath);
    sqliteInstance.exec("PRAGMA journal_mode = WAL;");
    sqliteInstance.exec("PRAGMA foreign_keys = ON;");
    sqliteInstance.exec("PRAGMA busy_timeout = 5000;");
  }
  return sqliteInstance;
}

export function getDbMode(): string {
  return "sqlite-node";
}

export const db = {
  prepare(sql: string) {
    return {
      async get(...params: unknown[]): Promise<unknown> {
        const stmt = getSqlite().prepare(sql);
        return stmt.get(...(params as SQLInputValue[]));
      },
      async all(...params: unknown[]): Promise<unknown[]> {
        const stmt = getSqlite().prepare(sql);
        return stmt.all(...(params as SQLInputValue[]));
      },
      async run(...params: unknown[]): Promise<{ changes: number | bigint; lastInsertRowid: number | bigint }> {
        const stmt = getSqlite().prepare(sql);
        return stmt.run(...(params as SQLInputValue[]));
      },
    };
  },
  async exec(sql: string): Promise<void> {
    getSqlite().exec(sql);
  },
};

export async function initDb(): Promise<void> {
  const s = getSqlite();
  s.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent', 'guardian')),
      gender TEXT CHECK(gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
      profile_picture TEXT,
      password_hash TEXT NOT NULL,
      recovery_code_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS consents (
      user_id TEXT PRIMARY KEY,
      text_analysis INTEGER NOT NULL DEFAULT 1,
      guardian_alerts INTEGER NOT NULL DEFAULT 1,
      guardian_approve INTEGER NOT NULL DEFAULT 1,
      call_timing INTEGER NOT NULL DEFAULT 1,
      paused INTEGER NOT NULL DEFAULT 0,
      payment_limit INTEGER NOT NULL DEFAULT 10000,
      med_threshold INTEGER NOT NULL DEFAULT 25,
      high_threshold INTEGER NOT NULL DEFAULT 50,
      retention_days INTEGER NOT NULL DEFAULT 30,
      load_moderate_max INTEGER NOT NULL DEFAULT 2000,
      load_high_max INTEGER NOT NULL DEFAULT 10000,
      load_very_high_min INTEGER NOT NULL DEFAULT 25000,
      red_alert_cooldown_sec INTEGER NOT NULL DEFAULT 600,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guardian_links (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      guardian_id TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'revoked')),
      is_secondary INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      verified_at INTEGER,
      revoked_at INTEGER,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS safe_words (
      user_id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scam_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      cat TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      ai_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scam_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      masked_excerpt TEXT NOT NULL,
      cat TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unverified',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      beneficiary TEXT NOT NULL,
      known_declared INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      assessment_id TEXT,
      amount REAL NOT NULL,
      beneficiary TEXT NOT NULL,
      level TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      decided_by TEXT,
      decided_at INTEGER,
      verified_callback INTEGER NOT NULL DEFAULT 0,
      verification_note TEXT,
      escalated_to_secondary INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      known INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qr_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payee TEXT,
      amount REAL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qr_scan_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      qr_format TEXT NOT NULL,
      qr_classification TEXT NOT NULL,
      upi_id TEXT,
      payee_name TEXT,
      amount REAL,
      amount_state TEXT NOT NULL,
      security_risk_level TEXT NOT NULL,
      payment_load_category TEXT NOT NULL,
      payment_load_risk_level TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qr_notification_prefs (
      user_id TEXT PRIMARY KEY,
      qr_scan_notify INTEGER NOT NULL DEFAULT 1,
      high_risk_qr_alert INTEGER NOT NULL DEFAULT 1,
      critical_risk_qr_alert INTEGER NOT NULL DEFAULT 1,
      high_amount_alert INTEGER NOT NULL DEFAULT 1,
      very_high_load_alert INTEGER NOT NULL DEFAULT 1,
      repeated_qr_alert INTEGER NOT NULL DEFAULT 1,
      merchant_warning_alert INTEGER NOT NULL DEFAULT 1,
      suspicious_qr_alert INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_watcher_settings (
      user_id TEXT PRIMARY KEY,
      consent_status TEXT NOT NULL DEFAULT 'pending',
      notify_unknown_calls INTEGER NOT NULL DEFAULT 1,
      permission_call_state TEXT NOT NULL DEFAULT 'browser_mode',
      permission_sms_state TEXT NOT NULL DEFAULT 'browser_mode',
      permission_notif_state TEXT NOT NULL DEFAULT 'granted',
      permission_call_log_state TEXT NOT NULL DEFAULT 'not_applicable',
      call_screening_role_state TEXT NOT NULL DEFAULT 'browser_mode',
      battery_restricted INTEGER NOT NULL DEFAULT 0,
      app_lifecycle_state TEXT NOT NULL DEFAULT 'active',
      boot_restore_pending INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_watcher_calls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      external_event_id TEXT,
      caller_hash TEXT,
      caller_masked TEXT NOT NULL,
      caller_classification TEXT NOT NULL,
      call_status TEXT NOT NULL,
      call_lifecycle_phase TEXT NOT NULL DEFAULT 'ended',
      incoming_at INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      duration_ms INTEGER,
      screening_verdict TEXT NOT NULL DEFAULT 'allow_normal',
      screening_latency_ms INTEGER,
      sim_info TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_message_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dedup_hash TEXT NOT NULL,
      sender_label TEXT NOT NULL,
      message_ts INTEGER NOT NULL,
      amount REAL,
      currency TEXT NOT NULL DEFAULT 'INR',
      tx_type TEXT NOT NULL DEFAULT 'debit_intent',
      account_masked TEXT,
      merchant_or_recipient TEXT,
      payment_status TEXT NOT NULL DEFAULT 'initiated',
      redacted_summary TEXT NOT NULL,
      risk_score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'LOW',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_payment_correlations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      call_id TEXT NOT NULL,
      payment_event_id TEXT,
      time_diff_ms INTEGER NOT NULL DEFAULT 0,
      during_call INTEGER NOT NULL DEFAULT 0,
      call_risk_level TEXT NOT NULL DEFAULT 'LOW',
      payment_risk_level TEXT NOT NULL DEFAULT 'LOW',
      combined_risk_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      summary TEXT NOT NULL,
      guidance TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS safety_questionnaire_responses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      asked_to_do TEXT,
      urgency_pressure INTEGER NOT NULL DEFAULT 0,
      asked_sensitive_creds INTEGER NOT NULL DEFAULT 0,
      emotional_feeling TEXT,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gsi_events (
      event_id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source_module TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      severity TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      event_timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gsi_incidents (
      incident_id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      incident_category TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      severity TEXT NOT NULL,
      alert_level TEXT NOT NULL,
      confidence REAL NOT NULL,
      detection_source TEXT NOT NULL,
      reasoning_summary TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      acknowledgement_status TEXT NOT NULL DEFAULT 'unacknowledged',
      resolution_status TEXT NOT NULL DEFAULT 'open',
      workflow_status TEXT NOT NULL DEFAULT 'New',
      dedup_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gsi_threat_intel (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      indicator_type TEXT NOT NULL,
      indicator_hash TEXT NOT NULL,
      indicator_display TEXT NOT NULL,
      reputation_label TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      report_count INTEGER NOT NULL DEFAULT 0,
      false_positive_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gsi_reports (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      period_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gcih_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      family_owner_id TEXT NOT NULL,
      device_label TEXT NOT NULL,
      platform TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      permissions_json TEXT NOT NULL,
      last_seen_at INTEGER NOT NULL,
      last_sync_cursor INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gcih_entities (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      normalized_key TEXT NOT NULL,
      masked_display TEXT NOT NULL,
      risk_classification TEXT NOT NULL DEFAULT 'Neutral',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      source_modules_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gcih_relationships (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      first_entity_id TEXT NOT NULL,
      second_entity_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL NOT NULL DEFAULT 0.7,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gcih_domain_events (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      source_module TEXT NOT NULL,
      event_type TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'Successfully synchronised',
      summary TEXT NOT NULL,
      event_timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parents_ai_items (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      tool_key TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      due_at INTEGER,
      metadata_json TEXT NOT NULL,
      shared_with_guardian INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parents_ai_aa_connections (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      aa_handle TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'demo_sample',
      scopes_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      consent_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parents_ai_budgets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      savings_goal_name TEXT,
      savings_target REAL NOT NULL DEFAULT 0,
      savings_current REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parents_ai_access_controls (
      owner_id TEXT PRIMARY KEY,
      child_financial_access INTEGER NOT NULL DEFAULT 0,
      guardian_financial_access INTEGER NOT NULL DEFAULT 1,
      require_guardian_auth INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS epp_bank_directory (
      id TEXT PRIMARY KEY,
      bank_name TEXT NOT NULL,
      short_code TEXT UNIQUE NOT NULL,
      support_phone TEXT NOT NULL,
      fraud_phone TEXT,
      official_website TEXT,
      source_url TEXT,
      last_verified_date TEXT,
      upi_block_url TEXT,
      debit_block_url TEXT,
      credit_block_url TEXT,
      netbanking_url TEXT,
      fraud_report_url TEXT,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      notes TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_bank_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      account_nickname TEXT,
      last_four_digits TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_id) REFERENCES epp_bank_directory(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS epp_lock_sessions (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      activated_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      duration_option TEXT NOT NULL,
      selected_packages_json TEXT NOT NULL,
      os_enforcement_mode TEXT NOT NULL,
      device_platform TEXT NOT NULL,
      device_capability_note TEXT,
      activated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      unlocked_at INTEGER,
      unlocked_by TEXT
    );

    CREATE TABLE IF NOT EXISTS epp_bank_action_logs (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      launch_type TEXT NOT NULL,
      bank_confirmed_by_user INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS epp_audit_trail (
      id TEXT PRIMARY KEY,
      family_owner_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'delivered',
      read_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      identifier_type TEXT NOT NULL,
      masked_identifier TEXT NOT NULL,
      score INTEGER NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW', 'MODERATE', 'HIGH')),
      verification_status TEXT NOT NULL,
      main_reason TEXT NOT NULL,
      assessment_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const bankCols = s.prepare("PRAGMA table_info(epp_bank_directory)").all() as { name: string }[];
  const existingBankColNames = new Set(bankCols.map((c) => c.name));
  const additions: [string, string][] = [
    ["fraud_phone", "TEXT"],
    ["official_website", "TEXT"],
    ["source_url", "TEXT"],
    ["last_verified_date", "TEXT"],
  ];
  for (const [col, colType] of additions) {
    if (!existingBankColNames.has(col)) {
      s.exec(`ALTER TABLE epp_bank_directory ADD COLUMN ${col} ${colType};`);
    }
  }

  const userCols = s.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const existingUserColNames = new Set(userCols.map((c) => c.name));
  if (!existingUserColNames.has("gender")) {
    s.exec("ALTER TABLE users ADD COLUMN gender TEXT;");
  }
  if (!existingUserColNames.has("profile_picture")) {
    s.exec("ALTER TABLE users ADD COLUMN profile_picture TEXT;");
  }
}
