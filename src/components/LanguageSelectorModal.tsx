import React from "react";
import { Check, Globe, Info, X } from "lucide-react";
import { VOICE_LANGUAGE_OPTIONS, inspectVoiceCapabilities } from "../lib/voiceAssistant";
import type { LangCode, VoiceLangCode } from "../types/guardian";

interface LanguageSelectorModalProps {
  open: boolean;
  selectedVoiceLang: VoiceLangCode;
  uiLang: LangCode;
  onSelect: (code: VoiceLangCode) => void;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  open,
  selectedVoiceLang,
  uiLang,
  onSelect,
  onClose,
}) => {
  if (!open) return null;

  const capInfo = inspectVoiceCapabilities(selectedVoiceLang);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-language-modal-title"
      className="fixed inset-0 z-50 bg-[#071525]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div className="gm-glass-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#C6A15B]/25">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#10243A] border border-[#C6A15B]/55 text-[#E6C98A] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 id="voice-language-modal-title" className="font-display text-lg font-bold text-[#F4F0E6]">
                {uiLang === "hi" ? "आवाज़ व AI भाषा चुनें" : "Choose Voice & AI Language"}
              </h2>
              <p className="mt-0.5 text-xs text-[#AEBBC9]">
                {uiLang === "hi"
                  ? "सभी आगे के वॉइस कमांड और AI उत्तर आपकी चुनी गई भाषा में चलेंगे।"
                  : "All upcoming voice interactions and Guardian AI replies will use your selected language."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={uiLang === "hi" ? "भाषा संवाद बंद करें" : "Close language selector"}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#10243A] flex items-center justify-center text-[#AEBBC9] hover:text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VOICE_LANGUAGE_OPTIONS.map((opt) => {
            const selected = selectedVoiceLang === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  onSelect(opt.code);
                  onClose();
                }}
                className={`min-h-[76px] p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-3 ${
                  selected
                    ? "bg-gradient-to-br from-[#2B2112] via-[#10243A] to-[#252A32] border-[#E6C98A] shadow-[0_0_22px_-6px_rgba(230,201,138,0.45)]"
                    : "bg-[#10243A]/75 border-[#C6A15B]/25 hover:border-[#C6A15B]/65 hover:bg-[#10243A]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center font-display text-sm font-bold shrink-0 ${
                      selected
                        ? "bg-[#C6A15B] border-[#E6C98A] text-[#071525]"
                        : "bg-[#071525]/85 border-[#C6A15B]/35 text-[#E6C98A]"
                    }`}
                  >
                    {opt.scriptBadge}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#F4F0E6] truncate">{opt.nativeName}</p>
                    <p className="text-xs text-[#AEBBC9] truncate">
                      {opt.englishName} · {opt.regionNote}
                    </p>
                    {!opt.nativeSpeechSupportedByStandardWeb && (
                      <p className="mt-0.5 text-[10px] font-medium text-[#E6C98A]">
                        {uiLang === "hi" ? "बोलने हेतु hi-IN फ़ॉलबैक" : "Uses hi-IN speech fallback"}
                      </p>
                    )}
                  </div>
                </div>

                {selected && (
                  <div className="w-7 h-7 rounded-full bg-[#43C6A5]/20 border border-[#43C6A5]/60 text-[#43C6A5] flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3.5 rounded-xl bg-[#071525]/80 border border-[#C6A15B]/25 flex items-start gap-2.5 text-xs text-[#AEBBC9]">
          <Info className="w-4 h-4 text-[#C6A15B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#F4F0E6]">
              {uiLang === "hi" ? "डिवाइस वॉइस समर्थन स्थिति" : "Browser Speech Support Status"}
            </p>
            <p>{capInfo.statusMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
