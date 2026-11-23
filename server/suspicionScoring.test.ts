import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSuspicionScore } from "./suspicionScoring.ts";
import type { SourceCheckEntry } from "./cyberSafetyCheck.ts";

function makeSource(
  sourceName: string,
  verificationStatus: SourceCheckEntry["verificationStatus"]
): SourceCheckEntry {
  return {
    sourceName,
    sourceNameHi: sourceName,
    informationChecked: "98••••3210",
    verificationStatus,
    result: `Status: ${verificationStatus}`,
    resultHi: `Status: ${verificationStatus}`,
    lastCheckedAt: 1_700_000_000_000,
    limitations: "Test fixture",
    limitationsHi: "Test fixture",
  };
}

test("1. No suspicious indicators -> 0/100 LOW RISK and clarifies 0 does not guarantee safety", () => {
  const res = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: "91••••1223",
    rawSignals: [],
    sourceChecks: [makeSource("Guardian Family Threat Cache", "NO KNOWN THREAT DETECTED")],
    requiresManualVerification: true,
  });

  assert.equal(res.score, 0);
  assert.equal(res.riskLevel, "LOW");
  assert.equal(res.riskLabel, "LOW RISK");
  assert.equal(res.indicators.length, 0);
  assert.equal(res.verificationStatus, "MANUAL VERIFICATION REQUIRED");
  assert.match(res.disclaimer, /does not guarantee safety/i);
});

test("2. One weak suspicious indicator stays LOW RISK (0-29)", () => {
  const res = evaluateSuspicionScore({
    category: "Personal Cyber Safety Check",
    maskedIdentifier: "sho•••@custombank",
    rawSignals: [
      {
        code: "UNVERIFIED_IDENTITY_MISMATCH",
        evidence: "PSP handle is not in recognized bank list",
        evidenceKey: "upi:psp:custombank",
        verified: true,
        sourceName: "UPI VPA Engine",
      },
    ],
    sourceChecks: [makeSource("UPI VPA Engine", "CAUTION")],
  });

  assert.equal(res.score, 15);
  assert.equal(res.riskLevel, "LOW");
  assert.equal(res.indicators.length, 1);
});

test("3. Multiple unverified community reports do NOT inflate to verified fraud match (+40)", () => {
  const res = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: "91••••5555",
    rawSignals: [
      {
        code: "VERIFIED_FRAUD_MATCH", // attempted claim from unverified community source must be downgraded
        evidence: "Unverified community report A",
        evidenceKey: "comm:rpt-1",
        verified: false,
        sourceName: "Unverified Community Feed",
      },
      {
        code: "REPEATED_COMMUNITY_REPORTS",
        evidence: "Unverified community report B",
        evidenceKey: "comm:rpt-2",
        verified: false,
        sourceName: "Unverified Community Feed",
      },
    ],
    sourceChecks: [makeSource("Unverified Community Feed", "CAUTION")],
  });

  assert.equal(res.score, 10);
  assert.equal(res.riskLevel, "LOW");
  assert.ok(res.indicators.every((i) => i.code === "REPEATED_COMMUNITY_REPORTS"));
});

test("4. One verified fraud match scores +40 -> MODERATE RISK (30-69)", () => {
  const res = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: "91••••9111",
    rawSignals: [
      {
        code: "VERIFIED_FRAUD_MATCH",
        evidence: "Confirmed match in trusted threat intelligence",
        evidenceKey: "intel:hash1",
        verified: true,
        sourceName: "Guardian Family Threat Cache",
      },
    ],
    sourceChecks: [makeSource("Guardian Family Threat Cache", "HIGH RISK")],
  });

  assert.equal(res.score, 40);
  assert.equal(res.riskLevel, "MODERATE");
  assert.equal(res.riskLabel, "MODERATE RISK");
});

test("5. Multiple independent verified indicators score >=70 -> HIGH RISK (capped at 100)", () => {
  const res = evaluateSuspicionScore({
    category: "QR Intelligence",
    maskedIdentifier: "cas•••@ybl",
    rawSignals: [
      {
        code: "VERIFIED_FRAUD_MATCH",
        evidence: "Confirmed match in family threat cache",
        evidenceKey: "qr:intel:1",
        verified: true,
        sourceName: "Guardian Family Threat Cache",
      },
      {
        code: "MALICIOUS_QR_DESTINATION",
        evidence: "Refund lure QR transfers funds out",
        evidenceKey: "qr:refund",
        verified: true,
        sourceName: "QR Structural Parser",
      },
      {
        code: "SUSPICIOUS_URL_PHISHING",
        evidence: "Phishing link embedded",
        evidenceKey: "qr:url",
        verified: true,
        sourceName: "Static URL Inspector",
      },
      {
        code: "DECEPTIVE_PAYMENT_REQUEST",
        evidence: "High preset payment request",
        evidenceKey: "qr:amount",
        verified: true,
        sourceName: "QR Structural Parser",
      },
    ],
    sourceChecks: [makeSource("QR Structural Parser", "HIGH RISK")],
  });

  assert.equal(res.score, 100);
  assert.equal(res.riskLevel, "HIGH");
  assert.equal(res.riskLabel, "HIGH RISK");
});

test("6. Unavailable intelligence sources add 0 points and are reported separately", () => {
  const res = evaluateSuspicionScore({
    category: "Website and URL Analysis",
    maskedIdentifier: "example-shop.in",
    rawSignals: [],
    sourceChecks: [
      makeSource("Static URL Inspector", "NO KNOWN THREAT DETECTED"),
      makeSource("External Real-Time URL Threat Feed", "SOURCE UNAVAILABLE"),
      makeSource("External Telecom / Chakshu Live Registry", "SOURCE UNAVAILABLE"),
    ],
  });

  assert.equal(res.score, 0);
  assert.equal(res.riskLevel, "LOW");
  assert.deepEqual(res.sourcesUnavailable, [
    "External Real-Time URL Threat Feed",
    "External Telecom / Chakshu Live Registry",
  ]);
});

test("7. Duplicate reports are deduplicated cleanly and never double-counted", () => {
  const res = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: "91••••7777",
    rawSignals: [
      {
        code: "REPEATED_COMMUNITY_REPORTS",
        evidence: "Same complaint forwarded 3 times",
        evidenceKey: "rpt:identical-id-42",
        verified: false,
        sourceName: "Community Report",
      },
      {
        code: "REPEATED_COMMUNITY_REPORTS",
        evidence: "Same complaint forwarded 3 times",
        evidenceKey: "rpt:identical-id-42",
        verified: false,
        sourceName: "Community Report",
      },
      {
        code: "MULTIPLE_INDEPENDENT_REPORTS",
        evidence: "Duplicate copy of identical report",
        evidenceKey: "rpt:identical-id-42",
        verified: true,
        sourceName: "Community Report",
        reportKeys: ["rpt:identical-id-42", "rpt:identical-id-42"],
      },
    ],
    sourceChecks: [makeSource("Community Report", "CAUTION")],
  });

  assert.equal(res.deduplicatedCount, 1);
  assert.equal(res.score, 10);
  assert.equal(res.riskLevel, "LOW");
  assert.equal(res.indicators.length, 1);
});

test("8. Conflicting source results flag conflict transparently without distorting deterministic score", () => {
  const res = evaluateSuspicionScore({
    category: "Phone Fraud Detection",
    maskedIdentifier: "91••••9111",
    rawSignals: [
      {
        code: "VERIFIED_FRAUD_MATCH",
        evidence: "Flagged in trusted fraud database",
        evidenceKey: "intel:9111",
        verified: true,
        sourceName: "Guardian Family Threat Cache",
      },
    ],
    sourceChecks: [
      makeSource("Guardian Family Threat Cache", "HIGH RISK"),
      makeSource("Local Device Allowlist", "NO KNOWN THREAT DETECTED"),
    ],
    markedTrustedLocally: true,
  });

  assert.equal(res.score, 40);
  assert.equal(res.riskLevel, "MODERATE");
  assert.equal(res.conflictingSources, true);
  assert.ok(res.conflictNote && res.conflictNote.length > 10);
});
