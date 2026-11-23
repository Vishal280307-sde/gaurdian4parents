import type { LangCode, VoiceLangCode } from "../types/guardian";

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerAttached = false;

function ensureVoicesLoaded(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  try {
    const list = window.speechSynthesis.getVoices();
    if (list.length > 0) cachedVoices = list;
    if (!voicesListenerAttached && "addEventListener" in window.speechSynthesis) {
      voicesListenerAttached = true;
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        try {
          const updated = window.speechSynthesis.getVoices();
          if (updated.length > 0) cachedVoices = updated;
        } catch {
          // ignore
        }
      });
    }
    return cachedVoices;
  } catch {
    return [];
  }
}

export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore speech synthesis cancellation errors
  }
}

export function pauseSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  } catch {
    // ignore pause errors
  }
}

export function resumeSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    // ignore resume errors
  }
}

const BCP47_TTS_MAP: Record<VoiceLangCode, { primary: string; fallbacks: string[] }> = {
  en: { primary: "en-IN", fallbacks: ["en-GB", "en-US", "en"] },
  hi: { primary: "hi-IN", fallbacks: ["hi", "en-IN"] },
  hinglish: { primary: "en-IN", fallbacks: ["hi-IN", "en-GB", "en-US", "en"] },
  bn: { primary: "bn-IN", fallbacks: ["bn-BD", "bn", "hi-IN"] },
  mr: { primary: "mr-IN", fallbacks: ["mr", "hi-IN"] },
  te: { primary: "te-IN", fallbacks: ["te", "hi-IN"] },
  bgc: { primary: "hi-IN", fallbacks: ["hi"] },
  bho: { primary: "hi-IN", fallbacks: ["hi"] },
};

export function hasNativeVoiceForLang(voiceLang: VoiceLangCode): {
  exact: boolean;
  resolvedTag: string;
} {
  if (!isTtsSupported()) return { exact: false, resolvedTag: "none" };
  const voices = ensureVoicesLoaded();
  const spec = BCP47_TTS_MAP[voiceLang] || BCP47_TTS_MAP.en;
  if (!voices.length) {
    return {
      exact: voiceLang !== "bgc" && voiceLang !== "bho",
      resolvedTag: spec.primary,
    };
  }
  const exactPrefix =
    voiceLang === "bgc" || voiceLang === "bho"
      ? "bgc"
      : voiceLang === "hinglish"
        ? "en-in"
        : voiceLang;
  const nativeMatch = voices.find((v) => v.lang.toLowerCase().startsWith(exactPrefix));
  if (nativeMatch) {
    return { exact: true, resolvedTag: nativeMatch.lang };
  }
  for (const tag of [spec.primary, ...spec.fallbacks]) {
    const base = tag.toLowerCase().split("-")[0];
    const match =
      voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(base));
    if (match) return { exact: voiceLang === "hinglish", resolvedTag: match.lang };
  }
  return { exact: false, resolvedTag: spec.primary };
}

function cleanTextForSpeech(raw: string): string {
  return String(raw || "")
    .replace(/[*_`#>]/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function speakAlertText(
  text: string,
  lang: LangCode | VoiceLangCode,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  },
  options?: { muted?: boolean }
): boolean {
  if (options?.muted || !isTtsSupported()) {
    if (options?.muted) callbacks?.onEnd?.();
    else callbacks?.onError?.();
    return false;
  }
  const clean = cleanTextForSpeech(text);
  if (!clean) {
    callbacks?.onEnd?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const vLang: VoiceLangCode =
      lang === "hi" ||
      lang === "hinglish" ||
      lang === "bn" ||
      lang === "mr" ||
      lang === "te" ||
      lang === "bgc" ||
      lang === "bho"
        ? lang
        : "en";
    const spec = BCP47_TTS_MAP[vLang];
    utterance.lang = spec.primary;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = ensureVoicesLoaded();
    if (voices.length > 0) {
      const candidates = [spec.primary, ...spec.fallbacks];
      let matched: SpeechSynthesisVoice | undefined;
      for (const candidate of candidates) {
        const lower = candidate.toLowerCase();
        matched =
          voices.find((v) => v.lang.toLowerCase() === lower) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(lower.split("-")[0]));
        if (matched) break;
      }
      if (matched) {
        utterance.voice = matched;
        utterance.lang = matched.lang;
      }
    }

    let settled = false;
    utterance.onstart = () => callbacks?.onStart?.();
    utterance.onend = () => {
      if (settled) return;
      settled = true;
      callbacks?.onEnd?.();
    };
    utterance.onerror = () => {
      if (settled) return;
      settled = true;
      callbacks?.onError?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    callbacks?.onError?.();
    return false;
  }
}
