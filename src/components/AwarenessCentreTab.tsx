import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  Volume2,
  Square,
  QrCode,
  Smartphone,
  PhoneCall,
  KeyRound,
  MonitorSmartphone,
  Globe,
  Landmark,
  UserX,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
} from "lucide-react";
import { motion } from "motion/react";
import { sectionReveal } from "../lib/motionSystem";
import {
  OFFICIAL_RESOURCES,
  SCAM_AWARENESS_CARDS,
  validateExternalHttpsUrl,
  type ScamAwarenessCardData,
  type ScamAwarenessId,
  type ScamVisualStep,
} from "../data/awarenessContent";
import { isTtsSupported, speakAlertText, stopSpeaking } from "../lib/tts";
import { SwipeableCardDeck } from "./SwipeableCardDeck";
import { CyberAwareness2D } from "./Illustrations2D";
import type { LangCode, VoiceLangCode } from "../types/guardian";

interface AwarenessCentreTabProps {
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  focusedCardId?: ScamAwarenessId | null;
  onClearFocus?: () => void;
}

function getCardIcon(id: ScamAwarenessId) {
  switch (id) {
    case "qr_scam":
      return QrCode;
    case "upi_scam":
      return Smartphone;
    case "customer_care":
      return PhoneCall;
    case "otp_scam":
      return KeyRound;
    case "screen_share":
      return MonitorSmartphone;
    case "phishing":
      return Globe;
    case "fake_bank_call":
      return Landmark;
    case "impersonation":
      return UserX;
    case "remote_access":
      return Laptop;
  }
}

function getStepIcon(type: ScamVisualStep["visualType"]) {
  switch (type) {
    case "scan":
      return QrCode;
    case "alert":
      return AlertTriangle;
    case "stop":
      return XCircle;
    case "phone":
      return PhoneCall;
    case "lock":
      return Lock;
    case "link":
      return Globe;
    case "shield":
      return ShieldCheck;
  }
}

export const AwarenessCentreTab: React.FC<AwarenessCentreTabProps> = ({
  lang,
  voiceLang = lang,
  focusedCardId,
  onClearFocus,
}) => {
  const [expandedId, setExpandedId] = useState<ScamAwarenessId | null>(focusedCardId || "qr_scam");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const ttsSupported = isTtsSupported();

  useEffect(() => {
    if (focusedCardId) {
      setExpandedId(focusedCardId);
    }
  }, [focusedCardId]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  function toggleSpeakCard(card: ScamAwarenessCardData) {
    if (speakingId === card.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    const title = lang === "hi" ? card.titleHi : card.title;
    const desc = lang === "hi" ? card.shortDescHi : card.shortDesc;
    const doTxt = lang === "hi" ? `क्या करें: ${card.doActionHi}` : `What to do: ${card.doAction}`;
    const dontTxt = lang === "hi" ? `क्या न करें: ${card.dontActionHi}` : `Do not: ${card.dontAction}`;
    speakAlertText(`${title}. ${desc}. ${doTxt}. ${dontTxt}`, voiceLang, {
      onStart: () => setSpeakingId(card.id),
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionReveal} className="space-y-8">
      {/* Visual Hero Header */}
      <section className="gm-glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <CyberAwareness2D className="w-14 h-14 shrink-0" />
          <div className="space-y-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#F4F0E6]">
              {lang === "hi" ? "साइबर सुरक्षा व जागरूकता केंद्र" : "Cyber Safety & Awareness Centre"}
            </h1>
            <p className="text-sm text-[#AEBBC9] max-w-2xl">
              {lang === "hi"
                ? "आसान चित्रों व आवाज़ में समझें कि ठगी कैसे होती है, और आधिकारिक भारतीय पोर्टल पर जांच या रिपोर्ट करें।"
                : "Learn common scams through short visual steps and voice guides, with direct links to official Indian cybercrime portals."}
            </p>
          </div>
        </div>

        <a
          href={validateExternalHttpsUrl("https://cybercrime.gov.in")}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl gm-emergency-btn text-xs font-bold transition-all whitespace-nowrap shrink-0"
        >
          <span>{lang === "hi" ? "आधिकारिक शिकायत (1930)" : "Report Fraud · 1930"}</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </section>

      {/* Official Indian Cybercrime & RBI Resources (Swipeable on mobile, 2-col grid on md+) */}
      <section aria-labelledby="official-portals-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="official-portals-heading" className="font-display text-base font-bold text-[#F4F0E6]">
            {lang === "hi" ? "आधिकारिक भारतीय साइबर सुरक्षा संसाधन" : "Official Indian Cybercrime & RBI Resources"}
          </h2>
          <span className="text-xs text-[#AEBBC9]">
            {lang === "hi" ? "सभी बाहरी लिंक HTTPS सत्यापित हैं" : "Verified HTTPS government & RBI links"}
          </span>
        </div>

        <SwipeableCardDeck
          ariaLabel={lang === "hi" ? "आधिकारिक भारतीय साइबर सुरक्षा संसाधन" : "Official Indian Cybercrime Resources"}
          itemClassName="w-[86vw] max-w-[400px] shrink-0 snap-center"
          desktopGridClassName="md:grid md:grid-cols-2 md:gap-4"
        >
          {OFFICIAL_RESOURCES.map((res) => {
            const safeUrl = validateExternalHttpsUrl(res.url);
            return (
              <div key={res.id} className="h-full gp-card rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E6C98A]">
                      {lang === "hi" ? res.badgeHi : res.badge}
                    </span>
                    <span className="font-mono text-[11px] text-[#AEBBC9] truncate max-w-[200px]">
                      {safeUrl.replace(/^https:\/\//, "")}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[#F4F0E6]">
                    {lang === "hi" ? res.titleHi : res.title}
                  </h3>

                  <p className="text-xs text-[#AEBBC9] leading-relaxed">
                    {lang === "hi" ? res.purposeHi : res.purpose}
                  </p>

                  <ul className="list-disc pl-4 space-y-1 text-xs text-[#AEBBC9]">
                    {(lang === "hi" ? res.highlightsHi : res.highlights).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>

                  {res.importantNote && (
                    <div className="p-3 rounded-xl border border-[#E6C98A]/40 bg-[#2B2112]/80 text-xs text-[#F4F0E6] flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#E6C98A]" />
                      <span>{lang === "hi" ? res.importantNoteHi : res.importantNote}</span>
                    </div>
                  )}
                </div>

                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    res.isEducationalOnly
                      ? "border border-[#C6A15B]/35 bg-[#10243A]/85 text-[#F4F0E6] hover:border-[#E6C98A]"
                      : "gm-gold-btn"
                  }`}
                >
                  <span>{lang === "hi" ? res.actionLabelHi : res.actionLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </SwipeableCardDeck>
      </section>

      {/* Visual Scam Learning Cards */}
      <section aria-labelledby="scam-guides-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="scam-guides-heading" className="font-display text-base font-bold text-[#F4F0E6]">
              {lang === "hi" ? "चित्रित स्कैम सुरक्षा गाइड (9 मुख्य ठगी)" : "Visual Scam Safety Guides"}
            </h2>
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "कदम-दर-कदम चित्र, सही-गलत नियम और आवाज़ में सुनने के लिए किसी कार्ड पर टैप करें।"
                : "Tap any card to see simple illustrated steps, Do vs Don't rules, and audio explanation."}
            </p>
          </div>

          {focusedCardId && onClearFocus && (
            <button
              type="button"
              onClick={onClearFocus}
              className="text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer"
            >
              {lang === "hi" ? "सभी विषय देखें" : "Show All Topics"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {SCAM_AWARENESS_CARDS.map((card) => {
            const Icon = getCardIcon(card.id);
            const isExpanded = expandedId === card.id;
            const isSpeaking = speakingId === card.id;

            return (
              <div
                key={card.id}
                className={`gp-card rounded-2xl p-5 space-y-4 transition-all ${
                  isExpanded ? "border-[#E6C98A]/70 lg:col-span-3" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-[#E6C98A]" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <span className="text-[11px] font-bold text-[#E87575]">
                        {lang === "hi" ? card.actionLabelHi : card.actionLabel}
                      </span>
                      <h3 className="font-display text-sm sm:text-base font-bold text-[#F4F0E6]">
                        {lang === "hi" ? card.titleHi : card.title}
                      </h3>
                      <p className="text-xs text-[#AEBBC9] leading-snug">
                        {lang === "hi" ? card.shortDescHi : card.shortDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : card.id)}
                    aria-expanded={isExpanded}
                    className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 hover:border-[#E6C98A] text-xs font-bold text-[#F4F0E6] transition-colors cursor-pointer"
                  >
                    <span>
                      {isExpanded
                        ? lang === "hi"
                          ? "विवरण बंद करें"
                          : "Hide Visual Guide"
                        : lang === "hi"
                          ? "आसान चरण देखें"
                          : "See Visual Steps"}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {ttsSupported && (
                    <button
                      type="button"
                      onClick={() => toggleSpeakCard(card)}
                      aria-label={lang === "hi" ? "आवाज़ में सुनें" : "Listen to guide"}
                      className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isSpeaking ? "gm-emergency-btn" : "gm-gold-btn"
                      }`}
                    >
                      {isSpeaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
                      <span>{isSpeaking ? (lang === "hi" ? "रोकें" : "Stop") : lang === "hi" ? "सुनें" : "Listen"}</span>
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="pt-4 border-t border-[#C6A15B]/20 space-y-5">
                    <div>
                      <p className="text-xs font-bold text-[#F4F0E6] mb-2.5">
                        {lang === "hi" ? "यह ठगी कैसे होती है (3 आसान चरण):" : "How It Happens (3 Simple Steps):"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {card.steps.map((st) => {
                          const StepIcon = getStepIcon(st.visualType);
                          const isStop = st.visualType === "stop" || st.visualType === "alert";
                          return (
                            <div
                              key={st.stepNumber}
                              className="rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 p-4 flex flex-col items-center text-center gap-2"
                            >
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                  isStop
                                    ? "bg-[#2E1219] text-[#E87575] border border-[#E87575]/45"
                                    : "bg-[#252A32] text-[#E6C98A] border border-[#C6A15B]/45"
                                }`}
                              >
                                <StepIcon className="w-6 h-6" />
                              </div>
                              <span className="font-mono text-[11px] font-bold text-[#E6C98A]">
                                {lang === "hi" ? `चरण ${st.stepNumber}` : `Step ${st.stepNumber}`}
                              </span>
                              <p className="text-xs font-semibold text-[#F4F0E6]">
                                {lang === "hi" ? st.labelHi : st.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-[#C6A15B]/25 bg-[#071525]/70 p-4 space-y-1.5 text-xs">
                        <p className="font-bold text-[#E6C98A]">
                          {lang === "hi" ? "वास्तविक उदाहरण:" : "Real-World Example:"}
                        </p>
                        <p className="text-[#AEBBC9] leading-relaxed">
                          {lang === "hi" ? card.exampleHi : card.example}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#C6A15B]/25 bg-[#071525]/70 p-4 space-y-1.5 text-xs">
                        <p className="font-bold text-[#E6C98A]">
                          {lang === "hi" ? "खतरे के संकेत:" : "Warning Signs:"}
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-[#AEBBC9]">
                          {(lang === "hi" ? card.warningSignsHi : card.warningSigns).map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="rounded-xl border border-[#43C6A5]/40 bg-[#0B2825]/85 p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-[#43C6A5] shrink-0" />
                        <div>
                          <p className="font-bold text-[#43C6A5]">{lang === "hi" ? "ऐसा करें (DO)" : "DO THIS"}</p>
                          <p className="mt-0.5 text-[#F4F0E6]">
                            {lang === "hi" ? card.doActionHi : card.doAction}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E87575]/45 bg-[#2E1219]/90 p-4 flex items-start gap-3">
                        <XCircle className="w-6 h-6 text-[#E87575] shrink-0" />
                        <div>
                          <p className="font-bold text-[#E87575]">
                            {lang === "hi" ? "ऐसा कभी न करें (DON'T)" : "NEVER DO THIS"}
                          </p>
                          <p className="mt-0.5 text-[#F4F0E6]">
                            {lang === "hi" ? card.dontActionHi : card.dontAction}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-[#AEBBC9]">
                        {lang === "hi"
                          ? "आधिकारिक भारतीय साइबर सुरक्षा संसाधन:"
                          : "Official Government of India Resource:"}
                      </span>
                      <a
                        href={validateExternalHttpsUrl(card.resourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold transition-all"
                      >
                        <span>{lang === "hi" ? card.resourceLabelHi : card.resourceLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
};
