import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTelUri,
  isSafeHttpsUrl,
  lookupBankInVerifiedDirectory,
  resolveEmergencyCallTarget,
  UNVERIFIED_BANK_FALLBACK_MESSAGE,
  validateBankContactRecord,
  validateDialablePhone,
  VERIFIED_INDIAN_BANKS,
} from "./bankDirectory.ts";
import { db, initDb } from "./db.ts";
import { seedDefaultBankDirectoryIfEmpty } from "./emergencyPayment.ts";
import { addUserBank, getUserBanks, removeUserBank, setPrimaryUserBank } from "./userBanks.ts";

test("1. All required Indian banks exist with official websites, sources, and verification dates", () => {
  const requiredCodes = ["SBI", "HDFC", "ICICI", "AXIS", "PNB", "BOB", "CANARA", "UNION", "KOTAK", "IDFC"];
  const codes = new Set(VERIFIED_INDIAN_BANKS.map((b) => b.shortCode));
  for (const code of requiredCodes) {
    assert.equal(codes.has(code), true, `Missing required bank: ${code}`);
  }
  assert.ok(VERIFIED_INDIAN_BANKS.length >= 12);

  for (const bank of VERIFIED_INDIAN_BANKS) {
    const check = validateBankContactRecord(bank);
    assert.equal(check.valid, true, `${bank.bankName} failed validation: ${check.errors.join(", ")}`);
    assert.equal(isSafeHttpsUrl(bank.officialWebsite), true);
    assert.equal(isSafeHttpsUrl(bank.sourceUrl), true);
    assert.match(bank.lastVerifiedDate, /^\d{4}-\d{2}-\d{2}$/);
    const resolution = resolveEmergencyCallTarget(bank);
    assert.equal(resolution.status, "ready");
    assert.equal(resolution.canDial, true);
    assert.ok(resolution.telUri?.startsWith("tel:"));
  }
});

test("2. Fraud helpline vs general customer care are clearly distinguished", () => {
  const sbi = VERIFIED_INDIAN_BANKS.find((b) => b.shortCode === "SBI");
  const bob = VERIFIED_INDIAN_BANKS.find((b) => b.shortCode === "BOB");
  assert.ok(sbi && bob);

  const sbiRes = resolveEmergencyCallTarget(sbi);
  assert.equal(sbiRes.numberType, "fraud_reporting");
  assert.equal(sbiRes.dialNumber, "1800-11-1109");
  assert.equal(sbiRes.telUri, "tel:1800111109");
  assert.equal(sbiRes.supportPhone, "1800-1234");
  assert.match(sbiRes.numberTypeLabel, /Fraud Helpline/i);

  const bobRes = resolveEmergencyCallTarget(bob);
  assert.equal(bobRes.numberType, "customer_support");
  assert.equal(bobRes.dialNumber, "1800-5700");
  assert.equal(bobRes.telUri, "tel:18005700");
  assert.match(bobRes.numberTypeLabel, /General Customer Care/i);
});

test("3. Missing bank selection returns missing_bank and disables dialing", () => {
  const resNull = resolveEmergencyCallTarget(null);
  assert.equal(resNull.status, "missing_bank");
  assert.equal(resNull.canDial, false);
  assert.equal(resNull.telUri, null);

  const resUndef = resolveEmergencyCallTarget(undefined);
  assert.equal(resUndef.status, "missing_bank");
  assert.equal(resUndef.canDial, false);
});

test("4. Unavailable bank numbers return unavailable and never fabricate numbers", () => {
  const res = resolveEmergencyCallTarget({
    bankName: "Test Rural Bank",
    shortCode: "TRB",
    supportPhone: "",
    fraudPhone: null,
    officialWebsite: "https://example.org/",
    sourceUrl: "https://example.org/contact",
    lastVerifiedDate: "2026-11-22",
  });
  assert.equal(res.status, "unavailable");
  assert.equal(res.canDial, false);
  assert.equal(res.dialNumber, null);
  assert.equal(res.telUri, null);
});

test("5. Invalid contact records (alphabetic, XSS tel URI, non-HTTPS URL, bad date) are blocked", () => {
  assert.equal(validateDialablePhone("javascript:alert(1)").valid, false);
  assert.equal(validateDialablePhone("1800-SCAM-NOW").valid, false);
  assert.equal(validateDialablePhone("12").valid, false);
  assert.equal(buildTelUri("tel:1800-1234"), null);

  const invalidPhone = resolveEmergencyCallTarget({
    bankName: "Corrupt Entry",
    shortCode: "BAD1",
    supportPhone: "1800-CALL-FAKE",
    fraudPhone: null,
    officialWebsite: "https://example.org/",
    sourceUrl: "https://example.org/help",
    lastVerifiedDate: "2026-11-22",
  });
  assert.equal(invalidPhone.status, "invalid_record");
  assert.equal(invalidPhone.canDial, false);
  assert.equal(invalidPhone.telUri, null);

  const invalidUrl = resolveEmergencyCallTarget({
    bankName: "Insecure Link Bank",
    shortCode: "BAD2",
    supportPhone: "1800-1234",
    fraudPhone: null,
    officialWebsite: "http://insecure-example.com/",
    sourceUrl: "javascript:void(0)",
    lastVerifiedDate: "22-11-2026",
  });
  assert.equal(invalidUrl.status, "invalid_record");
  assert.equal(invalidUrl.canDial, false);
  assert.equal(invalidUrl.telUri, null);
  assert.ok(invalidUrl.validationErrors.length >= 2);
});

test("6. Multi-bank profile storage, primary switching, and deletion promotion work in DB", async () => {
  process.env.GUARDIAN_DB_PATH = ":memory:";
  await initDb();
  await seedDefaultBankDirectoryIfEmpty();

  const userId = "usr_test_bank_pref";
  await db
    .prepare(
      "INSERT OR IGNORE INTO users (id, username, name, role, password_hash, recovery_code_hash, created_at) VALUES (?, ?, ?, 'parent', 'h1', 'h2', ?)"
    )
    .run(userId, "bank_tester", "Bank Tester", Date.now());

  // Initially empty -> missing bank
  let saved = await getUserBanks(userId);
  assert.equal(saved.length, 0);

  // Add first bank -> automatically primary
  saved = await addUserBank({ userId, bankId: "SBI", accountNickname: "Pension", isPrimary: false });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].shortCode, "SBI");
  assert.equal(saved[0].isPrimary, true);
  assert.equal(saved[0].callResolution.telUri, "tel:1800111109");

  // Add second bank -> primary remains SBI unless isPrimary true
  saved = await addUserBank({ userId, bankId: "BOB", accountNickname: "Secondary", isPrimary: false });
  assert.equal(saved.length, 2);
  const bobEntry = saved.find((b) => b.shortCode === "BOB");
  assert.ok(bobEntry);
  assert.equal(bobEntry.isPrimary, false);

  // Switch primary to BOB
  saved = await setPrimaryUserBank(userId, bobEntry.id);
  const primaryAfterSwitch = saved.find((b) => b.isPrimary);
  assert.equal(primaryAfterSwitch?.shortCode, "BOB");
  assert.equal(primaryAfterSwitch?.callResolution.numberType, "customer_support");
  assert.equal(primaryAfterSwitch?.callResolution.telUri, "tel:18005700");

  // Remove primary BOB -> SBI gets promoted automatically
  saved = await removeUserBank(userId, bobEntry.id);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].shortCode, "SBI");
  assert.equal(saved[0].isPrimary, true);

  // Reject invalid last 4 digits
  await assert.rejects(() =>
    addUserBank({ userId, bankId: "HDFC", lastFourDigits: "1234567890", isPrimary: false })
  );
});

test("7. Searchable bank emergency helpline lookup returns verified records and safe fallback for unverified banks", () => {
  for (const query of ["SBI", "State Bank of India", "hdfc", "ICICI", "axis bank"]) {
    const res = lookupBankInVerifiedDirectory(query);
    assert.equal(res.verified, true, `Expected verified match for "${query}"`);
    assert.equal(res.matched, true);
    assert.ok(res.bank);
    assert.ok(res.callResolution?.telUri?.startsWith("tel:"));
    assert.equal(isSafeHttpsUrl(res.bank.officialWebsite), true);
    assert.match(res.bank.lastVerifiedDate, /^\d{4}-\d{2}-\d{2}$/);
  }

  for (const unverifiedQuery of ["XYZ Local Bank", "Other Banks", "bank", ""]) {
    const res = lookupBankInVerifiedDirectory(unverifiedQuery);
    assert.equal(res.verified, false, `Expected unverified fallback for "${unverifiedQuery}"`);
    assert.equal(res.matched, false);
    assert.equal(res.bank, null);
    assert.equal(res.callResolution, null);
    assert.equal(res.message, UNVERIFIED_BANK_FALLBACK_MESSAGE);
  }
});
