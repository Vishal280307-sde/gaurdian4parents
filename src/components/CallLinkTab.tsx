import React, { useState } from "react";
import {
  PhoneCall,
  PhoneIncoming,
  Link2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Info,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { SourceTransparencyPanel } from "./SourceTransparencyPanel";
import { SuspicionScoreCard } from "./SuspicionScoreCard";
import { EmergencyCallButton } from "./EmergencyBankCallModal";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import { EmptyStateCard } from "./VisualAsset";
import { ContextualAwarenessLinks } from "./ContextualAwarenessLinks";
import { Cybersecurity2D } from "./Illustrations2D";
import type { ScamAwarenessId } from "../data/awarenessContent";
import type {
  AiProviderId,
  AppStatePayload,
  CallRiskClassification,
  GuardianIntelContext,
  LangCode,
  SourceCheckEntry,
  SuspicionAssessment,
  VoiceLangCode,
} from "../types/guardian";

interface CallLinkTabProps {
  state: AppStatePayload;
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  aiProvider?: AiProviderId;
  onRefresh: () => Promise<void>;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
  onIntelContextChange?: (ctx: GuardianIntelContext) => void;
}

interface LinkAnalysis {
  normalizedUrl: string;
  domain: string;
  riskScore: number;
  riskLevel: string;
  signals: string[];
  summary: string;
  sourceChecks?: SourceCheckEntry[];
  suspicionAssessment?: SuspicionAssessment;
}

interface ScreeningVerdictState {
  callId?: string;
  verdict: string;
  riskClassification: CallRiskClassification;
  riskScore?: number;
  callerMasked: string;
  reason: string;
  reasonHi?: string;
  latencyMs: number;
  alertTriggered?: boolean;
  sourceChecks?: SourceCheckEntry[];
  suspicionAssessment?: SuspicionAssessment;
}

function getRiskBannerColors(risk: CallRiskClassification) {
  switch (risk) {
    case "HIGH RISK":
      return {
        text: "text-[#E87575]",
        border: "border-[#E87575]/45",
        Icon: ShieldAlert,
      };
    case "CAUTION":
      return {
        text: "text-[#E6C98A]",
        border: "border-[#E6C98A]/45",
        Icon: AlertTriangle,
      };
    case "NO KNOWN THREAT DETECTED":
      return {
        text: "text-[#43C6A5]",
        border: "border-[#43C6A5]/38",
        Icon: Info,
      };
    case "UNKNOWN NUMBER":
    default:
      return {
        text: "text-[#C6A15B]",
        border: "border-[#C6A15B]/45",
        Icon: Info,
      };
  }
}

export const CallLinkTab: React.FC<CallLinkTabProps> = ({
  state,
  lang,
  voiceLang = lang,
  aiProvider = "gemini",
  onRefresh,
  onOpenAwareness,
  onIntelContextChange,
}) => {
  const { openEmergencyCall } = useEmergencyCall();
  const isParent = state.user.role === "parent";
  const cw = state.callWatcher;
  const autoEnabled = Boolean(cw?.summary?.autoDetectionEnabled ?? cw?.settings?.consent_status === "active");

  const [callerNumber, setCallerNumber] = useState("+919820099111");
  const [callerType, setCallerType] = useState<"Unknown Number" | "Known Contact">("Unknown Number");
  const [screenVerdict, setScreenVerdict] = useState<ScreeningVerdictState | null>(null);
  const [callAiExplain, setCallAiExplain] = useState<{ explanation: string; nextSteps: string[] } | null>(null);
  const [callAiBusy, setCallAiBusy] = useState(false);
  const [callAiErr, setCallAiErr] = useState<string | null>(null);
  const [paymentMsg, setPaymentMsg] = useState("Rs. 14,500 debited via UPI collect request to kyc-help@okaxis");
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const [busyCall, setBusyCall] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const [urlInput, setUrlInput] = useState("http://sbi-kyc-update.xyz/verify-pan");
  const [linkResult, setLinkResult] = useState<LinkAnalysis | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busyLink, setBusyLink] = useState(false);
  const [linkAiExplain, setLinkAiExplain] = useState<{ explanation: string; nextSteps: string[] } | null>(null);
  const [linkAiBusy, setLinkAiBusy] = useState(false);
  const [linkAiErr, setLinkAiErr] = useState<string | null>(null);

  async function toggleAutoDetection() {
    if (!isParent) return;
    setCallNotice(null);
    setTogglingAuto(true);
    try {
      await apiFetch("/api/call-watcher/consent", {
        method: "POST",
        body: JSON.stringify({ action: autoEnabled ? "pause" : "activate" }),
      });
      setCallNotice(
        autoEnabled
          ? lang === "hi"
            ? "स्वचालित पृष्ठभूमि कॉल पहचान बंद (OFF) की गई।"
            : "Automatic background call detection turned OFF."
          : lang === "hi"
            ? "स्वचालित पृष्ठभूमि कॉल पहचान चालू (ON) की गई — केवल मेटाडेटा, कोई ऑडियो नहीं।"
            : "Automatic background call detection turned ON — metadata only, zero audio recording."
      );
      await onRefresh();
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Could not update automatic call detection.");
    } finally {
      setTogglingAuto(false);
    }
  }

  async function runScreenCaller() {
    setCallNotice(null);
    setCallAiExplain(null);
    setCallAiErr(null);
    setBusyCall(true);
    try {
      const res = await apiFetch<ScreeningVerdictState>("/api/call-watcher/screen", {
        method: "POST",
        body: JSON.stringify({
          callerIdentifier: callerNumber,
          callerClassification: callerType,
          callScreeningRoleGranted: true,
        }),
      });
      setScreenVerdict(res);
      onIntelContextChange?.({
        activeSection: "Phone Fraud Detection",
        contextType: "phone_fraud",
        summary: `Caller ${res.callerMasked}: ${res.riskClassification} (${res.suspicionAssessment?.score ?? res.riskScore ?? 0}/100). ${res.reason}`,
        score: res.suspicionAssessment?.score ?? res.riskScore,
        riskLevel: res.suspicionAssessment?.riskLevel ?? res.riskClassification,
        verificationStatus: res.suspicionAssessment?.verificationStatus,
        signals: [res.reason],
        sourcesUnavailable: res.suspicionAssessment?.sourcesUnavailable,
      });
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Could not screen caller.");
    } finally {
      setBusyCall(false);
    }
  }

  async function simulateIncomingBackgroundCall() {
    setCallNotice(null);
    setCallAiExplain(null);
    setCallAiErr(null);
    setBusyCall(true);
    try {
      const res = await apiFetch<{
        skipped: boolean;
        reason?: string;
        screening?: ScreeningVerdictState;
        call?: { id: string };
        alertTriggered?: boolean;
      }>("/api/call-watcher/incoming-auto", {
        method: "POST",
        body: JSON.stringify({
          callerIdentifier: callerNumber,
          callerClassification: callerType,
          callScreeningRoleGranted: true,
          source: "background_call_screening",
          lang,
        }),
      });
      if (res.skipped || !res.screening) {
        setCallNotice(res.reason || "Automatic background call detection is OFF.");
      } else {
        const mergedVerdict: ScreeningVerdictState = {
          ...res.screening,
          callId: res.call?.id,
          alertTriggered: res.alertTriggered,
        };
        setScreenVerdict(mergedVerdict);
        onIntelContextChange?.({
          activeSection: "Phone Fraud Detection",
          contextType: "phone_fraud",
          summary: `Incoming call ${mergedVerdict.callerMasked}: ${mergedVerdict.riskClassification} (${mergedVerdict.suspicionAssessment?.score ?? mergedVerdict.riskScore ?? 0}/100). ${mergedVerdict.reason}`,
          score: mergedVerdict.suspicionAssessment?.score ?? mergedVerdict.riskScore,
          riskLevel: mergedVerdict.suspicionAssessment?.riskLevel ?? mergedVerdict.riskClassification,
          verificationStatus: mergedVerdict.suspicionAssessment?.verificationStatus,
          signals: [mergedVerdict.reason],
          sourcesUnavailable: mergedVerdict.suspicionAssessment?.sourcesUnavailable,
        });
        if (res.alertTriggered) {
          setCallNotice(
            lang === "hi"
              ? "इनकमिंग कॉल चेतावनी सूचना बनाई गई — आप नीचे कॉल स्वीकार, अस्वीकार या ब्लॉक/फ़्लैग कर सकते हैं।"
              : "Incoming-call warning alert generated — choose below whether to answer safely, reject, or block & flag."
          );
        }
        await onRefresh();
      }
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Background call screening failed.");
    } finally {
      setBusyCall(false);
    }
  }

  async function applyDecision(decision: "answer_caution" | "reject" | "block_and_flag") {
    if (!screenVerdict) return;
    setBusyCall(true);
    setCallNotice(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/api/call-watcher/user-action", {
        method: "POST",
        body: JSON.stringify({
          callId: screenVerdict.callId,
          callerIdentifier: callerNumber,
          decision,
          lang,
        }),
      });
      setCallNotice(res.message);
      await onRefresh();
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Could not save call decision.");
    } finally {
      setBusyCall(false);
    }
  }

  async function explainCallerWithAi() {
    if (!screenVerdict) return;
    setCallAiErr(null);
    setCallAiBusy(true);
    try {
      const res = await apiFetch<{ explanation: string; nextSteps: string[] }>("/api/ai/explain", {
        method: "POST",
        body: JSON.stringify({
          text: `Caller classification: ${callerType}, Risk classification: ${screenVerdict.riskClassification}, Screening verdict: ${screenVerdict.verdict} (Metadata-only screening; no call audio or transcript)`,
          signals: [screenVerdict.reason],
          findings: [`Risk Classification: ${screenVerdict.riskClassification}`, screenVerdict.reason],
          score: screenVerdict.suspicionAssessment?.score ?? screenVerdict.riskScore,
          riskLevel: screenVerdict.suspicionAssessment?.riskLevel,
          verificationStatus: screenVerdict.suspicionAssessment?.verificationStatus,
          indicators: screenVerdict.suspicionAssessment?.indicators.map((i) => ({
            label: i.label,
            points: i.points,
            evidence: i.evidence,
            sourceName: i.sourceName,
            verified: i.verified,
          })),
          sourcesUnavailable: screenVerdict.suspicionAssessment?.sourcesUnavailable,
          sourceChecks: (screenVerdict.sourceChecks || []).map((s) => ({
            sourceName: s.sourceName,
            verificationStatus: s.verificationStatus,
            result: s.result,
            limitations: s.limitations,
          })),
          level:
            screenVerdict.suspicionAssessment?.riskLevel ||
            (screenVerdict.riskClassification === "HIGH RISK"
              ? "HIGH"
              : screenVerdict.riskClassification === "CAUTION" || screenVerdict.riskClassification === "UNKNOWN NUMBER"
                ? "MODERATE"
                : "LOW"),
          lang,
          voiceLang,
          provider: aiProvider,
          contextType: "phone_fraud_check",
        }),
      });
      setCallAiExplain(res);
    } catch (err) {
      setCallAiErr(err instanceof Error ? err.message : "AI explanation unavailable.");
    } finally {
      setCallAiBusy(false);
    }
  }

  async function logMetadataCall(durationMinutes: number) {
    setCallNotice(null);
    setBusyCall(true);
    const now = Date.now();
    try {
      await apiFetch("/api/call-watcher/calls", {
        method: "POST",
        body: JSON.stringify({
          callerIdentifier: callerNumber,
          callerClassification: callerType,
          callStatus: "Ended",
          incomingAt: now - durationMinutes * 60_000,
          endedAt: now,
          durationMs: durationMinutes * 60_000,
          screeningVerdict: screenVerdict?.verdict || "allow_caution",
          lang,
        }),
      });
      setCallNotice(
        durationMinutes >= 18
          ? lang === "hi"
            ? "18+ मिनट कॉल समय लॉग किया गया (कोई ऑडियो नहीं)। बिना भुगतान दबाव के लंबी कॉल LOW जोखिम में रहती है।"
            : "Logged 18-minute call timing (no audio). Isolated long calls stay LOW risk without payment pressure."
          : lang === "hi"
            ? "कॉल समय मेटाडेटा लॉग किया गया (कोई ऑडियो रिकॉर्ड नहीं)।"
            : "Logged call timing metadata (no audio recorded)."
      );
      await onRefresh();
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Failed to log call.");
    } finally {
      setBusyCall(false);
    }
  }

  async function logPaymentMessageCorrelation() {
    setCallNotice(null);
    setBusyCall(true);
    try {
      const res = await apiFetch<{ correlation: { summary: string } | null }>("/api/call-watcher/payment-message", {
        method: "POST",
        body: JSON.stringify({
          rawMessageText: paymentMsg,
          senderLabel: "Bank SMS",
          lang,
        }),
      });
      setCallNotice(
        res.correlation
          ? `${lang === "hi" ? "समय सहसंबंध मिला:" : "Correlation detected:"} ${res.correlation.summary}`
          : lang === "hi"
            ? "भुगतान सूचना सुरक्षित रूप से दर्ज की गई।"
            : "Payment alert recorded safely."
      );
      await onRefresh();
    } catch (err) {
      setCallNotice(err instanceof Error ? err.message : "Failed to log payment message.");
    } finally {
      setBusyCall(false);
    }
  }

  async function markTrustedCaller() {
    const res = await apiFetch<{ safeguardReminder: string }>("/api/call-watcher/trusted", {
      method: "POST",
      body: JSON.stringify({ callerIdentifier: callerNumber }),
    });
    setCallNotice(res.safeguardReminder);
    await onRefresh();
  }

  async function notifyGuardianNow() {
    const res = await apiFetch<{ ok: boolean; sentCount: number; message?: string }>("/api/call-watcher/notify-guardian", {
      method: "POST",
      body: JSON.stringify({
        message: "Parent requested a quick check on a recent unknown phone call.",
      }),
    });
    setCallNotice(res.ok ? `Notified ${res.sentCount} linked guardian(s).` : res.message || "No linked guardian.");
    await onRefresh();
  }

  async function runLinkInspect() {
    setLinkError(null);
    setLinkAiExplain(null);
    setLinkAiErr(null);
    setBusyLink(true);
    try {
      const res = await apiFetch<{ linkAnalysis: LinkAnalysis }>("/api/gsi/links/analyze", {
        method: "POST",
        body: JSON.stringify({
          url: urlInput,
          recordEvent: isParent,
          lang,
        }),
      });
      setLinkResult(res.linkAnalysis);
      onIntelContextChange?.({
        activeSection: "Link & URL Phishing Inspector",
        contextType: "url",
        summary: `Domain ${res.linkAnalysis.domain}: ${res.linkAnalysis.riskLevel} (${res.linkAnalysis.suspicionAssessment?.score ?? res.linkAnalysis.riskScore}/100). ${res.linkAnalysis.summary}`,
        score: res.linkAnalysis.suspicionAssessment?.score ?? res.linkAnalysis.riskScore,
        riskLevel: res.linkAnalysis.suspicionAssessment?.riskLevel ?? res.linkAnalysis.riskLevel,
        verificationStatus: res.linkAnalysis.suspicionAssessment?.verificationStatus,
        signals: res.linkAnalysis.signals,
        sourcesUnavailable: res.linkAnalysis.suspicionAssessment?.sourcesUnavailable,
      });
      await onRefresh();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Link analysis failed.");
    } finally {
      setBusyLink(false);
    }
  }

  async function explainLinkWithAi() {
    if (!linkResult) return;
    setLinkAiErr(null);
    setLinkAiBusy(true);
    try {
      const res = await apiFetch<{ explanation: string; nextSteps: string[] }>("/api/ai/explain", {
        method: "POST",
        body: JSON.stringify({
          text: `Domain: ${linkResult.domain}, URL summary: ${linkResult.summary}`,
          signals: linkResult.signals,
          findings: linkResult.signals,
          score: linkResult.suspicionAssessment?.score ?? linkResult.riskScore,
          riskLevel: linkResult.suspicionAssessment?.riskLevel ?? linkResult.riskLevel,
          verificationStatus: linkResult.suspicionAssessment?.verificationStatus,
          indicators: linkResult.suspicionAssessment?.indicators.map((i) => ({
            label: i.label,
            points: i.points,
            evidence: i.evidence,
            sourceName: i.sourceName,
            verified: i.verified,
          })),
          sourcesUnavailable: linkResult.suspicionAssessment?.sourcesUnavailable,
          sourceChecks: (linkResult.sourceChecks || []).map((s) => ({
            sourceName: s.sourceName,
            verificationStatus: s.verificationStatus,
            result: s.result,
            limitations: s.limitations,
          })),
          level: linkResult.suspicionAssessment?.riskLevel ?? linkResult.riskLevel,
          lang,
          voiceLang,
          provider: aiProvider,
          contextType: "url_phishing_analysis",
        }),
      });
      setLinkAiExplain(res);
    } catch (err) {
      setLinkAiErr(err instanceof Error ? err.message : "AI explanation unavailable.");
    } finally {
      setLinkAiBusy(false);
    }
  }

  async function updateIncidentAction(incidentId: string, action: "acknowledge" | "resolve" | "false_positive") {
    await apiFetch(`/api/gsi/incidents/${incidentId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    await onRefresh();
  }

  const gsiIncidents = isParent ? state.gsi?.incidents || [] : state.linkedGsiOverview?.incidents || [];
  const androidArch = cw?.summary?.androidArchitecture;

  const inputCls =
    "w-full rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]";
  const primaryBtn =
    "min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]";
  const secondaryBtn =
    "min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 text-xs font-semibold text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0";

  const riskMeta = screenVerdict ? getRiskBannerColors(screenVerdict.riskClassification) : null;

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionReveal} className="space-y-6">
      {/* Privacy Guarantee & Android CallScreeningService Architecture Banner */}
      <div className="rounded-2xl p-5 bg-[#10243A]/92 border border-[#AEBBC9]/35 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-[0_14px_34px_-14px_rgba(3,8,18,0.85)]">
        <div className="flex items-start sm:items-center gap-4 max-w-3xl">
          <Cybersecurity2D
            className="hidden sm:block w-16 h-16 shrink-0"
            title={
              lang === "hi"
                ? "फ़ोन धोखाधड़ी पहचान और इनकमिंग कॉल सुरक्षा चित्रण"
                : "Smartphone incoming call fraud detection and caller screening visual"
            }
          />
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F0E6]">
              <Lock className="w-4 h-4 text-[#43C6A5] shrink-0" />
              <span>
                {lang === "hi"
                  ? "गोपनीयता-प्रथम स्वचालित कॉल जांच: शून्य माइक्रोफ़ोन, शून्य ऑडियो रिकॉर्डिंग"
                  : "Privacy-First Automatic Call Screening: Zero Microphone, Zero Audio Recording"}
              </span>
            </div>
            <p className="text-xs text-[#AEBBC9] leading-relaxed">
              {lang === "hi"
                ? androidArch?.limitationNoticeHi ||
                  "यह सिस्टम कभी बातचीत नहीं सुनता, रिकॉर्ड नहीं करता या AI पर ऑडियो नहीं भेजता। Android 10+ पर यह CallScreeningService (केवल नंबर मेटाडेटा) का उपयोग करता है।"
                : androidArch?.limitationNotice ||
                  "Never activates the microphone, never records or transcribes conversations, and never sends audio externally. On Android 10+, background screening uses CallScreeningService (metadata only) subject to user role approval and device battery rules."}
            </p>
          </div>
        </div>

        {isParent && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={togglingAuto}
              onClick={toggleAutoDetection}
              className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                autoEnabled
                  ? "gm-gold-btn border-transparent"
                  : "bg-[#10243A] text-[#AEBBC9] border-[#C6A15B]/30 hover:border-[#E6C98A]"
              }`}
            >
              {lang === "hi"
                ? `स्वचालित कॉल जांच: ${autoEnabled ? "ON (चालू)" : "OFF (बंद)"}`
                : `Automatic Detection: ${autoEnabled ? "ON" : "OFF"}`}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Phone Fraud Detection & Incoming Call Screening */}
        <div className="lg:col-span-6 gp-card rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[#E6C98A]" />
                <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi"
                    ? "इनकमिंग कॉल जोखिम जांच व समय सुरक्षा"
                    : "Incoming Call Screening & Timing Watch"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#AEBBC9]">
                {lang === "hi"
                  ? "उपलब्ध नंबर प्रतिष्ठा व कॉल पैटर्न मेटाडेटा से तुरंत जोखिम श्रेणी दिखाता है।"
                  : "Evaluates incoming caller number metadata & threat intelligence without interrupting calls."}
              </p>
            </div>
            {isParent && cw && (
              <span className="text-xs font-semibold text-[#E6C98A] shrink-0">
                {cw.settings.protectionStatus}
              </span>
            )}
          </div>

          {isParent ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#AEBBC9]">
                  {lang === "hi" ? "नमूना जांच:" : "Sample callers:"}
                </span>
                {[
                  {
                    label: lang === "hi" ? "फ़्लैग नंबर (उच्च जोखिम)" : "Flagged Fraud",
                    num: "+919820099111",
                    cls: "Unknown Number" as const,
                  },
                  {
                    label: lang === "hi" ? "140 टेलीमार्केटर" : "140 Telemarketer",
                    num: "1408801234",
                    cls: "Unknown Number" as const,
                  },
                  {
                    label: lang === "hi" ? "अज्ञात नंबर" : "Unknown Number",
                    num: "+919820011223",
                    cls: "Unknown Number" as const,
                  },
                  {
                    label: lang === "hi" ? "सहेजा संपर्क" : "Saved Family",
                    num: "+919811100222",
                    cls: "Known Contact" as const,
                  },
                ].map((preset) => (
                  <button
                    key={preset.num}
                    type="button"
                    onClick={() => {
                      setCallerNumber(preset.num);
                      setCallerType(preset.cls);
                    }}
                    className="px-2.5 py-1 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 hover:border-[#E6C98A] text-[11px] font-medium text-[#F4F0E6] transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E6C98A] mb-1">
                    {lang === "hi" ? "इनकमिंग फ़ोन नंबर (हैश व मास्क्ड)" : "Incoming Number (Hashed & Masked)"}
                  </label>
                  <input
                    type="text"
                    value={callerNumber}
                    onChange={(e) => setCallerNumber(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#E6C98A] mb-1">
                    {lang === "hi" ? "कॉलर श्रेणी" : "Caller Classification"}
                  </label>
                  <select
                    value={callerType}
                    onChange={(e) => setCallerType(e.target.value as "Unknown Number" | "Known Contact")}
                    className={inputCls}
                  >
                    <option value="Unknown Number">{lang === "hi" ? "अज्ञात नंबर" : "Unknown Number"}</option>
                    <option value="Known Contact">{lang === "hi" ? "ज्ञात संपर्क" : "Known Contact"}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyCall}
                  onClick={simulateIncomingBackgroundCall}
                  className={primaryBtn}
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  {lang === "hi" ? "ऑटो इनकमिंग कॉल जांचें" : "Simulate Background Incoming Call"}
                </button>
                <button type="button" disabled={busyCall} onClick={runScreenCaller} className={secondaryBtn}>
                  {lang === "hi" ? "त्वरित नंबर जांच" : "Quick Number Lookup"}
                </button>
                <button
                  type="button"
                  disabled={busyCall}
                  onClick={() => logMetadataCall(19)}
                  className={secondaryBtn}
                >
                  {lang === "hi" ? "19 मिनट एकल कॉल जांचें" : "Test 19m Isolated Call"}
                </button>
              </div>

              {screenVerdict && riskMeta && (
                <div className="space-y-3">
                  {screenVerdict.suspicionAssessment ? (
                    <SuspicionScoreCard
                      assessment={screenVerdict.suspicionAssessment}
                      lang={lang}
                      onExplainAi={explainCallerWithAi}
                      aiBusy={callAiBusy}
                      aiExplain={callAiExplain}
                      aiError={callAiErr}
                      onOpenAwareness={onOpenAwareness}
                    />
                  ) : (
                    <div
                      className={`p-4 rounded-xl bg-[#10243A]/85 border ${riskMeta.border} text-xs space-y-2.5`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-sm ${riskMeta.text}`}>
                          {screenVerdict.riskClassification}
                        </span>
                        <span className="font-mono tabular-nums text-[#E6C98A]">
                          {screenVerdict.latencyMs}ms
                        </span>
                      </div>
                      <p className="text-[#F4F0E6]">
                        {lang === "hi" && screenVerdict.reasonHi ? screenVerdict.reasonHi : screenVerdict.reason}
                      </p>
                      {screenVerdict.riskClassification === "HIGH RISK" && (
                        <EmergencyCallButton
                          compact
                          lang={lang}
                          onClick={() =>
                            openEmergencyCall({
                              source: "fraud_result",
                              threatCategory: "Phone Fraud Detection",
                              riskLevel: "HIGH RISK",
                              score: screenVerdict.riskScore,
                              reason: screenVerdict.reason,
                              reasonHi: screenVerdict.reasonHi,
                              incidentDescription: `${screenVerdict.callerMasked} — ${screenVerdict.reason}`,
                              suggestedAction:
                                "Received a high-risk suspected fraud call. Please check for unauthorized account changes or transfers.",
                            })
                          }
                        />
                      )}
                    </div>
                  )}

                  <ContextualAwarenessLinks
                    context="phone"
                    scamCardId="fake_bank_call"
                    lang={lang}
                    onOpenAwareness={onOpenAwareness}
                    compact
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyCall}
                      onClick={() => applyDecision("answer_caution")}
                      className={secondaryBtn}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#43C6A5]" />
                      {lang === "hi" ? "सावधानी से उत्तर दें" : "Answer Safely"}
                    </button>
                    <button
                      type="button"
                      disabled={busyCall}
                      onClick={() => applyDecision("reject")}
                      className={secondaryBtn}
                    >
                      <XCircle className="w-3.5 h-3.5 text-[#E6C98A]" />
                      {lang === "hi" ? "कॉल अस्वीकार करें" : "Reject Call"}
                    </button>
                    <button
                      type="button"
                      disabled={busyCall}
                      onClick={() => applyDecision("block_and_flag")}
                      className={secondaryBtn}
                    >
                      <Ban className="w-3.5 h-3.5 text-[#E87575]" />
                      {lang === "hi" ? "ब्लॉक व फ़्लैग करें" : "Block & Flag Number"}
                    </button>
                  </div>

                  {screenVerdict.sourceChecks && (
                    <SourceTransparencyPanel sources={screenVerdict.sourceChecks} lang={lang} />
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-[#C6A15B]/20 space-y-3">
                <label className="block text-xs font-semibold text-[#E6C98A]">
                  {lang === "hi"
                    ? "कॉल के दौरान/बाद प्राप्त भुगतान संदेश का सहसंबंध जांचें"
                    : "Simulate Payment Alert Received During/After Call"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentMsg}
                    onChange={(e) => setPaymentMsg(e.target.value)}
                    className="flex-1 rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3 py-2 text-xs text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
                  />
                  <button
                    type="button"
                    disabled={busyCall}
                    onClick={logPaymentMessageCorrelation}
                    className={primaryBtn}
                  >
                    {lang === "hi" ? "सहसंबंध जांचें" : "Correlate"}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#C6A15B]/20 flex flex-wrap gap-2">
                <button type="button" onClick={markTrustedCaller} className={secondaryBtn}>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#43C6A5]" />
                  {lang === "hi" ? "कॉलर को विश्वसनीय मानें" : "Mark Caller Trusted"}
                </button>
                <button type="button" onClick={notifyGuardianNow} className={secondaryBtn}>
                  {lang === "hi" ? "अभिभावक को सूचित करें" : "Notify Linked Guardian"}
                </button>
              </div>

              {callNotice && <p className="text-xs font-medium text-[#E6C98A]">{callNotice}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#AEBBC9]">
                {lang === "hi"
                  ? "जुड़े माता-पिता के साझा कॉल-भुगतान समय अलर्ट (कोई ऑडियो साझा नहीं)।"
                  : "Showing shared call-payment timing correlations for linked parents (zero audio shared)."}
              </p>
              {(state.linkedCallWatcherEvents || []).length === 0 ? (
                <EmptyStateCard
                  compact
                  title={lang === "hi" ? "कोई कॉल अलर्ट नहीं" : "No Shared Call Alerts"}
                  description={
                    lang === "hi"
                      ? "जुड़े माता-पिता के कॉल-भुगतान समय अलर्ट (बिना ऑडियो) यहां दिखेंगे।"
                      : "Shared call-payment timing alerts from linked parents will appear here."
                  }
                />
              ) : (
                (state.linkedCallWatcherEvents || []).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-[#10243A]/85 border border-[#C6A15B]/25 text-xs"
                  >
                    <p className="font-semibold text-[#F4F0E6]">
                      {ev.parentName} · Score {ev.combined_risk_score}/100
                    </p>
                    <p className="mt-1 text-[#AEBBC9]">{ev.summary}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Link & Domain Phishing Inspector */}
        <div className="lg:col-span-6 gp-card rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#E6C98A]" />
              <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                {lang === "hi" ? "लिंक व डोमेन फ़िशिंग इंस्पेक्टर" : "Link & Domain Phishing Inspector"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "URL खोले बिना नकली डोमेन, शॉर्टनर, IP लिंक और APK जाल की जांच करता है।"
                : "Checks domain impersonation, URL shorteners, raw IP links, and APK traps safely without opening the URL."}
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/..."
              className="flex-1 rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3.5 py-2 text-sm font-mono text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]"
            />
            <button type="button" disabled={busyLink} onClick={runLinkInspect} className={primaryBtn}>
              {busyLink
                ? lang === "hi"
                  ? "जांच जारी..."
                  : "Checking..."
                : lang === "hi"
                  ? "URL जांचें"
                  : "Inspect URL"}
            </button>
          </div>

          {linkError && <p className="text-xs text-[#E87575]">{linkError}</p>}

          {linkResult && (
            <div className="space-y-3">
              {linkResult.suspicionAssessment ? (
                <SuspicionScoreCard
                  assessment={linkResult.suspicionAssessment}
                  lang={lang}
                  onExplainAi={explainLinkWithAi}
                  aiBusy={linkAiBusy}
                  aiExplain={linkAiExplain}
                  aiError={linkAiErr}
                  onOpenAwareness={onOpenAwareness}
                />
              ) : (
                <div className="p-4 rounded-xl bg-[#10243A]/85 border border-[#C6A15B]/30 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#F4F0E6]">
                      {linkResult.riskLevel} · {linkResult.domain}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-[#AEBBC9]">
                      {linkResult.riskScore} / 100
                    </span>
                  </div>
                  <p className="text-sm text-[#F4F0E6]">{linkResult.summary}</p>
                </div>
              )}
              <ContextualAwarenessLinks
                context="url"
                scamCardId="phishing"
                lang={lang}
                onOpenAwareness={onOpenAwareness}
                compact
              />
              {linkResult.sourceChecks && linkResult.sourceChecks.length > 0 && (
                <SourceTransparencyPanel sources={linkResult.sourceChecks} lang={lang} />
              )}
            </div>
          )}

          {isParent && cw && (
            <div className="pt-4 border-t border-[#C6A15B]/20 space-y-3">
              <h3 className="text-xs font-semibold text-[#F4F0E6]">
                {lang === "hi" ? "हालिया कॉल स्क्रीनिंग व समय सहसंबंध" : "Recent Screened Calls & Correlations"}
              </h3>
              {cw.calls.length === 0 ? (
                <EmptyStateCard
                  compact
                  title={lang === "hi" ? "कोई कॉल लॉग नहीं" : "No Screened Calls Logged"}
                  description={
                    lang === "hi"
                      ? "ऑटो कॉल जांच या नंबर स्क्रीनिंग चलाने के बाद परिणाम यहां दिखेंगे।"
                      : "Run background incoming call screening or a number lookup to see verdicts here."
                  }
                />
              ) : (
                <div className="divide-y divide-[#C6A15B]/15 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/70">
                  {cw.calls.slice(0, 5).map((c) => (
                    <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-[#F4F0E6]">
                          {c.caller_masked} ·{" "}
                          <span
                            className={
                              c.screening_verdict === "allow_with_warning"
                                ? "text-[#E87575]"
                                : c.screening_verdict === "allow_caution"
                                  ? "text-[#E6C98A]"
                                  : "text-[#43C6A5]"
                            }
                          >
                            {c.screening_verdict === "allow_with_warning"
                              ? "HIGH RISK"
                              : c.screening_verdict === "allow_caution"
                                ? "CAUTION / UNKNOWN"
                                : "NO MATCH FOUND"}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#AEBBC9] truncate">
                          {c.call_status} · {c.caller_classification}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-[#C6A15B] shrink-0">
                        {new Date(c.incoming_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {cw.correlations.length > 0 && (
                <div className="space-y-2 pt-2">
                  {cw.correlations.slice(0, 3).map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-[#10243A]/80 border border-[#C6A15B]/25 text-xs">
                      <p className="font-semibold text-[#F4F0E6]">
                        Score {c.combined_risk_score}/100 · {c.during_call ? "During Call" : "Post-Call"}
                      </p>
                      <p className="mt-0.5 text-[#AEBBC9]">{c.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GSI Incident Workflow Table */}
      <div className="gp-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#E6C98A]" />
          <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
            {lang === "hi"
              ? "गार्जियन सुरक्षा इंटेलिजेंस घटनाएं"
              : "Guardian Security Intelligence Incidents"}
          </h2>
        </div>

        {gsiIncidents.length === 0 ? (
          <EmptyStateCard
            compact
            title={lang === "hi" ? "कोई सुरक्षा घटना नहीं" : "No Active Security Incidents"}
            description={
              lang === "hi"
                ? "संदिग्ध लिंक, कॉल या QR जोखिम मिलने पर वे समीक्षा के लिए यहां सूचीबद्ध होंगे।"
                : "Suspicious links, flagged callers, and QR risk incidents will be tracked here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#C6A15B]/20 text-[#AEBBC9]">
                  <th className="py-2 pr-4 font-semibold">{lang === "hi" ? "श्रेणी" : "Category"}</th>
                  <th className="py-2 pr-4 font-semibold">{lang === "hi" ? "सारांश" : "Summary"}</th>
                  <th className="py-2 pr-4 font-semibold text-right">{lang === "hi" ? "स्कोर" : "Score"}</th>
                  <th className="py-2 pr-4 font-semibold">{lang === "hi" ? "स्थिति" : "Status"}</th>
                  <th className="py-2 font-semibold text-right">{lang === "hi" ? "कार्रवाई" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C6A15B]/15">
                {gsiIncidents.slice(0, 8).map((inc) => (
                  <tr key={inc.incident_id} className="hover:bg-[#252A32]/65 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-[#F4F0E6] whitespace-nowrap">
                      {inc.incident_category}
                    </td>
                    <td className="py-2.5 pr-4 text-[#AEBBC9] max-w-md truncate">{inc.reasoning_summary}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-[#E6C98A] whitespace-nowrap">
                      {inc.risk_score} / 100
                    </td>
                    <td className="py-2.5 pr-4 text-[#AEBBC9] whitespace-nowrap">
                      {inc.alert_level} · {inc.workflow_status}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap space-x-3">
                      <button
                        type="button"
                        onClick={() => updateIncidentAction(inc.incident_id, "acknowledge")}
                        className="font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                      >
                        {lang === "hi" ? "स्वीकारें" : "Acknowledge"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateIncidentAction(inc.incident_id, "resolve")}
                        className="text-[#F4F0E6] hover:underline cursor-pointer"
                      >
                        {lang === "hi" ? "समाधान" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateIncidentAction(inc.incident_id, "false_positive")}
                        className="text-[#AEBBC9] hover:underline cursor-pointer"
                      >
                        {lang === "hi" ? "नोटेड" : "Dismiss"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
