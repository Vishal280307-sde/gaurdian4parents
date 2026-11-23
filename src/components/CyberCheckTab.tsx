import React, { useState } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { SourceTransparencyPanel } from "./SourceTransparencyPanel";
import { SuspicionScoreCard } from "./SuspicionScoreCard";
import { EmptyStateCard } from "./VisualAsset";
import { ContextualAwarenessLinks } from "./ContextualAwarenessLinks";
import { AiProviderSwitcher } from "./GeminiBadgeIcon";
import { CyberAwareness2D } from "./Illustrations2D";
import type { ScamAwarenessId } from "../data/awarenessContent";
import type {
  AiProviderId,
  CyberIdentifierType,
  CyberSafetyCheckResult,
  GuardianIntelContext,
  LangCode,
  VoiceLangCode,
} from "../types/guardian";

interface CyberCheckTabProps {
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  aiProvider?: AiProviderId;
  onChangeProvider?: (provider: AiProviderId) => void;
  isAuthenticated: boolean;
  onRefresh?: () => Promise<void>;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
  onIntelContextChange?: (ctx: GuardianIntelContext) => void;
}

const PRESETS: { type: CyberIdentifierType; label: string; labelHi: string; sample: string }[] = [
  { type: "mobile", label: "Mobile Number", labelHi: "मोबाइल नंबर", sample: "+919820011223" },
  { type: "email", label: "Email Address", labelHi: "ईमेल पता", sample: "kyc-verify@sbi-alerts-help.xyz" },
  { type: "upi", label: "UPI ID", labelHi: "UPI ID", sample: "cashback-refund@okaxis" },
  { type: "bank_account", label: "Bank Account / IFSC", labelHi: "बैंक खाता / IFSC", sample: "SBIN0001234 / 301122334455" },
  { type: "url", label: "Website URL", labelHi: "वेबसाइट URL", sample: "http://hdfc-pan-verify.xyz/login" },
];

export const CyberCheckTab: React.FC<CyberCheckTabProps> = ({
  lang,
  voiceLang = lang,
  aiProvider = "gemini",
  onChangeProvider,
  isAuthenticated,
  onRefresh,
  onOpenAwareness,
  onIntelContextChange,
}) => {
  const [localProvider, setLocalProvider] = useState<AiProviderId>(aiProvider);
  const activeProvider = onChangeProvider ? aiProvider : localProvider;
  const setProvider = onChangeProvider || setLocalProvider;

  const [identifierType, setIdentifierType] = useState<CyberIdentifierType>("upi");
  const [value, setValue] = useState("cashback-refund@okaxis");
  const [result, setResult] = useState<CyberSafetyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [aiExplain, setAiExplain] = useState<{ explanation: string; nextSteps: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function runCheck(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setAiExplain(null);
    setAiError(null);
    if (!value.trim()) {
      setError(
        lang === "hi"
          ? "जांचने के लिए मोबाइल नंबर, ईमेल, UPI ID, बैंक विवरण या URL दर्ज करें।"
          : "Enter a mobile number, email, UPI ID, bank identifier, or URL to check."
      );
      return;
    }

    setBusy(true);
    try {
      const endpoint = isAuthenticated ? "/api/cyber-check" : "/api/public/cyber-check";
      const data = await apiFetch<CyberSafetyCheckResult>(endpoint, {
        method: "POST",
        body: JSON.stringify({ identifierType, value }),
      });
      setResult(data);
      onIntelContextChange?.({
        activeSection: `Cyber Safety Check (${data.identifierType.toUpperCase()})`,
        contextType: "cyber_check",
        summary: `${data.identifierType}: ${data.maskedValue} -> ${data.overallStatus} (${data.suspicionAssessment?.score ?? data.riskScore}/100). ${data.findings.slice(0, 2).join(" | ")}`,
        score: data.suspicionAssessment?.score ?? data.riskScore,
        riskLevel: data.suspicionAssessment?.riskLevel ?? data.overallStatus,
        verificationStatus: data.overallStatus,
        signals: data.findings,
        sourcesUnavailable: data.suspicionAssessment?.sourcesUnavailable,
      });
      if (isAuthenticated && onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cyber safety check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestAiExplanation() {
    if (!result) return;
    setAiError(null);
    setAiBusy(true);
    try {
      const levelMap =
        result.overallStatus === "HIGH RISK"
          ? "HIGH"
          : result.overallStatus === "CAUTION"
            ? "MEDIUM"
            : "LOW";
      const data = await apiFetch<{ explanation: string; nextSteps: string[] }>("/api/ai/explain", {
        method: "POST",
        body: JSON.stringify({
          text: `${result.identifierType}: ${result.maskedValue}`,
          signals: result.findings,
          findings: lang === "hi" ? result.findingsHi : result.findings,
          score: result.suspicionAssessment?.score ?? result.riskScore,
          riskLevel: result.suspicionAssessment?.riskLevel ?? levelMap,
          verificationStatus: result.suspicionAssessment?.verificationStatus ?? result.overallStatus,
          indicators: result.suspicionAssessment?.indicators.map((i) => ({
            label: i.label,
            points: i.points,
            evidence: i.evidence,
            sourceName: i.sourceName,
            verified: i.verified,
          })),
          sourcesUnavailable: result.suspicionAssessment?.sourcesUnavailable,
          sourceChecks: result.sourceChecks.map((s) => ({
            sourceName: s.sourceName,
            verificationStatus: s.verificationStatus,
            result: s.result,
            limitations: s.limitations,
          })),
          level: levelMap,
          lang,
          voiceLang,
          provider: activeProvider,
          contextType: `cyber_check_${result.identifierType}`,
        }),
      });
      setAiExplain(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI explanation unavailable.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionReveal} className="space-y-6">
      <div className="rounded-2xl p-6 space-y-5 bg-[#1E1A36]/90 border border-[#B8A8F8]/38 shadow-[0_16px_38px_-14px_rgba(3,8,18,0.85)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <CyberAwareness2D
              className="hidden sm:block w-16 h-16 shrink-0"
              title={
                lang === "hi"
                  ? "व्यक्तिगत डिजिटल पहचान, ईमेल, UPI और वेबसाइट सुरक्षा दृश्य"
                  : "Personal digital identity, email, UPI, and website security visual"
              }
            />
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#B8A8F8]" />
                <h2 className="font-display text-lg font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi" ? "व्यक्तिगत साइबर सुरक्षा जांच" : "Personal Cyber Safety Check"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#AEBBC9] max-w-2xl leading-relaxed">
                {lang === "hi"
                  ? "मोबाइल नंबर, ईमेल पते, UPI ID, बैंक खाता/IFSC या वेबसाइट URL की जांच करें। हर परिणाम सत्यापन स्थिति और स्रोत की सीमाएं स्पष्ट दिखाता है।"
                  : "Verify mobile numbers, email addresses, UPI IDs, bank account identifiers, and website URLs with full source transparency."}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[240px]">
            <AiProviderSwitcher provider={activeProvider} onChange={setProvider} lang={lang} compact />
          </div>
        </div>

        {/* Identifier Type Selector */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = identifierType === p.type;
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  setIdentifierType(p.type);
                  setValue(p.sample);
                  setResult(null);
                  setAiExplain(null);
                  setError(null);
                }}
                className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  active
                    ? "gm-gold-btn border-transparent"
                    : "bg-[#10243A]/85 text-[#F4F0E6] border-[#B8A8F8]/30 hover:border-[#E6C98A]"
                }`}
              >
                {lang === "hi" ? p.labelHi : p.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={runCheck} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              lang === "hi"
                ? "मोबाइल नंबर, ईमेल, UPI ID, IFSC या URL लिखें..."
                : "Enter mobile number, email, UPI ID, bank IFSC/account, or URL..."
            }
            className="flex-1 min-h-[44px] rounded-xl border border-[#B8A8F8]/32 bg-[#071525]/85 px-4 py-2.5 text-sm font-mono text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A]"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gm-gold-btn text-sm font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]"
          >
            <Search className="w-4 h-4" />
            {busy
              ? lang === "hi"
                ? "जांच जारी..."
                : "Checking..."
              : lang === "hi"
                ? "सुरक्षा जांचें"
                : "Run Safety Check"}
          </button>
        </form>

        {error && <p className="text-xs font-medium text-[#E87575]">{error}</p>}

        {!result && (
          <EmptyStateCard
            title={lang === "hi" ? "पहचानकर्ता जांचने के लिए तैयार" : "Ready to Verify Your Digital Identifier"}
            description={
              lang === "hi"
                ? "ऊपर कोई श्रेणी चुनें और 'सुरक्षा जांचें' दबाएं — सत्यापन स्थिति, जोखिम संकेत और पारदर्शी स्रोत विवरण तुरंत दिखेंगे।"
                : "Select a category above and run a safety check to view risk classifications, recommendations, and verified source transparency."
            }
          />
        )}

        {result && (
          <div className="pt-4 border-t border-[#C6A15B]/20 space-y-4">
            <SuspicionScoreCard
              assessment={result.suspicionAssessment}
              lang={lang}
              onExplainAi={requestAiExplanation}
              aiBusy={aiBusy}
              aiExplain={aiExplain}
              aiError={aiError}
              onOpenAwareness={onOpenAwareness}
            />
            <ContextualAwarenessLinks
              context={
                result.identifierType === "mobile"
                  ? "phone"
                  : result.identifierType === "url"
                    ? "url"
                    : "financial"
              }
              lang={lang}
              onOpenAwareness={onOpenAwareness}
            />
            <SourceTransparencyPanel sources={result.sourceChecks} lang={lang} />
          </div>
        )}
      </div>
    </motion.div>
  );
};
