import React, { useEffect, useState } from "react";
import { ShieldAlert, QrCode, Upload, MessageSquare, Send, Flag, Camera, Volume2, Square } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { isTtsSupported, speakAlertText, stopSpeaking } from "../lib/tts";
import { decodeQrFromImageFile, evaluateMessageLocally, type LocalScamAssessment } from "../lib/scamClient";
import { SourceTransparencyPanel } from "./SourceTransparencyPanel";
import { SuspicionScoreCard } from "./SuspicionScoreCard";
import { EmergencyCallButton } from "./EmergencyBankCallModal";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import { EmptyStateCard } from "./VisualAsset";
import { LiveQrScanner } from "./LiveQrScanner";
import { VisualRiskAlert } from "./VisualRiskAlert";
import { ContextualAwarenessLinks } from "./ContextualAwarenessLinks";
import { AiProviderSwitcher } from "./GeminiBadgeIcon";
import { SafeMarkdownText } from "./SafeMarkdownText";
import { Cybersecurity2D, QrScam2D } from "./Illustrations2D";
import type { ScamAwarenessId } from "../data/awarenessContent";
import type {
  AiProviderId,
  AppStatePayload,
  GuardianIntelContext,
  LangCode,
  SourceCheckEntry,
  SuspicionAssessment,
  UnifiedRiskLevel,
  VoiceLangCode,
} from "../types/guardian";

interface ScamQrTabProps {
  state: AppStatePayload;
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  aiProvider?: AiProviderId;
  onChangeProvider?: (provider: AiProviderId) => void;
  onRefresh: () => Promise<void>;
  openLiveScannerInitially?: boolean;
  onLiveScannerHandled?: () => void;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
  onIntelContextChange?: (ctx: GuardianIntelContext) => void;
}

interface QrReport {
  id: string;
  qrFormat: string;
  qrClassification: string;
  upiId: string | null;
  payeeName: string | null;
  amount: number | null;
  amountState: string;
  rawPreview?: string;
  securityRiskScore: number;
  securityRiskLevel: string;
  paymentLoadCategory: string;
  signals: string[];
  guidance: string;
  sourceChecks?: SourceCheckEntry[];
  suspicionAssessment?: SuspicionAssessment;
}

const SAMPLE_MESSAGES = [
  {
    label: "KYC / AnyDesk Scam",
    labelHi: "KYC / AnyDesk घोटाला",
    text: "Dear customer, your SBI YONO account will be blocked today. Update PAN KYC immediately via http://sbi-kyc-help.xyz or call and install AnyDesk QuickSupport.",
  },
  {
    label: "Electricity Disconnection",
    labelHi: "बिजली कटौती धमकी",
    text: "URGENT: Your electricity meter will be disconnected tonight at 9:30 PM because last month bill was not updated. Call 9876543210 immediately and pay ₹12.",
  },
  {
    label: "UPI Receive-Money Trap",
    labelHi: "UPI रिफंड जाल",
    text: "Congratulations! You won ₹15,000 cashback. Scan the QR code and enter your UPI PIN to receive money into your bank account.",
  },
];

const SAMPLE_QRS = [
  {
    label: "Safe Local Grocer UPI",
    labelHi: "सुरक्षित स्थानीय किराना UPI",
    payload: "upi://pay?pa=sharmagrocers@okicici&pn=Sharma%20Provision%20Store&am=450&cu=INR&tn=Groceries",
  },
  {
    label: "High-Risk Refund Trap QR",
    labelHi: "उच्च जोखिम रिफंड QR",
    payload: "upi://pay?pa=cashbackclaim88@ybl&pn=Official%20Bank%20Refund&am=28500&cu=INR&tn=Claim%20Cashback%20Refund%20Now",
  },
  {
    label: "Suspicious Web Link QR",
    labelHi: "संदिग्ध वेब लिंक QR",
    payload: "http://hdfc-pan-verify.xyz/login?ref=urgent",
  },
];

export const ScamQrTab: React.FC<ScamQrTabProps> = ({
  state,
  lang,
  voiceLang = lang,
  aiProvider = "gemini",
  onChangeProvider,
  onRefresh,
  openLiveScannerInitially = false,
  onLiveScannerHandled,
  onOpenAwareness,
  onIntelContextChange,
}) => {
  const { openEmergencyCall } = useEmergencyCall();
  const isParent = state.user.role === "parent";

  const [localProvider, setLocalProvider] = useState<AiProviderId>(aiProvider);
  const activeProvider = onChangeProvider ? aiProvider : localProvider;
  const setProvider = onChangeProvider || setLocalProvider;

  const [msgText, setMsgText] = useState(SAMPLE_MESSAGES[0].text);
  const [assessment, setAssessment] = useState<LocalScamAssessment | null>(() =>
    evaluateMessageLocally(SAMPLE_MESSAGES[0].text)
  );
  const [aiExplain, setAiExplain] = useState<{ explanation: string; nextSteps: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busyMsg, setBusyMsg] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [speakingChatIdx, setSpeakingChatIdx] = useState<number | null>(null);

  const [liveScannerOpen, setLiveScannerOpen] = useState(openLiveScannerInitially);
  const [qrPayload, setQrPayload] = useState(SAMPLE_QRS[1].payload);
  const [qrReport, setQrReport] = useState<QrReport | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrAiExplain, setQrAiExplain] = useState<{ explanation: string; nextSteps: string[] } | null>(null);
  const [qrAiError, setQrAiError] = useState<string | null>(null);
  const [qrAiBusy, setQrAiBusy] = useState(false);

  useEffect(() => {
    if (openLiveScannerInitially) {
      setLiveScannerOpen(true);
      onLiveScannerHandled?.();
    }
  }, [openLiveScannerInitially, onLiveScannerHandled]);

  async function runMessageCheck() {
    const local = evaluateMessageLocally(msgText);
    setAssessment(local);
    setAiExplain(null);
    setAiError(null);
    setReportNotice(null);
    if (!msgText.trim()) return;
    onIntelContextChange?.({
      activeSection: "Message Scam Check",
      contextType: "message",
      summary: `Message check (${local.category}): ${local.level} (${local.score}/100). ${local.guidance}`,
      score: local.score,
      riskLevel: local.level,
      signals: local.signals,
    });

    setBusyMsg(true);
    try {
      if (isParent) {
        await apiFetch("/api/scam/record", {
          method: "POST",
          body: JSON.stringify({
            score: local.score,
            level: local.level,
            cat: local.category,
            sig: local.signals,
            text: msgText,
            lang,
          }),
        });
      }
      const exp = await apiFetch<{ explanation: string; nextSteps: string[] }>("/api/ai/explain", {
        method: "POST",
        body: JSON.stringify({
          text: msgText,
          signals: local.signals,
          level: local.level,
          lang,
          voiceLang,
          provider: activeProvider,
          contextType: "message",
        }),
      });
      setAiExplain(exp);
      await onRefresh();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI explanation unavailable.");
      await onRefresh();
    } finally {
      setBusyMsg(false);
    }
  }

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiError(null);
    setBusyMsg(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = String(reader.result || "");
          resolve(res.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("Could not read screenshot file."));
        reader.readAsDataURL(file);
      });
      const ocr = await apiFetch<{ extractedText: string }>("/api/ai/ocr", {
        method: "POST",
        body: JSON.stringify({ base64Data: base64, mimeType: file.type || "image/png" }),
      });
      if (ocr.extractedText) {
        setMsgText(ocr.extractedText);
        setAssessment(evaluateMessageLocally(ocr.extractedText));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Screenshot OCR failed.");
    } finally {
      setBusyMsg(false);
    }
  }

  async function handleReportMessage() {
    if (!isParent || msgText.trim().length < 8) return;
    try {
      await apiFetch("/api/scam/report", {
        method: "POST",
        body: JSON.stringify({ text: msgText, cat: assessment?.category || "other" }),
      });
      setReportNotice(
        lang === "hi"
          ? "फोन नंबर और UPI ID छिपाकर रिपोर्ट दर्ज की गई।"
          : "Reported with phone numbers & UPI IDs masked."
      );
      await onRefresh();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Report failed.");
    }
  }

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    const nextHist = [...chatHistory, { role: "user", text: q }];
    setChatHistory(nextHist);
    setChatInput("");
    setChatBusy(true);

    const activeScanCtx: GuardianIntelContext | undefined = qrReport
      ? {
          activeSection: "QR Intelligence Inspector",
          contextType: "qr_code",
          summary: `QR Format: ${qrReport.qrFormat}, Payee: ${qrReport.payeeName || "Unknown"}, UPI/URL: ${qrReport.upiId || qrReport.rawPreview || "N/A"}, Amount: ${qrReport.amount ?? "Open"}, Risk: ${qrReport.securityRiskLevel} (${qrReport.suspicionAssessment?.score ?? qrReport.securityRiskScore}/100)`,
          score: qrReport.suspicionAssessment?.score ?? qrReport.securityRiskScore,
          riskLevel: qrReport.suspicionAssessment?.riskLevel ?? qrReport.securityRiskLevel,
          verificationStatus: qrReport.suspicionAssessment?.verificationStatus,
          signals: qrReport.signals,
          sourcesUnavailable: qrReport.suspicionAssessment?.sourcesUnavailable,
        }
      : assessment
        ? {
            activeSection: "Message Scam Check",
            contextType: "message",
            summary: `Message scam check: ${assessment.category}, ${assessment.level} (${assessment.score}/100)`,
            score: assessment.score,
            riskLevel: assessment.level,
            signals: assessment.signals,
          }
        : undefined;

    try {
      const res = await apiFetch<{ text: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          history: chatHistory,
          message: q,
          signals: qrReport?.signals || assessment?.signals || [],
          lang,
          voiceLang,
          provider: activeProvider,
          guardianContext: activeScanCtx,
        }),
      });
      setChatHistory([...nextHist, { role: "assistant", text: res.text }]);
    } catch (err) {
      setChatHistory([
        ...nextHist,
        { role: "assistant", text: err instanceof Error ? err.message : "Unable to reach AI advisor right now." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function analyzeQr(payloadOverride?: string) {
    const raw = (payloadOverride ?? qrPayload).trim();
    if (!raw) return;
    setQrError(null);
    setQrAiExplain(null);
    setQrAiError(null);
    setQrBusy(true);
    try {
      if (isParent) {
        const res = await apiFetch<{ report: QrReport }>("/api/qr/analyze", {
          method: "POST",
          body: JSON.stringify({ payload: raw, lang }),
        });
        setQrReport(res.report);
        onIntelContextChange?.({
          activeSection: "QR Intelligence Inspector",
          contextType: "qr_code",
          summary: `QR Format: ${res.report.qrFormat}, Payee: ${res.report.payeeName || "Unknown"}, Destination: ${res.report.upiId || res.report.rawPreview || "N/A"}, Amount: ${res.report.amount ?? "Open"}, Risk: ${res.report.securityRiskLevel} (${res.report.suspicionAssessment?.score ?? res.report.securityRiskScore}/100)`,
          score: res.report.suspicionAssessment?.score ?? res.report.securityRiskScore,
          riskLevel: res.report.suspicionAssessment?.riskLevel ?? res.report.securityRiskLevel,
          verificationStatus: res.report.suspicionAssessment?.verificationStatus,
          signals: res.report.signals,
          sourcesUnavailable: res.report.suspicionAssessment?.sourcesUnavailable,
        });
        await onRefresh();
      } else {
        setQrError(
          lang === "hi"
            ? "QR स्कैनिंग केवल माता-पिता खाते से चलती है; अभिभावक नीचे लॉग देख सकते हैं।"
            : "QR scanning & recording runs from the Parent account; linked guardian scan logs appear below."
        );
      }
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "QR inspection failed.");
    } finally {
      setQrBusy(false);
    }
  }

  async function explainQrWithAi() {
    if (!qrReport) return;
    setQrAiError(null);
    setQrAiBusy(true);
    try {
      const res = await apiFetch<{ explanation: string; nextSteps: string[] }>("/api/ai/explain", {
        method: "POST",
        body: JSON.stringify({
          text: `QR format: ${qrReport.qrFormat}, Payee: ${qrReport.payeeName || "Unknown"}, UPI: ${qrReport.upiId || "N/A"}, Amount: ${qrReport.amount ?? "Open"}`,
          signals: qrReport.signals,
          findings: qrReport.signals,
          score: qrReport.suspicionAssessment?.score ?? qrReport.securityRiskScore,
          riskLevel: qrReport.suspicionAssessment?.riskLevel ?? qrReport.securityRiskLevel,
          verificationStatus: qrReport.suspicionAssessment?.verificationStatus,
          indicators: qrReport.suspicionAssessment?.indicators.map((i) => ({
            label: i.label,
            points: i.points,
            evidence: i.evidence,
            sourceName: i.sourceName,
            verified: i.verified,
          })),
          sourcesUnavailable: qrReport.suspicionAssessment?.sourcesUnavailable,
          sourceChecks: (qrReport.sourceChecks || []).map((s) => ({
            sourceName: s.sourceName,
            verificationStatus: s.verificationStatus,
            result: s.result,
            limitations: s.limitations,
          })),
          level: qrReport.securityRiskLevel,
          lang,
          voiceLang,
          provider: activeProvider,
          contextType: "qr_code",
        }),
      });
      setQrAiExplain(res);
    } catch (err) {
      setQrAiError(err instanceof Error ? err.message : "AI explanation unavailable.");
    } finally {
      setQrAiBusy(false);
    }
  }

  async function handleQrImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrError(null);
    try {
      const decoded = await decodeQrFromImageFile(file);
      setQrPayload(decoded);
      await analyzeQr(decoded);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Could not decode QR image.");
    }
  }

  const qrHistory = isParent ? state.qrScans || [] : state.linkedQrScans || [];

  const chipBtn =
    "min-h-[34px] px-3 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 text-xs font-medium text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0";
  const primaryBtn =
    "min-h-[40px] px-4 py-2 rounded-xl gm-gold-btn text-sm font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]";
  const secondaryBtn =
    "min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 text-xs font-semibold text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionReveal}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
    >
      {/* Left Column: Message Scam Check + Screenshot OCR + AI Advisor */}
      <div className="lg:col-span-6 space-y-6">
        <div className="gp-card rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Cybersecurity2D className="w-11 h-11 shrink-0" />
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#E6C98A]" />
                <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi"
                    ? "व्यक्तिगत साइबर सुरक्षा व संदेश जांच"
                    : "Personal Cyber Safety & Screenshot Check"}
                </h2>
              </div>
            </div>
            {isParent && (
              <label className={secondaryBtn}>
                <Upload className="w-3.5 h-3.5 text-[#E6C98A]" />
                {lang === "hi" ? "स्क्रीनशॉट OCR" : "OCR Screenshot"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleScreenshotUpload}
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLE_MESSAGES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setMsgText(s.text);
                  setAssessment(evaluateMessageLocally(s.text));
                  setAiExplain(null);
                }}
                className={chipBtn}
              >
                {lang === "hi" ? s.labelHi : s.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder={
              lang === "hi"
                ? "SMS, WhatsApp संदेश या कॉल विवरण यहां पेस्ट करें..."
                : "Paste SMS, WhatsApp text, or call transcript here..."
            }
            className="mt-3 w-full rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 p-3.5 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busyMsg} onClick={runMessageCheck} className={primaryBtn}>
              {busyMsg
                ? lang === "hi"
                  ? "जांच जारी है..."
                  : "Analyzing..."
                : lang === "hi"
                  ? "सुरक्षा जांचें"
                  : "Analyze Safety"}
            </button>
            {isParent && (
              <button type="button" onClick={handleReportMessage} className={secondaryBtn}>
                <Flag className="w-3.5 h-3.5 text-[#E6C98A]" />
                {lang === "hi" ? "मास्क्ड रिपोर्ट भेजें" : "Report Masked Excerpt"}
              </button>
            )}
          </div>

          {reportNotice && <p className="mt-3 text-xs font-medium text-[#43C6A5]">{reportNotice}</p>}

          {assessment && (
            <div className="mt-5 pt-5 border-t border-[#C6A15B]/20 space-y-4">
              {(() => {
                const mappedLevel: UnifiedRiskLevel =
                  assessment.level === "CRITICAL" || assessment.level === "HIGH"
                    ? "HIGH"
                    : assessment.level === "MEDIUM"
                      ? "MODERATE"
                      : "LOW";
                return (
                  <VisualRiskAlert
                    level={mappedLevel}
                    score={assessment.score}
                    categoryLabel={assessment.category}
                    simpleSummaryEn={assessment.guidance}
                    simpleSummaryHi={
                      mappedLevel === "HIGH"
                        ? "रुकें! संदेश में धोखाधड़ी के गंभीर संकेत हैं। OTP, PIN या पैसे न भेजें।"
                        : mappedLevel === "MODERATE"
                          ? "सावधान! लिंक या भुगतान करने से पहले परिवार या बैंक से पुष्टि करें।"
                          : "स्थानीय जांच में कोई बड़ा खतरा नहीं मिला, फिर भी अनजान भेजने वाले की पुष्टि करें।"
                    }
                    reasonsEn={assessment.signals}
                    reasonsHi={assessment.signals}
                    stepsEn={[
                      assessment.guidance,
                      "Verify directly with your family guardian or official bank before acting.",
                    ]}
                    stepsHi={["कोई भी कदम उठाने से पहले परिवार के सदस्य या बैंक से पुष्टि करें।"]}
                    lang={lang}
                    voiceLang={voiceLang}
                    awarenessSlot={
                      <ContextualAwarenessLinks
                        context="financial"
                        scamCardId={
                          assessment.category === "remote_access_scam"
                            ? "remote_access"
                            : assessment.category === "upi_collect_scam"
                              ? "upi_scam"
                              : assessment.category === "credential_theft"
                                ? "otp_scam"
                                : "impersonation"
                        }
                        lang={lang}
                        onOpenAwareness={onOpenAwareness}
                        compact
                      />
                    }
                  />
                );
              })()}

              {(assessment.level === "HIGH" || assessment.level === "CRITICAL") && (
                <div className="p-3.5 rounded-xl bg-[#2E1219] border border-[#E87575]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-[#E87575]">
                      {lang === "hi"
                        ? "उच्च जोखिम संदेश — बैंक सहायता की आवश्यकता है?"
                        : "High-Risk Scam Alert — Need Urgent Bank Help?"}
                    </p>
                    <p className="text-[#F4F0E6]">
                      {lang === "hi"
                        ? "यदि आपने लिंक पर क्लिक किया, ऐप इंस्टॉल किया या OTP साझा किया, तो तुरंत अपने बैंक को कॉल करें।"
                        : "If you tapped a link, installed an app, or shared an OTP, call your verified bank helpline immediately."}
                    </p>
                  </div>
                  <EmergencyCallButton
                    compact
                    lang={lang}
                    className="shrink-0"
                    onClick={() =>
                      openEmergencyCall({
                        source: "fraud_result",
                        threatCategory: `Message Scam Check (${assessment.category})`,
                        riskLevel: `${assessment.level} RISK`,
                        score: assessment.score,
                        reason: assessment.signals[0] || "High-risk scam message indicators detected",
                        incidentDescription: assessment.signals.slice(0, 2).join(" · "),
                        suggestedAction: `Detected ${assessment.level} risk scam message (${assessment.score}/100). Please check my account for unauthorized debits or remote-access risk.`,
                        suggestedActionHi: `संदेश में ${assessment.level} जोखिम (${assessment.score}/100) का पता चला। कृपया खाते में किसी अनधिकृत लेनदेन की जांच करें।`,
                      })
                    }
                  />
                </div>
              )}

              {aiExplain && (
                <div className="mt-3 p-4 rounded-xl bg-[#10243A]/90 border border-[#C6A15B]/40">
                  <p className="text-xs font-semibold text-[#E6C98A]">
                    {lang === "hi" ? "AI सरल व्याख्या" : "AI Plain-Language Summary"}
                  </p>
                  <p className="mt-1 text-sm text-[#F4F0E6]">{aiExplain.explanation}</p>
                  <ul className="mt-2 space-y-1 text-xs text-[#AEBBC9] list-disc pl-4">
                    {aiExplain.nextSteps.map((st, idx) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiError && (
                <p className="text-xs text-[#E87575]">
                  {lang === "hi" ? "AI नोट:" : "AI note:"} {aiError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ask Guardian Safety Advisor */}
        <div className="gp-card rounded-2xl p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#E6C98A]" />
              <h3 className="font-display text-sm font-semibold text-[#F4F0E6]">
                {lang === "hi" ? "सुरक्षा सलाहकार से पूछें" : "Ask Safety Advisor"}
              </h3>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[230px]">
              <AiProviderSwitcher provider={activeProvider} onChange={setProvider} lang={lang} compact />
            </div>
          </div>

          {chatHistory.length > 0 && (
            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
              {chatHistory.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-xs leading-relaxed border ${
                    m.role === "user"
                      ? "bg-[#252A32]/90 border-[#C6A15B]/25 text-[#F4F0E6] ml-8"
                      : "bg-[#071525]/85 border-[#E6C98A]/40 text-[#F4F0E6] mr-6"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-[#E6C98A]">
                      {m.role === "user"
                        ? lang === "hi"
                          ? "आप"
                          : "You"
                        : lang === "hi"
                          ? "सुरक्षा सलाहकार"
                          : "Safety Advisor"}
                    </span>
                    {m.role === "assistant" && isTtsSupported() && (
                      <button
                        type="button"
                        onClick={() => {
                          if (speakingChatIdx === i) {
                            stopSpeaking();
                            setSpeakingChatIdx(null);
                            return;
                          }
                          speakAlertText(m.text, voiceLang, {
                            onStart: () => setSpeakingChatIdx(i),
                            onEnd: () => setSpeakingChatIdx(null),
                            onError: () => setSpeakingChatIdx(null),
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-[#10243A] border border-[#C6A15B]/30 text-[10px] font-semibold text-[#E6C98A] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {speakingChatIdx === i ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>{lang === "hi" ? "रोकें" : "Stop"}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>{lang === "hi" ? "सुनें" : "Speak"}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {m.role === "assistant" ? (
                    <SafeMarkdownText text={m.text} className="text-xs text-[#F4F0E6]" />
                  ) : (
                    <p>{m.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleChatSend} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                lang === "hi"
                  ? "पूछें जैसे 'क्या KYC के लिए ₹10 भेजना सुरक्षित है?'"
                  : "Ask e.g. 'Should I pay ₹10 to verify KYC?'"
              }
              className="flex-1 min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3.5 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]"
            />
            <button
              type="submit"
              disabled={chatBusy}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-sm font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              {lang === "hi" ? "पूछें" : "Ask"}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: QR Intelligence Inspector (#0D2A33 + Sky #6CC4E8 accent) */}
      <div className="lg:col-span-6 space-y-6">
        <div className="rounded-2xl p-6 bg-[#0D2A33]/92 border border-[#6CC4E8]/35 shadow-[0_14px_34px_-14px_rgba(3,8,18,0.85)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <QrScam2D
                className="hidden sm:block w-16 h-16 shrink-0"
                title={
                  lang === "hi"
                    ? "सुरक्षित QR कोड स्कैनिंग और UPI भुगतान सत्यापन दृश्य"
                    : "Secure UPI QR code inspection and payment verification visual"
                }
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#6CC4E8] shrink-0" />
                  <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                    {lang === "hi" ? "QR इंटेलिजेंस इंस्पेक्टर" : "QR Intelligence Inspector"}
                  </h2>
                </div>
                <p className="mt-1.5 text-xs text-[#AEBBC9] leading-relaxed">
                  {lang === "hi"
                    ? "लिंक खोले बिना या भुगतान शुरू किए बिना UPI, BharatQR और वेब QR डिकोड करता है।"
                    : "Decodes UPI, BharatQR, and web QR payloads without ever auto-opening links or triggering payments."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isParent && (
                <>
                  <button
                    type="button"
                    onClick={() => setLiveScannerOpen((v) => !v)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      liveScannerOpen ? "gm-emergency-btn" : "gm-gold-btn"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {liveScannerOpen
                      ? lang === "hi"
                        ? "लाइव स्कैनर बंद करें"
                        : "Close Live Scanner"
                      : lang === "hi"
                        ? "लाइव QR स्कैनर"
                        : "LIVE QR SCANNER"}
                  </button>
                  <label className={secondaryBtn}>
                    <Upload className="w-3.5 h-3.5 text-[#6CC4E8]" />
                    {lang === "hi" ? "QR छवि अपलोड करें" : "Upload QR Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleQrImageUpload} />
                  </label>
                </>
              )}
            </div>
          </div>

          {liveScannerOpen && isParent && (
            <div className="mt-4">
              <LiveQrScanner
                lang={lang}
                busy={qrBusy}
                onClose={() => setLiveScannerOpen(false)}
                onDecoded={async (decoded) => {
                  setQrPayload(decoded);
                  await analyzeQr(decoded);
                }}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLE_QRS.map((q) => (
              <button key={q.label} type="button" onClick={() => setQrPayload(q.payload)} className={chipBtn}>
                {lang === "hi" ? q.labelHi : q.label}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={qrPayload}
            onChange={(e) => setQrPayload(e.target.value)}
            placeholder="Paste decoded QR string (e.g. upi://pay?pa=...)"
            className="mt-3 w-full rounded-xl border border-[#6CC4E8]/30 bg-[#071525]/85 p-3.5 text-xs font-mono text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]"
          />

          <div className="mt-3">
            <button type="button" disabled={qrBusy} onClick={() => analyzeQr()} className={primaryBtn}>
              {qrBusy
                ? lang === "hi"
                  ? "QR जांच जारी है..."
                  : "Inspecting QR..."
                : lang === "hi"
                  ? "QR पेलोड जांचें"
                  : "Inspect QR Payload"}
            </button>
          </div>

          {qrError && <p className="mt-3 text-xs text-[#E87575]">{qrError}</p>}

          {qrReport && (
            <div className="mt-5 pt-5 border-t border-[#C6A15B]/20 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#071525]/80 p-3.5 rounded-xl border border-[#6CC4E8]/28">
                <div>
                  <span className="text-[#AEBBC9] block">{lang === "hi" ? "प्राप्तकर्ता" : "Payee"}</span>
                  <span className="font-semibold text-[#F4F0E6]">{qrReport.payeeName || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-[#AEBBC9] block">{lang === "hi" ? "राशि · लोड" : "Amount · Load"}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#6CC4E8]">
                    {qrReport.amount ? `₹${qrReport.amount.toLocaleString("en-IN")}` : "Open"} ·{" "}
                    {qrReport.paymentLoadCategory}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#AEBBC9] block">
                    {qrReport.qrFormat === "WEB_URL"
                      ? lang === "hi"
                        ? "भुगतान / वेब URL (सुरक्षित पाठ, स्वतः नहीं खुलता)"
                        : "Decoded Payment / Web URL (Read-Only, Never Auto-Opened)"
                      : lang === "hi"
                        ? "UPI ID / डिकोड जानकारी"
                        : "UPI ID / Decoded Destination"}
                  </span>
                  <span className="font-mono text-[#F4F0E6] break-all">
                    {qrReport.upiId || qrReport.rawPreview || "N/A"}
                  </span>
                </div>
              </div>

              {qrReport.suspicionAssessment ? (
                <SuspicionScoreCard
                  assessment={qrReport.suspicionAssessment}
                  lang={lang}
                  onExplainAi={explainQrWithAi}
                  aiBusy={qrAiBusy}
                  aiExplain={qrAiExplain}
                  aiError={qrAiError}
                  onOpenAwareness={onOpenAwareness}
                />
              ) : (
                <p className="text-sm text-[#AEBBC9]">{qrReport.guidance}</p>
              )}

              {qrReport.sourceChecks && <SourceTransparencyPanel sources={qrReport.sourceChecks} lang={lang} />}
            </div>
          )}
        </div>

        {/* Recent QR History */}
        <div className="gp-card rounded-2xl p-6">
          <h3 className="font-display text-sm font-semibold text-[#F4F0E6] mb-3">
            {lang === "hi" ? "हालिया QR जांच" : "Recent QR Inspections"}
          </h3>
          {qrHistory.length === 0 ? (
            <EmptyStateCard
              compact
              title={lang === "hi" ? "कोई QR जांच लॉग नहीं" : "No QR Scans Logged Yet"}
              description={
                lang === "hi"
                  ? "UPI या वेब QR पेलोड जांचने के बाद आपका सत्यापन इतिहास यहां सुरक्षित दिखेगा।"
                  : "Inspect a UPI or web QR image above to log verified payee and risk details here."
              }
            />
          ) : (
            <div className="divide-y divide-[#C6A15B]/15">
              {qrHistory.slice(0, 6).map((q) => (
                <div key={q.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-[#F4F0E6] truncate">
                      {q.payee_name || q.upi_id || q.qr_format}
                    </p>
                    <p className="text-[#AEBBC9]">
                      {q.security_risk_level} · {q.qr_format} · Load {q.payment_load_category}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-medium text-[#6CC4E8] shrink-0">
                    {q.amount ? `₹${Number(q.amount).toLocaleString("en-IN")}` : "Open"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
