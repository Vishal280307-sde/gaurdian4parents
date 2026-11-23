import React from "react";
import { Shield } from "lucide-react";
import type { AiProviderId, LangCode } from "../types/guardian";

export const GeminiSparkleIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <defs>
      <linearGradient id="gm-gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6CC4E8" />
        <stop offset="50%" stopColor="#E6C98A" />
        <stop offset="100%" stopColor="#C6A15B" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C12.7 7.4 16.6 11.3 22 12C16.6 12.7 12.7 16.6 12 22C11.3 16.6 7.4 12.7 2 12C7.4 11.3 11.3 7.4 12 2Z"
      fill="url(#gm-gemini-grad)"
    />
  </svg>
);

interface AiProviderSwitcherProps {
  provider: AiProviderId;
  onChange: (next: AiProviderId) => void;
  lang: LangCode;
  compact?: boolean;
}

export const AiProviderSwitcher: React.FC<AiProviderSwitcherProps> = ({
  provider,
  onChange,
  lang,
  compact = false,
}) => {
  return (
    <div
      role="group"
      aria-label={lang === "hi" ? "AI प्रदाता चुनें" : "Choose AI Provider"}
      className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/85"
    >
      <button
        type="button"
        onClick={() => onChange("gemini")}
        className={`min-h-[36px] px-2.5 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap ${
          provider === "gemini"
            ? "bg-gradient-to-r from-[#10243A] to-[#252A32] text-[#E6C98A] border border-[#E6C98A]/65 shadow-[0_0_16px_-4px_rgba(230,201,138,0.38)]"
            : "text-[#AEBBC9] hover:text-[#F4F0E6] border border-transparent"
        }`}
      >
        <GeminiSparkleIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{compact ? "Gemini AI" : "Google Gemini"}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("guardian")}
        className={`min-h-[36px] px-2.5 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap ${
          provider === "guardian"
            ? "bg-gradient-to-r from-[#10243A] to-[#0B2825] text-[#43C6A5] border border-[#43C6A5]/60 shadow-[0_0_14px_-4px_rgba(67,198,165,0.3)]"
            : "text-[#AEBBC9] hover:text-[#F4F0E6] border border-transparent"
        }`}
      >
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          {compact ? (lang === "hi" ? "गार्जियन नियम" : "Guardian Safe") : lang === "hi" ? "गार्जियन सलाहकार" : "Guardian Safety"}
        </span>
      </button>
    </div>
  );
};
