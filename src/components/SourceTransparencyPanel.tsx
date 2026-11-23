import React from "react";
import { ShieldAlert, AlertTriangle, HelpCircle, ServerOff, Info } from "lucide-react";
import type { LangCode, SourceCheckEntry, TransparencyStatus } from "../types/guardian";

interface SourceTransparencyPanelProps {
  sources: SourceCheckEntry[];
  lang: LangCode;
  title?: string;
}

function getStatusMeta(status: TransparencyStatus, lang: LangCode) {
  switch (status) {
    case "HIGH RISK":
      return {
        label: lang === "hi" ? "सत्यापित मिलान (HIGH RISK)" : "Verified Match (HIGH RISK)",
        color: "text-[#E87575]",
        Icon: ShieldAlert,
      };
    case "CAUTION":
      return {
        label: lang === "hi" ? "असत्यापित रिपोर्ट (CAUTION)" : "Unverified Report (CAUTION)",
        color: "text-[#E6C98A]",
        Icon: AlertTriangle,
      };
    case "NO KNOWN THREAT DETECTED":
      return {
        label: lang === "hi" ? "कोई मिलान नहीं मिला (No Match Found)" : "No Match Found",
        color: "text-[#43C6A5]",
        Icon: Info,
      };
    case "SOURCE UNAVAILABLE":
      return {
        label: lang === "hi" ? "स्रोत अनुपलब्ध (Source Unavailable)" : "Source Unavailable",
        color: "text-[#AEBBC9]",
        Icon: ServerOff,
      };
    case "MANUAL VERIFICATION REQUIRED":
    default:
      return {
        label:
          lang === "hi"
            ? "स्वयं पुष्टि आवश्यक (Manual Verification)"
            : "Manual Verification Required",
        color: "text-[#C6A15B]",
        Icon: HelpCircle,
      };
  }
}

export const SourceTransparencyPanel: React.FC<SourceTransparencyPanelProps> = ({ sources, lang, title }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#C6A15B]/20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#E6C98A]">
          {title ||
            (lang === "hi"
              ? "स्रोत पारदर्शिता व सत्यापन विवरण"
              : "Source Transparency & Verification Ledger")}
        </h3>
        <span className="text-xs text-[#AEBBC9]">
          {lang === "hi"
            ? "मिलान न दिखने का अर्थ सुरक्षा की गारंटी नहीं है"
            : "No match found is never a guarantee of safety"}
        </span>
      </div>

      <div className="divide-y divide-[#C6A15B]/15">
        {sources.map((src, idx) => {
          const meta = getStatusMeta(src.verificationStatus, lang);
          const StatusIcon = meta.Icon;
          return (
            <div key={`${src.sourceName}-${idx}`} className="py-3 first:pt-1 last:pb-0 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#F4F0E6]">
                  {lang === "hi" ? src.sourceNameHi : src.sourceName}
                </span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${meta.color}`}>
                  <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{meta.label}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#AEBBC9]">
                <span>
                  {lang === "hi" ? "जांचा गया:" : "Checked:"}{" "}
                  <strong className="font-mono text-[#F4F0E6]">{src.informationChecked}</strong>
                </span>
                <span className="font-mono tabular-nums">
                  {lang === "hi" ? "समय:" : "Last checked:"}{" "}
                  {new Date(src.lastCheckedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              <p className="text-[#AEBBC9]">{lang === "hi" ? src.resultHi : src.result}</p>

              <p className="text-[11px] text-[#E6C98A]">
                {lang === "hi" ? "सीमाएं:" : "Limitations:"} {lang === "hi" ? src.limitationsHi : src.limitations}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
