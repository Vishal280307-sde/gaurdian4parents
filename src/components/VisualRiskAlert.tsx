import React, { useEffect, useState } from "react";
import { Volume2, Square, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Hand } from "lucide-react";
import { isTtsSupported, speakAlertText, stopSpeaking } from "../lib/tts";
import type { LangCode, UnifiedRiskLevel, VoiceLangCode } from "../types/guardian";

interface VisualRiskAlertProps {
  level: UnifiedRiskLevel;
  score: number;
  categoryLabel?: string;
  simpleSummaryEn?: string;
  simpleSummaryHi?: string;
  reasonsEn?: string[];
  reasonsHi?: string[];
  stepsEn?: string[];
  stepsHi?: string[];
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  actionSlot?: React.ReactNode;
  awarenessSlot?: React.ReactNode;
}

export const VisualRiskIllustration: React.FC<{ level: UnifiedRiskLevel; className?: string }> = ({
  level,
  className = "w-16 h-16 sm:w-20 sm:h-20",
}) => {
  if (level === "HIGH") {
    return (
      <div
        className={`${className} rounded-2xl bg-[#E87575] text-[#071525] flex items-center justify-center shadow-[0_0_24px_rgba(232,117,117,0.38)] shrink-0`}
        aria-hidden="true"
      >
        <Hand className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
      </div>
    );
  }
  if (level === "MODERATE") {
    return (
      <div
        className={`${className} rounded-2xl bg-[#E6C98A] text-[#071525] flex items-center justify-center shadow-[0_0_24px_rgba(230,201,138,0.35)] shrink-0`}
        aria-hidden="true"
      >
        <AlertTriangle className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
      </div>
    );
  }
  return (
    <div
      className={`${className} rounded-2xl bg-[#43C6A5] text-[#071525] flex items-center justify-center shadow-[0_0_24px_rgba(67,198,165,0.35)] shrink-0`}
      aria-hidden="true"
    >
      <ShieldCheck className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
    </div>
  );
};

export const VisualRiskAlert: React.FC<VisualRiskAlertProps> = ({
  level,
  score,
  categoryLabel,
  simpleSummaryEn,
  simpleSummaryHi,
  reasonsEn = [],
  reasonsHi = [],
  stepsEn = [],
  stepsHi = [],
  lang,
  voiceLang,
  actionSlot,
  awarenessSlot,
}) => {
  const [speaking, setSpeaking] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);
  const [openWhatToDo, setOpenWhatToDo] = useState(false);
  const ttsAvailable = isTtsSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const config =
    level === "HIGH"
      ? {
          badge: lang === "hi" ? "खतरा! (HIGH RISK)" : "DANGER! (HIGH RISK)",
          headline: lang === "hi" ? "रुकें! पैसे न भेजें!" : "STOP! DO NOT SEND MONEY!",
          defaultSummary:
            lang === "hi"
              ? "यह उच्च जोखिम वाला लगता है। भुगतान न करें और न OTP/PIN बताएं।"
              : "High fraud signals detected. Stop now and do not pay or share OTP.",
          actionChips:
            lang === "hi"
              ? ["रुकें (STOP)", "भुगतान न करें (DON'T PAY)", "रिपोर्ट करें (REPORT)"]
              : ["STOP", "DON'T PAY", "REPORT"],
          containerCls: "bg-[#2E1219]/90 border-[#E87575]/45 backdrop-blur-md",
          titleCls: "text-[#E87575]",
          chipCls: "bg-[#E87575] text-[#071525]",
          subTextCls: "text-[#F4F0E6]",
        }
      : level === "MODERATE"
        ? {
            badge: lang === "hi" ? "सावधान रहें (MEDIUM RISK)" : "BE CAREFUL (MEDIUM RISK)",
            headline:
              lang === "hi" ? "कुछ संदिग्ध दिख रहा है। पहले जांचें।" : "Something looks unusual. Check first.",
            defaultSummary:
              lang === "hi"
                ? "आगे बढ़ने से पहले परिवार के सदस्य या आधिकारिक स्रोत से पुष्टि करें।"
                : "Verify with a trusted family member or official source before proceeding.",
            actionChips:
              lang === "hi" ? ["रुकें", "सत्यापित करें (VERIFY)"] : ["VERIFY", "CHECK CAREFULLY"],
            containerCls: "bg-[#2B2112]/90 border-[#E6C98A]/45 backdrop-blur-md",
            titleCls: "text-[#E6C98A]",
            chipCls: "bg-[#E6C98A] text-[#071525]",
            subTextCls: "text-[#F4F0E6]",
          }
        : {
            badge: lang === "hi" ? "सुरक्षित संकेत (LOW RISK)" : "SAFE (LOW RISK)",
            headline:
              lang === "hi"
                ? "यह सुरक्षित लगता है, लेकिन भुगतान से पहले हमेशा पुष्टि करें।"
                : "This looks safe, but always verify before paying.",
            defaultSummary:
              lang === "hi"
                ? "कोई ज्ञात खतरा नहीं मिला, फिर भी हमेशा प्राप्तकर्ता का नाम और राशि जांचें। यह 100% सुरक्षा की गारंटी नहीं है।"
                : "No known threat matched, yet 0 risk is never a guarantee — always confirm payee name and amount.",
            actionChips:
              lang === "hi" ? ["सत्यापित करें (VERIFY)", "नाम जांचें"] : ["VERIFY PAYEE", "CHECK AMOUNT"],
            containerCls: "bg-[#0B2825]/90 border-[#43C6A5]/45 backdrop-blur-md",
            titleCls: "text-[#43C6A5]",
            chipCls: "bg-[#43C6A5] text-[#071525]",
            subTextCls: "text-[#F4F0E6]",
          };

  const summary =
    lang === "hi"
      ? simpleSummaryHi || config.defaultSummary
      : simpleSummaryEn || config.defaultSummary;
  const reasons = lang === "hi" ? reasonsHi : reasonsEn;
  const steps = lang === "hi" ? stepsHi : stepsEn;

  function handleListen() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const speechParts = [
      config.headline,
      summary,
      ...(reasons.length > 0 ? reasons.slice(0, 2) : []),
      ...(steps.length > 0 ? steps.slice(0, 2) : []),
    ];
    speakAlertText(speechParts.join(". "), voiceLang || lang, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${config.containerCls}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <VisualRiskIllustration level={level} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-extrabold tracking-wide ${config.titleCls}`}>{config.badge}</span>
            <span className={`font-mono tabular-nums text-xs font-bold ${config.subTextCls}`}>· {score}/100</span>
            {categoryLabel && (
              <span className="text-xs font-medium text-[#AEBBC9]">· {categoryLabel}</span>
            )}
          </div>

          <h3 className={`font-display text-xl sm:text-2xl font-extrabold leading-tight ${config.titleCls}`}>
            {config.headline}
          </h3>

          <p className={`text-sm font-medium leading-snug ${config.subTextCls}`}>{summary}</p>

          <div className="pt-1 flex flex-wrap items-center gap-2">
            {config.actionChips.map((chip) => (
              <span key={chip} className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${config.chipCls}`}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {ttsAvailable && (
          <button
            type="button"
            onClick={handleListen}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
          >
            {speaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
            <span>
              {speaking
                ? lang === "hi"
                  ? "आवाज़ रोकें"
                  : "Stop Audio"
                : lang === "hi"
                  ? "चेतावनी सुनें"
                  : "Listen to Warning"}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpenWhy((v) => !v)}
          aria-expanded={openWhy}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/90 text-xs font-bold text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
        >
          <span>{lang === "hi" ? "यह खतरनाक क्यों है?" : "Why is this risky?"}</span>
          {openWhy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setOpenWhatToDo((v) => !v)}
          aria-expanded={openWhatToDo}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/90 text-xs font-bold text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
        >
          <span>{lang === "hi" ? "मुझे क्या करना चाहिए?" : "What should I do?"}</span>
          {openWhatToDo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {actionSlot}
      </div>

      {openWhy && (
        <div className="rounded-xl border border-[#C6A15B]/25 bg-[#071525]/88 p-4 space-y-2 text-xs">
          <p className="font-bold text-[#F4F0E6]">
            {lang === "hi" ? "सरल कारण (2–3 मुख्य बातें):" : "Simple Reasons:"}
          </p>
          {reasons.length === 0 ? (
            <p className="text-[#AEBBC9]">
              {lang === "hi"
                ? "उपलब्ध जांच में कोई ज्ञात खतरा संकेत नहीं मिला। फिर भी भुगतान करने से पहले नाम और राशि खुद जांचें।"
                : "No immediate scam signal matched in local checks, yet manual payee confirmation is always required."}
            </p>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-[#AEBBC9]">
              {reasons.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {openWhatToDo && (
        <div className="rounded-xl border border-[#C6A15B]/25 bg-[#071525]/88 p-4 space-y-3 text-xs">
          <p className="font-bold text-[#F4F0E6]">
            {lang === "hi" ? "आसान सुरक्षा कदम:" : "Clear Next Steps:"}
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#AEBBC9]">
            {(steps.length > 0
              ? steps.slice(0, 3)
              : level === "HIGH"
                ? [
                    lang === "hi" ? "तुरंत रुकें — पैसे न भेजें।" : "STOP immediately — do not send money.",
                    lang === "hi" ? "OTP, UPI PIN या पासवर्ड साझा न करें।" : "Never share OTP, UPI PIN, or passwords.",
                  ]
                : [
                    lang === "hi"
                      ? "भुगतान से पहले परिवार के सदस्य या बैंक से पुष्टि करें।"
                      : "Verify recipient identity directly before sending money.",
                  ]
            ).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {awarenessSlot}
        </div>
      )}
    </div>
  );
};
