import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGuardianContextBlock,
  chatWithGemini,
  detectVoiceNavigationIntent,
  GeminiServiceError,
  guardianSafetyAdvisorChat,
  mapGeminiError,
  normalizeVoiceLang,
  transcribeAudioWithGemini,
  voiceAssist,
} from "./ai.ts";

test("1. normalizeVoiceLang accepts hinglish and falls back cleanly for unknown codes", () => {
  assert.equal(normalizeVoiceLang("hinglish"), "hinglish");
  assert.equal(normalizeVoiceLang("hi"), "hi");
  assert.equal(normalizeVoiceLang("en"), "en");
  assert.equal(normalizeVoiceLang("bn"), "bn");
  assert.equal(normalizeVoiceLang("INVALID_CODE"), "en");
  assert.equal(normalizeVoiceLang(undefined), "en");
});

test("2. mapGeminiError cleanly converts raw @google/genai 503/429/auth/timeout/network failures", () => {
  const err503 = mapGeminiError(
    new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}')
  );
  assert.equal(err503.statusCode, 503);
  assert.equal(err503.code, "GEMINI_HIGH_DEMAND");
  assert.match(err503.message, /high demand/i);

  const err429 = mapGeminiError(
    new Error('{"error":{"code":429,"message":"Quota exceeded for quota metric","status":"RESOURCE_EXHAUSTED"}}')
  );
  assert.equal(err429.statusCode, 429);
  assert.equal(err429.code, "GEMINI_QUOTA_EXCEEDED");

  const errAuth = mapGeminiError(new Error("API_KEY_INVALID: key not valid"));
  assert.equal(errAuth.statusCode, 503);
  assert.equal(errAuth.code, "GEMINI_AUTH_ERROR");

  const errTimeout = mapGeminiError(new Error("Request timed out after 20000ms"));
  assert.equal(errTimeout.statusCode, 504);
  assert.equal(errTimeout.code, "GEMINI_TIMEOUT");

  const errNet = mapGeminiError(new Error("fetch failed: ECONNREFUSED"));
  assert.equal(errNet.statusCode, 502);
  assert.equal(errNet.code, "GEMINI_NETWORK_ERROR");

  const custom = new GeminiServiceError("Custom error", 422, "NO_SPEECH_DETECTED");
  assert.equal(mapGeminiError(custom), custom);
});

test("3. buildGuardianContextBlock redacts PII and embeds deterministic scan scores without fabricating fields", () => {
  const block = buildGuardianContextBlock(
    {
      activeSection: "QR & Scam Check",
      contextType: "QR Intelligence",
      score: 82,
      riskLevel: "HIGH",
      verificationStatus: "VERIFIED THREAT MATCH",
      summary: "QR asks refund@okaxis for 9876543210",
      signals: ["Collect request disguised as refund"],
      sourcesUnavailable: ["External Live UPI Registry"],
    },
    ["Urgency keyword detected"]
  );

  assert.match(block, /82\/100 \(HIGH\)/);
  assert.match(block, /QR Intelligence/);
  assert.match(block, /\[UPI_OR_EMAIL\]/);
  assert.match(block, /\[NUMBER\]/);
  assert.doesNotMatch(block, /9876543210/);
  assert.match(block, /External Live UPI Registry/);
});

test("4. detectVoiceNavigationIntent detects live_qr, emergency_call, cyber_check, calls_links, and awareness", () => {
  assert.equal(detectVoiceNavigationIntent("Open live QR scanner"), "live_qr");
  assert.equal(detectVoiceNavigationIntent("Open emergency bank call"), "emergency_call");
  assert.equal(detectVoiceNavigationIntent("Open Personal Cyber Safety Check"), "cyber_check");
  assert.equal(detectVoiceNavigationIntent("Open phone fraud call protection"), "calls_links");
  assert.equal(detectVoiceNavigationIntent("Open scam awareness guide"), "awareness");
  assert.equal(detectVoiceNavigationIntent("Is sharing OTP safe?"), null);
});

test("5. Guardian Advisor chatWithGemini & voiceAssist ground active context in EN, HI, and Hinglish", async () => {
  const chatRes = await chatWithGemini({
    history: [{ role: "user", text: "Hello" }],
    message: "Should I scan this QR for refund?",
    signals: ["Refund lure QR"],
    lang: "hinglish",
    provider: "guardian",
    guardianContext: {
      activeSection: "QR & Scam Check",
      contextType: "QR Intelligence",
      score: 75,
      riskLevel: "HIGH",
      signals: ["Refund lure QR"],
    },
  });

  assert.equal(chatRes.providerUsed, "guardian");
  assert.match(chatRes.text, /75\/100 \(HIGH\)/);
  assert.match(chatRes.text, /OTP|UPI PIN|1930/i);

  const navRes = await voiceAssist({
    transcript: "Open live QR scanner",
    voiceLang: "hinglish",
    provider: "guardian",
  });
  assert.equal(navRes.navigateTo, "live_qr");
  assert.equal(navRes.languageCode, "hinglish");
  assert.match(navRes.spokenReply, /Live Camera QR Scanner/i);

  const hiVoice = await voiceAssist({
    transcript: "क्या बैंक OTP मांग सकता है?",
    voiceLang: "hi",
    provider: "guardian",
  });
  assert.equal(hiVoice.navigateTo, null);
  assert.equal(hiVoice.languageCode, "hi");
  assert.match(hiVoice.reply, /OTP/);

  const directAdvice = guardianSafetyAdvisorChat({
    message: "Unknown link clicked",
    signals: ["Shortened URL"],
    lang: "en",
  });
  assert.match(directAdvice, /1930/);
});

test("6. transcribeAudioWithGemini rejects unsupported audio MIME types and empty payloads safely", async () => {
  await assert.rejects(
    () =>
      transcribeAudioWithGemini({
        base64Audio: "AAAA".repeat(20),
        mimeType: "text/plain",
        voiceLang: "en",
      }),
    (err: unknown) => err instanceof GeminiServiceError && err.statusCode === 400 && err.code === "UNSUPPORTED_AUDIO_MIME"
  );

  await assert.rejects(
    () =>
      transcribeAudioWithGemini({
        base64Audio: "tiny",
        mimeType: "audio/webm",
        voiceLang: "hinglish",
      }),
    (err: unknown) => err instanceof GeminiServiceError && err.statusCode === 400 && err.code === "EMPTY_AUDIO"
  );
});
