import React from "react";
import { BookOpen, ExternalLink, Search, Flag, ShieldAlert } from "lucide-react";
import { validateExternalHttpsUrl, type ScamAwarenessId } from "../data/awarenessContent";
import type { LangCode } from "../types/guardian";

interface ContextualAwarenessLinksProps {
  context: "qr" | "phone" | "url" | "financial";
  lang: LangCode;
  scamCardId?: ScamAwarenessId;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
  compact?: boolean;
}

export const ContextualAwarenessLinks: React.FC<ContextualAwarenessLinksProps> = ({
  context,
  lang,
  scamCardId,
  onOpenAwareness,
  compact = false,
}) => {
  const suspectSearchUrl = validateExternalHttpsUrl(
    "https://cybercrime.gov.in/webform/suspect_search_repository.aspx"
  );
  const reportSuspectUrl = validateExternalHttpsUrl("https://cybercrime.gov.in/Webform/cyber_suspect.aspx");
  const cyberPortalUrl = validateExternalHttpsUrl("https://cybercrime.gov.in");

  const defaultTopic: ScamAwarenessId =
    scamCardId ||
    (context === "qr"
      ? "qr_scam"
      : context === "phone"
        ? "fake_bank_call"
        : context === "url"
          ? "phishing"
          : "upi_scam");

  const headline =
    context === "qr"
      ? lang === "hi"
        ? "QR भुगतान घोटाले कैसे काम करते हैं?"
        : "How QR Payment Scams Work & Official Help"
      : context === "phone"
        ? lang === "hi"
          ? "आधिकारिक डेटाबेस में नंबर जांचें या रिपोर्ट करें"
          : "Verify or Report This Number Officially"
        : context === "url"
          ? lang === "hi"
            ? "नकली वेबसाइट से बचाव व रिपोर्टिंग"
            : "Phishing Guide & Official Reporting"
          : lang === "hi"
            ? "वित्तीय धोखाधड़ी की तुरंत सहायता"
            : "Official Financial Fraud Reporting";

  return (
    <div
      className={`rounded-xl border border-[#C6A15B]/28 bg-[#10243A]/85 ${
        compact ? "p-3" : "p-4"
      } space-y-2.5`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F0E6]">
        <ShieldAlert className="w-4 h-4 text-[#E6C98A] shrink-0" />
        <span>{headline}</span>
      </div>

      {context === "qr" && (
        <p className="text-xs text-[#AEBBC9]">
          {lang === "hi"
            ? "याद रखें: पैसे पाने के लिए कभी QR कोड स्कैन नहीं करना पड़ता — स्कैन करने से पैसे केवल भेजे जाते हैं।"
            : "Remember: You NEVER need to scan a QR code or enter your UPI PIN to receive money."}
        </p>
      )}

      {context === "phone" && (
        <p className="text-[11px] text-[#AEBBC9]">
          {lang === "hi"
            ? "संदिग्ध खोज भंडार केवल दर्ज शिकायतों का रिकॉर्ड दिखाता है; यह किसी व्यक्ति के दोषी होने का स्वतंत्र प्रमाण नहीं है।"
            : "Suspect Search shows reported complaint records only and does not independently prove criminal guilt."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onOpenAwareness && (
          <button
            type="button"
            onClick={() => onOpenAwareness(defaultTopic)}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl gm-gold-btn text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {lang === "hi" ? "चित्रित गाइड जानें" : "Learn More (Visual Guide)"}
          </button>
        )}

        {(context === "phone" || context === "url" || context === "qr") && (
          <a
            href={suspectSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5 text-[#E6C98A]" />
            {lang === "hi" ? "Suspect Search में जांचें" : "Check in Suspect Search"}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <a
          href={reportSuspectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E87575]/45 bg-[#2E1219]/85 hover:bg-[#2E1219] text-xs font-semibold text-[#E87575] transition-colors whitespace-nowrap shrink-0"
        >
          <Flag className="w-3.5 h-3.5" />
          {lang === "hi" ? "संदिग्ध रिपोर्ट करें" : "Report Suspect"}
          <ExternalLink className="w-3 h-3" />
        </a>

        <a
          href={cyberPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#E6C98A] transition-colors whitespace-nowrap shrink-0"
        >
          {lang === "hi" ? "cybercrime.gov.in (1930)" : "cybercrime.gov.in (1930)"}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
