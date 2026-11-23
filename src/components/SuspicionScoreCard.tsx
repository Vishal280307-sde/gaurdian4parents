import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Info,
  ServerOff,
  HelpCircle,
  SearchCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { EmergencyCallButton } from "./EmergencyBankCallModal";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import { VisualRiskAlert } from "./VisualRiskAlert";
import { ContextualAwarenessLinks } from "./ContextualAwarenessLinks";
import type { ScamAwarenessId } from "../data/awarenessContent";
import type { LangCode, SuspicionAssessment, TransparencyStatus } from "../types/guardian";

interface SuspicionScoreCardProps {
  assessment: SuspicionAssessment;
  lang: LangCode;
  onExplainAi?: () => void;
  aiBusy?: boolean;
  aiExplain?: { explanation: string; nextSteps: string[] } | null;
  aiError?: string | null;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
  defaultShowTechnical?: boolean;
}

function getRiskPalette(level: SuspicionAssessment["riskLevel"]) {
  if (level === "HIGH") {
    return {
      stroke: "#E87575",
      barBg: "bg-[#E87575]",
      textColor: "text-[#E87575]",
      borderColor: "border-[#E87575]/45",
      Icon: ShieldAlert,
    };
  }
  if (level === "MODERATE") {
    return {
      stroke: "#E6C98A",
      barBg: "bg-[#E6C98A]",
      textColor: "text-[#E6C98A]",
      borderColor: "border-[#E6C98A]/45",
      Icon: AlertTriangle,
    };
  }
  return {
    stroke: "#43C6A5",
    barBg: "bg-[#43C6A5]",
    textColor: "text-[#43C6A5]",
    borderColor: "border-[#43C6A5]/45",
    Icon: SearchCheck,
  };
}

function getVerificationStateMeta(status: TransparencyStatus, lang: LangCode) {
  switch (status) {
    case "HIGH RISK":
      return {
        label: lang === "hi" ? "सत्यापित जोखिम मिलान (Verified Match)" : "Verified Match",
        text: "text-[#E87575]",
        surface: "bg-[#2E1219]/90 border-[#E87575]/40",
        Icon: ShieldAlert,
      };
    case "CAUTION":
      return {
        label: lang === "hi" ? "असत्यापित रिपोर्ट / सावधानी (Unverified Report)" : "Unverified Report / Caution",
        text: "text-[#E6C98A]",
        surface: "bg-[#2B2112]/90 border-[#E6C98A]/40",
        Icon: AlertTriangle,
      };
    case "MANUAL VERIFICATION REQUIRED":
      return {
        label: lang === "hi" ? "स्वयं पुष्टि आवश्यक (Manual Verification Required)" : "Manual Verification Required",
        text: "text-[#E6C98A]",
        surface: "bg-[#10243A]/85 border-[#C6A15B]/40",
        Icon: HelpCircle,
      };
    case "SOURCE UNAVAILABLE":
      return {
        label: lang === "hi" ? "स्रोत अनुपलब्ध (Source Unavailable)" : "Source Unavailable",
        text: "text-[#AEBBC9]",
        surface: "bg-[#252A32]/85 border-[#C6A15B]/25",
        Icon: ServerOff,
      };
    case "NO KNOWN THREAT DETECTED":
    default:
      return {
        label: lang === "hi" ? "कोई मिलान नहीं मिला (सुरक्षा की गारंटी नहीं)" : "No Match Found (Not a Guarantee)",
        text: "text-[#F4F0E6]",
        surface: "bg-[#10243A]/85 border-[#C6A15B]/28",
        Icon: Info,
      };
  }
}

export const SuspicionScoreCard: React.FC<SuspicionScoreCardProps> = ({
  assessment,
  lang,
  onExplainAi,
  aiBusy,
  aiExplain,
  aiError,
  onOpenAwareness,
  defaultShowTechnical = false,
}) => {
  const { openEmergencyCall } = useEmergencyCall();
  const [showTechnical, setShowTechnical] = useState(defaultShowTechnical);

  const palette = getRiskPalette(assessment.riskLevel);
  const vMeta = getVerificationStateMeta(assessment.verificationStatus, lang);
  const StatusIcon = palette.Icon;
  const VerifyIcon = vMeta.Icon;

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.max(0, Math.min(100, assessment.score)) / 100) * circumference;

  const sourceSummary =
    assessment.sourcesChecked.length > 0
      ? assessment.sourcesChecked.map((s) => (lang === "hi" ? s.sourceNameHi : s.sourceName)).join(", ")
      : lang === "hi"
        ? "स्थानीय संरचनात्मक जांच"
        : "Local structural inspection";

  const awarenessContext =
    assessment.category === "QR Intelligence"
      ? "qr"
      : assessment.category === "Phone Fraud Detection"
        ? "phone"
        : assessment.category === "Website and URL Analysis"
          ? "url"
          : "financial";

  const simpleReasonsEn =
    assessment.indicators.length > 0
      ? assessment.indicators.map((ind) => ind.label)
      : [assessment.mainReason];
  const simpleReasonsHi =
    assessment.indicators.length > 0
      ? assessment.indicators.map((ind) => ind.labelHi)
      : [assessment.mainReasonHi];

  return (
    <div className="space-y-4">
      <VisualRiskAlert
        level={assessment.riskLevel}
        score={assessment.score}
        categoryLabel={assessment.category}
        simpleSummaryEn={assessment.mainReason}
        simpleSummaryHi={assessment.mainReasonHi}
        reasonsEn={simpleReasonsEn}
        reasonsHi={simpleReasonsHi}
        stepsEn={assessment.recommendedActions}
        stepsHi={assessment.recommendedActionsHi}
        lang={lang}
        actionSlot={
          <>
            {onExplainAi && (
              <button
                type="button"
                disabled={aiBusy}
                onClick={onExplainAi}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/45 bg-[#10243A]/90 hover:border-[#E6C98A] text-xs font-bold text-[#E6C98A] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiBusy
                  ? lang === "hi"
                    ? "AI समझा रहा है..."
                    : "Explaining..."
                  : lang === "hi"
                    ? "AI से समझें"
                    : "Ask AI"}
              </button>
            )}
          </>
        }
        awarenessSlot={
          <ContextualAwarenessLinks
            context={awarenessContext}
            lang={lang}
            onOpenAwareness={onOpenAwareness}
            compact
          />
        }
      />

      {assessment.riskLevel === "HIGH" && (
        <div className="p-4 rounded-2xl bg-[#2E1219]/90 border border-[#E87575]/45 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-[#E87575]">
              {lang === "hi"
                ? "खतरा! क्या आपने पैसे भेजे या OTP/PIN बताया?"
                : "DANGER! Shared OTP, PIN, or Sent Money?"}
            </p>
            <p className="text-[#F4F0E6]">
              {lang === "hi"
                ? "तुरंत अपने सत्यापित बैंक को कॉल करके UPI और कार्ड सुरक्षित करें।"
                : "Call your verified bank helpline right now to protect your account."}
            </p>
          </div>
          <EmergencyCallButton
            compact
            lang={lang}
            className="shrink-0"
            onClick={() =>
              openEmergencyCall({
                source: "fraud_result",
                threatCategory: assessment.category,
                riskLevel: assessment.riskLabel,
                score: assessment.score,
                reason: assessment.mainReason,
                reasonHi: assessment.mainReasonHi,
                incidentDescription: `${assessment.maskedIdentifier} — ${assessment.mainReason}`,
                suggestedAction: `Detected high-risk ${assessment.category} (${assessment.score}/100). Please check for unauthorized activity and secure my UPI/debit card access if needed.`,
                suggestedActionHi: `उच्च-जोखिम ${assessment.category} (${assessment.score}/100) का पता चला। कृपया किसी अनधिकृत गतिविधि की जांच करें और आवश्यक होने पर UPI/डेबिट कार्ड सुरक्षित करें।`,
              })
            }
          />
        </div>
      )}

      {aiExplain && (
        <div className="rounded-2xl border border-[#C6A15B]/40 bg-[#0A192E]/90 backdrop-blur-md p-4 space-y-2">
          <p className="text-xs font-bold text-[#E6C98A]">
            {lang === "hi" ? "AI सरल व्याख्या" : "AI Plain-Language Summary"}
          </p>
          <p className="text-sm text-[#F4F0E6] leading-relaxed">{aiExplain.explanation}</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#AEBBC9]">
            {aiExplain.nextSteps.map((st, idx) => (
              <li key={idx}>{st}</li>
            ))}
          </ul>
        </div>
      )}

      {aiError && <p className="text-xs text-[#E6C98A]">{aiError}</p>}

      <div className="gp-card rounded-2xl">
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          aria-expanded={showTechnical}
          className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#F4F0E6] hover:bg-[#10243A]/70 rounded-2xl transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#E6C98A]" />
            <span>
              {lang === "hi"
                ? `तकनीकी विवरण व डेटा स्रोत (${assessment.score}/100)`
                : `Technical Details, Score & Sources (${assessment.score}/100)`}
            </span>
          </span>
          {showTechnical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTechnical && (
          <div className="p-5 pt-2 border-t border-[#C6A15B]/20 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" aria-hidden="true">
                    <circle
                      cx="44"
                      cy="44"
                      r={radius}
                      fill="none"
                      strokeWidth="7"
                      className="stroke-[#071525]"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r={radius}
                      fill="none"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      style={{ stroke: palette.stroke }}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-lg font-bold font-mono tabular-nums leading-none ${palette.textColor}`}>
                      {assessment.score}
                    </span>
                    <span className="text-[11px] font-mono text-[#AEBBC9] mt-0.5">/100</span>
                  </div>
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusIcon className={`w-4 h-4 shrink-0 ${palette.textColor}`} />
                    <span className={`text-sm font-bold ${palette.textColor}`}>
                      {assessment.score}/100 · {assessment.riskLabel}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#F4F0E6] break-all">
                    {assessment.category} · {assessment.maskedIdentifier}
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${vMeta.surface} grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs`}>
              <div className="flex items-start gap-2">
                <VerifyIcon className={`w-4 h-4 shrink-0 mt-0.5 ${vMeta.text}`} />
                <div>
                  <p className="text-[11px] text-[#AEBBC9]">
                    {lang === "hi" ? "सत्यापन स्थिति" : "Verification Status"}
                  </p>
                  <p className={`font-semibold ${vMeta.text}`}>{vMeta.label}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#AEBBC9]">
                  {lang === "hi" ? "जानकारी का स्रोत" : "Source of Information"}
                </p>
                <p className="font-medium text-[#F4F0E6]">{sourceSummary}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#AEBBC9]">
                <span>{lang === "hi" ? "जोखिम पैमाना" : "Risk Scale"}</span>
                <span className="font-mono tabular-nums">0–29 Low · 30–69 Moderate · 70–100 High</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden bg-[#071525]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${palette.barBg}`}
                  style={{ width: `${Math.max(assessment.score > 0 ? 4 : 0, assessment.score)}%` }}
                />
              </div>
            </div>

            {assessment.conflictingSources && (
              <div className="p-3.5 rounded-xl bg-[#2B2112]/90 border border-[#E6C98A]/35 text-xs text-[#F4F0E6] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E6C98A] shrink-0 mt-0.5" />
                <span>{lang === "hi" ? assessment.conflictNoteHi : assessment.conflictNote}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#C6A15B]/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-[#F4F0E6]">
                  {lang === "hi" ? "संदेह संकेत और साक्ष्य" : "Suspicious Indicators & Evidence"}
                </h4>
                {assessment.deduplicatedCount > 0 && (
                  <span className="text-xs text-[#E6C98A]">
                    {lang === "hi"
                      ? `${assessment.deduplicatedCount} दोहरी रिपोर्ट हटाई गईं`
                      : `${assessment.deduplicatedCount} duplicate indicator(s) collapsed`}
                  </span>
                )}
              </div>

              {assessment.indicators.length === 0 ? (
                <p className="text-xs text-[#AEBBC9]">
                  {lang === "hi"
                    ? "उपलब्ध स्रोतों में कोई ज्ञात धोखाधड़ी मिलान नहीं मिला (0/100)। यह पूर्ण सुरक्षा की गारंटी नहीं है।"
                    : "No match found across checked databases (score 0/100). This is never a guarantee of safety."}
                </p>
              ) : (
                <div className="divide-y divide-[#C6A15B]/15">
                  {assessment.indicators.map((ind) => (
                    <div key={ind.code} className="py-2.5 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#F4F0E6]">
                          {lang === "hi" ? ind.labelHi : ind.label}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#E6C98A]">
                          +{ind.points} pts ·{" "}
                          {ind.verified
                            ? lang === "hi"
                              ? "सत्यापित मिलान"
                              : "Verified Match"
                            : lang === "hi"
                              ? "असत्यापित रिपोर्ट"
                              : "Unverified Report"}
                        </span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-[#AEBBC9]">
                        {(lang === "hi" ? ind.evidenceHi : ind.evidence).map((ev, idx) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-[#AEBBC9]/85">
                        {lang === "hi" ? "स्रोत:" : "Source:"} {ind.sourceName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {assessment.sourcesUnavailable.length > 0 && (
              <div className="pt-3 border-t border-[#C6A15B]/20 text-xs flex items-start gap-2 text-[#AEBBC9]">
                <ServerOff className="w-4 h-4 text-[#AEBBC9] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F4F0E6]">
                    {lang === "hi" ? "स्रोत अनुपलब्ध (+0 अंक):" : "Source Unavailable (+0 pts):"}
                  </strong>{" "}
                  {assessment.sourcesUnavailable.join(", ")}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#C6A15B]/20 flex items-start gap-2 text-xs text-[#AEBBC9]">
              <Info className="w-3.5 h-3.5 text-[#E6C98A] shrink-0 mt-0.5" />
              <span>{lang === "hi" ? assessment.disclaimerHi : assessment.disclaimer}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
