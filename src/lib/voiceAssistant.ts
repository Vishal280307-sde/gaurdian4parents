import { isTtsSupported, hasNativeVoiceForLang } from "./tts";
import type { VoiceLangCode } from "../types/guardian";

export interface VoiceLanguageOption {
  code: VoiceLangCode;
  englishName: string;
  nativeName: string;
  regionNote: string;
  speechRecognitionLang: string;
  nativeSpeechSupportedByStandardWeb: boolean;
  fallbackNote?: string;
  scriptBadge: string;
}

export const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
  {
    code: "en",
    englishName: "English",
    nativeName: "English",
    regionNote: "India & Global",
    speechRecognitionLang: "en-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "EN",
  },
  {
    code: "hi",
    englishName: "Hindi",
    nativeName: "हिन्दी",
    regionNote: "Standard Devanagari",
    speechRecognitionLang: "hi-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "हिं",
  },
  {
    code: "hinglish",
    englishName: "Hinglish",
    nativeName: "Hinglish",
    regionNote: "Hindi + English Mix",
    speechRecognitionLang: "en-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "HiEn",
  },
  {
    code: "bn",
    englishName: "Bengali",
    nativeName: "বাংলা",
    regionNote: "West Bengal & India",
    speechRecognitionLang: "bn-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "বাং",
  },
  {
    code: "mr",
    englishName: "Marathi",
    nativeName: "मराठी",
    regionNote: "Maharashtra",
    speechRecognitionLang: "mr-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "मर",
  },
  {
    code: "te",
    englishName: "Telugu (Andhra Pradesh)",
    nativeName: "తెలుగు (ఆంధ్రప్రదేశ్)",
    regionNote: "Andhra Pradesh & Telangana",
    speechRecognitionLang: "te-IN",
    nativeSpeechSupportedByStandardWeb: true,
    scriptBadge: "తె",
  },
  {
    code: "bgc",
    englishName: "Haryanvi",
    nativeName: "हरियाणवी",
    regionNote: "Haryana · Devanagari",
    speechRecognitionLang: "hi-IN",
    nativeSpeechSupportedByStandardWeb: false,
    fallbackNote:
      "Uses Hindi (hi-IN) voice recognition fallback when browser lacks native Haryanvi locale; AI replies naturally in Haryanvi.",
    scriptBadge: "हर",
  },
  {
    code: "bho",
    englishName: "Bhojpuri / Bihari",
    nativeName: "भोजपुरी / बिहारी",
    regionNote: "Bihar & Purvanchal",
    speechRecognitionLang: "hi-IN",
    nativeSpeechSupportedByStandardWeb: false,
    fallbackNote:
      "Uses Hindi (hi-IN) voice recognition fallback when browser lacks native Bhojpuri locale; AI replies naturally in Bhojpuri.",
    scriptBadge: "भो",
  },
];

export function getVoiceLanguageOption(code: VoiceLangCode): VoiceLanguageOption {
  return VOICE_LANGUAGE_OPTIONS.find((o) => o.code === code) || VOICE_LANGUAGE_OPTIONS[0];
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onresult: ((ev: {
    resultIndex?: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }) => void) | null;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // continue checking next mime
    }
  }
  return "";
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read recorded audio data."));
    reader.readAsDataURL(blob);
  });
}

export function inspectVoiceCapabilities(code: VoiceLangCode): {
  sttSupported: boolean;
  mediaRecorderSupported: boolean;
  ttsSupported: boolean;
  nativeVoiceAvailable: boolean;
  statusMessage: string;
} {
  const opt = getVoiceLanguageOption(code);
  const sttSupported = isSpeechRecognitionSupported();
  const mediaRecorderSupported = isMediaRecorderSupported();
  const ttsSupported = isTtsSupported();
  const voiceCheck = hasNativeVoiceForLang(code);

  if (!sttSupported && !mediaRecorderSupported && !ttsSupported) {
    return {
      sttSupported: false,
      mediaRecorderSupported: false,
      ttsSupported: false,
      nativeVoiceAvailable: false,
      statusMessage:
        "Live browser microphone & voice playback are unavailable here — you can type or edit any question cleanly.",
    };
  }
  if (!opt.nativeSpeechSupportedByStandardWeb) {
    return {
      sttSupported,
      mediaRecorderSupported,
      ttsSupported,
      nativeVoiceAvailable: false,
      statusMessage:
        opt.fallbackNote ||
        "Regional speech fallback via hi-IN; written & AI responses stay in your selected language.",
    };
  }
  if (!sttSupported && mediaRecorderSupported) {
    return {
      sttSupported: false,
      mediaRecorderSupported: true,
      ttsSupported,
      nativeVoiceAvailable: voiceCheck.exact,
      statusMessage:
        "Using on-demand Gemini Audio Capture fallback (transient mic clip transcribed & immediately discarded).",
    };
  }
  if (!sttSupported && !mediaRecorderSupported) {
    return {
      sttSupported: false,
      mediaRecorderSupported: false,
      ttsSupported,
      nativeVoiceAvailable: voiceCheck.exact,
      statusMessage:
        "Microphone speech capture is unsupported in this browser; keyboard entry + spoken AI playback remain ready.",
    };
  }
  return {
    sttSupported,
    mediaRecorderSupported,
    ttsSupported,
    nativeVoiceAvailable: voiceCheck.exact,
    statusMessage: voiceCheck.exact
      ? `Voice input & spoken playback ready (${opt.speechRecognitionLang}, plus Gemini audio fallback).`
      : `Speech recognition ready (${opt.speechRecognitionLang}); spoken playback uses available OS voice (${voiceCheck.resolvedTag}).`,
  };
}
