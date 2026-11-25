import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Globe,
  Send,
  X,
  ShieldCheck,
  Navigation,
  AlertCircle,
  Lock,
  Loader2,
  Radio,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import {
  blobToBase64,
  createSpeechRecognition,
  getPreferredAudioMimeType,
  getVoiceLanguageOption,
  inspectVoiceCapabilities,
  type SpeechRecognitionLike,
} from "../lib/voiceAssistant";
import {
  pauseSpeaking,
  resumeSpeaking,
  speakAlertText,
  stopSpeaking,
} from "../lib/tts";
import { AiProviderSwitcher, GeminiSparkleIcon } from "./GeminiBadgeIcon";
import { SafeMarkdownText } from "./SafeMarkdownText";
import { VoiceAssistant2D } from "./Illustrations2D";
import type {
  AiProviderId,
  GuardianIntelContext,
  LangCode,
  UnifiedChatMessage,
  VoiceLangCode,
  VoiceNavTarget,
} from "../types/guardian";

interface GuardianVoiceModalProps {
  open: boolean;
  uiLang: LangCode;
  voiceLang: VoiceLangCode;
  onChangeVoiceLang?: (lang: VoiceLangCode) => void;
  aiProvider: AiProviderId;
  onChangeProvider: (provider: AiProviderId) => void;
  onOpenLanguageModal: () => void;
  onNavigateTarget: (target: Exclude<VoiceNavTarget, null>) => void;
  intelContext?: GuardianIntelContext | null;
  sharedChatHistory?: UnifiedChatMessage[];
  onAppendUnifiedExchange?: (
    userMsg: UnifiedChatMessage,
    aiMsg: UnifiedChatMessage
  ) => void;
  onClose: () => void;
}

type MicCaptureState = "ready" | "listening" | "processing" | "detected" | "error";

const VOICE_QUICK_PROMPTS: {
  labelEn: string;
  labelHi: string;
  prompt: string;
}[] = [
  {
    labelEn: "Is KYC OTP call safe?",
    labelHi: "क्या KYC OTP कॉल सुरक्षित है?",
    prompt: "Someone called asking for OTP to update my bank KYC. Is this safe?",
  },
  {
    labelEn: "Open QR Scanner",
    labelHi: "QR स्कैनर खोलें",
    prompt: "Open live QR scanner",
  },
  {
    labelEn: "Open Cyber Check",
    labelHi: "साइबर सुरक्षा जांच खोलें",
    prompt: "Go to personal cyber safety check",
  },
  {
    labelEn: "Emergency Bank Call",
    labelHi: "आपातकालीन बैंक कॉल",
    prompt: "Open emergency call my bank",
  },
];

const QUICK_VOICE_LANGS: { code: VoiceLangCode; label: string; badge: string }[] = [
  { code: "en", label: "English", badge: "EN" },
  { code: "hi", label: "हिन्दी", badge: "हिं" },
  { code: "bn", label: "বাংলা", badge: "বাং" },
  { code: "ml", label: "മലയാളം", badge: "മല" },
  { code: "kn", label: "ಕನ್ನಡ", badge: "ಕನ್" },
  { code: "ta", label: "தமிழ்", badge: "தமி" },
  { code: "te", label: "తెలుగు", badge: "తె" },
  { code: "hinglish", label: "Hinglish", badge: "HiEn" },
];

export const GuardianVoiceModal: React.FC<GuardianVoiceModalProps> = ({
  open,
  uiLang,
  voiceLang,
  onChangeVoiceLang,
  aiProvider,
  onChangeProvider,
  onOpenLanguageModal,
  onNavigateTarget,
  intelContext,
  sharedChatHistory,
  onAppendUnifiedExchange,
  onClose,
}) => {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const baseTranscriptRef = useRef<string>("");
  const transcriptRef = useRef<string>("");
  const autoStopTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [captureMode, setCaptureMode] = useState<"speech_api" | "media_recorder" | null>(null);
  const [micState, setMicState] = useState<MicCaptureState>("ready");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [localHistory, setLocalHistory] = useState<UnifiedChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const [speakingState, setSpeakingState] = useState<"idle" | "speaking" | "paused">("idle");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const history = sharedChatHistory ?? localHistory;
  const langOption = getVoiceLanguageOption(voiceLang);
  const caps = inspectVoiceCapabilities(voiceLang);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, busy]);

  function clearMediaResources() {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      }
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  function stopAllCapture(nextState?: MicCaptureState) {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop error
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        clearMediaResources();
      }
    } else {
      clearMediaResources();
    }
    setCaptureMode(null);
    setInterimText("");
    if (nextState) {
      setMicState(nextState);
    } else {
      setMicState((prev) =>
        prev === "listening"
          ? transcriptRef.current.trim()
            ? "detected"
            : "ready"
          : prev
      );
    }
  }

  useEffect(() => {
    if (!open) {
      stopAllCapture("ready");
      stopSpeaking();
      setSpeakingState("idle");
      setSpeakingMessageId(null);
    }
    return () => {
      stopAllCapture();
      stopSpeaking();
    };
  }, [open]);

  if (!open) return null;

  async function startMediaRecorderFallback(reasonHint?: string) {
    setVoiceError(reasonHint || null);
    if (!caps.mediaRecorderSupported) {
      setMicState("error");
      setVoiceError(
        uiLang === "hi"
          ? "माइक्रोफ़ोन ऑडियो कैप्चर इस ब्राउज़र में उपलब्ध नहीं है। कृपया नीचे टाइप करके पूछें।"
          : "Microphone capture is unavailable in this browser. Type your question below."
      );
      return;
    }

    stopSpeaking();
    setSpeakingState("idle");
    setSpeakingMessageId(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getPreferredAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        clearMediaResources();
        setCaptureMode(null);
        setMicState("error");
        setVoiceError(
          uiLang === "hi"
            ? "ऑडियो रिकॉर्डिंग में त्रुटि हुई। कृपया पुनः प्रयास करें या नीचे लिखें।"
            : "Audio capture encountered an error. Try again or type below."
        );
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        const finalMime = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
        audioChunksRef.current = [];
        clearMediaResources();
        setCaptureMode(null);

        if (chunks.length === 0) {
          setMicState(transcriptRef.current.trim() ? "detected" : "ready");
          return;
        }

        const blob = new Blob(chunks, { type: finalMime });
        if (blob.size < 400) {
          setMicState("error");
          setVoiceError(
            uiLang === "hi"
              ? "कोई स्पष्ट आवाज़ सुनाई नहीं दी। कृपया माइक के पास थोड़ा स्पष्ट बोलें।"
              : "No clear speech audio detected. Please speak clearly closer to the mic."
          );
          return;
        }

        setMicState("processing");
        try {
          const base64Audio = await blobToBase64(blob);
          const res = await apiFetch<{ transcript: string; languageCode: VoiceLangCode }>(
            "/api/ai/transcribe",
            {
              method: "POST",
              body: JSON.stringify({
                audioBase64: base64Audio,
                base64Audio,
                mimeType: finalMime,
                voiceLang,
              }),
            }
          );
          const detected = (res.transcript || "").trim();
          if (!detected) {
            setMicState("error");
            setVoiceError(
              uiLang === "hi"
                ? "आवाज़ से पाठ पहचाना नहीं जा सका। कृपया फिर बोलें या नीचे लिखें।"
                : "Failed to recognise clear words from the audio. Please try again or type below."
            );
            return;
          }
          const combined = [baseTranscriptRef.current.trim(), detected]
            .filter(Boolean)
            .join(" ");
          setTranscript(combined);
          setMicState("detected");
        } catch (err) {
          setMicState("error");
          setVoiceError(
            err instanceof Error
              ? err.message
              : "Voice transcription failed. Please try again or type below."
          );
        }
      };

      baseTranscriptRef.current = transcriptRef.current.trim();
      mediaRecorderRef.current = recorder;
      setCaptureMode("media_recorder");
      setMicState("listening");
      recorder.start(250);

      // Auto-stop after 22s so clips remain concise and transient
      autoStopTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            // ignore
          }
        }
      }, 22000);
    } catch (err) {
      clearMediaResources();
      setCaptureMode(null);
      setMicState("error");
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceError(
          uiLang === "hi"
            ? "माइक्रोफ़ोन की अनुमति अस्वीकृत हुई। आप ब्राउज़र सेटिंग से माइक अनुमति दें या नीचे टाइप करें।"
            : "Microphone permission was denied. Allow mic access in browser settings or type below."
        );
      } else {
        setVoiceError(
          uiLang === "hi"
            ? "माइक्रोफ़ोन शुरू नहीं हो सका। कृपया नीचे अपना प्रश्न लिखें।"
            : "Could not access microphone hardware. You can type your question below."
        );
      }
    }
  }

  function startListening() {
    setVoiceError(null);
    stopSpeaking();
    setSpeakingState("idle");
    setSpeakingMessageId(null);

    if (!caps.sttSupported) {
      if (caps.mediaRecorderSupported) {
        void startMediaRecorderFallback();
      } else {
        setMicState("error");
        setVoiceError(
          uiLang === "hi"
            ? "इस ब्राउज़र में लाइव माइक्रोफ़ोन स्पीच-टू-टेक्स्ट समर्थित नहीं है। कृपया नीचे अपना सवाल लिखें।"
            : "Live speech-to-text is unavailable in this browser. Type or edit your message below."
        );
      }
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) {
      if (caps.mediaRecorderSupported) {
        void startMediaRecorderFallback();
      } else {
        setMicState("error");
        setVoiceError("Speech recognition could not initialize.");
      }
      return;
    }

    baseTranscriptRef.current = transcriptRef.current.trim();
    rec.lang = langOption.speechRecognitionLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setCaptureMode("speech_api");
      setMicState("listening");
    };

    rec.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        const part = item[0]?.transcript || "";
        if (item.isFinal) finalChunk += `${part} `;
        else interimChunk += part;
      }
      const combinedFinal = [baseTranscriptRef.current, finalChunk.trim()]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (finalChunk.trim()) {
        setTranscript(combinedFinal);
        setMicState("detected");
      }
      setInterimText(interimChunk.trim());
    };

    rec.onerror = (ev) => {
      recognitionRef.current = null;
      setCaptureMode(null);
      setInterimText("");

      if (ev.error === "service-not-allowed" || ev.error === "network") {
        if (caps.mediaRecorderSupported) {
          void startMediaRecorderFallback(
            uiLang === "hi"
              ? "ब्राउज़र स्पीच सेवा उपलब्ध नहीं थी — Gemini ऑडियो कैप्चर पर स्विच किया गया।"
              : "Browser speech service was blocked — switched to on-demand Gemini audio capture."
          );
          return;
        }
      }

      if (ev.error === "not-allowed") {
        setMicState("error");
        setVoiceError(
          uiLang === "hi"
            ? "माइक्रोफ़ोन अनुमति अस्वीकृत हुई। आप नीचे टाइप करके भी पूछ सकते हैं।"
            : "Microphone permission was declined. You can still type your question below."
        );
      } else if (ev.error === "no-speech") {
        setMicState("error");
        setVoiceError(
          uiLang === "hi"
            ? "कोई आवाज़ सुनाई नहीं दी। कृपया फिर बोलें या 'Gemini Audio STT' उपयोग करें।"
            : "No speech detected. Try speaking closer or tap 'Record Audio (Gemini STT)'."
        );
      } else if (ev.error !== "aborted") {
        setMicState("error");
        setVoiceError(
          uiLang === "hi"
            ? `वॉइस इनपुट त्रुटि (${ev.error})। कृपया पुनः प्रयास करें या टाइप करें।`
            : `Failed to recognise speech (${ev.error}). Try again or type below.`
        );
      }
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        setCaptureMode(null);
        setInterimText("");
        setMicState((prev) =>
          prev === "listening"
            ? transcriptRef.current.trim()
              ? "detected"
              : "ready"
            : prev
        );
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      if (caps.mediaRecorderSupported) {
        void startMediaRecorderFallback();
      } else {
        setMicState("error");
        setVoiceError("Could not start microphone capture.");
      }
    }
  }

  function speakText(textToSpeak: string, msgId?: string) {
    if (muted || !caps.ttsSupported) return;
    setSpeakingMessageId(msgId ?? null);
    speakAlertText(
      textToSpeak,
      voiceLang,
      {
        onStart: () => setSpeakingState("speaking"),
        onEnd: () => {
          setSpeakingState("idle");
          setSpeakingMessageId(null);
        },
        onError: () => {
          setSpeakingState("idle");
          setSpeakingMessageId(null);
        },
      },
      { muted }
    );
  }

  async function submitVoiceQuery(customPrompt?: string) {
    const combinedTranscript = [transcript, interimText].filter(Boolean).join(" ").trim();
    const queryText = (customPrompt ?? combinedTranscript).trim();
    if (!queryText || busy) return;

    stopAllCapture();
    setVoiceError(null);
    setBusy(true);
    setMicState("processing");

    const userMsg: UnifiedChatMessage = {
      id: `v-u-${Date.now()}`,
      role: "user",
      text: queryText,
      timestamp: Date.now(),
    };
    if (!sharedChatHistory) {
      setLocalHistory((prev) => [...prev, userMsg]);
    }
    if (!customPrompt) {
      setTranscript("");
      setInterimText("");
      baseTranscriptRef.current = "";
    }

    try {
      const res = await apiFetch<{
        reply: string;
        spokenReply: string;
        navigateTo: VoiceNavTarget;
        providerUsed: AiProviderId;
        languageCode: VoiceLangCode;
      }>("/api/ai/voice", {
        method: "POST",
        body: JSON.stringify({
          transcript: queryText,
          voiceLang,
          provider: aiProvider,
          history: [...history, userMsg]
            .slice(-12)
            .map((h) => ({ role: h.role, text: h.text })),
          guardianContext: intelContext || undefined,
        }),
      });

      const aiMsg: UnifiedChatMessage = {
        id: `v-a-${Date.now() + 1}`,
        role: "assistant",
        text: res.reply,
        spokenText: res.spokenReply || res.reply,
        navigateTo: res.navigateTo,
        providerUsed: res.providerUsed,
        timestamp: Date.now(),
      };

      if (onAppendUnifiedExchange) {
        onAppendUnifiedExchange(userMsg, aiMsg);
      } else {
        setLocalHistory((prev) => [...prev, aiMsg]);
      }

      setMicState("ready");
      speakText(aiMsg.spokenText || aiMsg.text, aiMsg.id);
      if (res.navigateTo) {
        onNavigateTarget(res.navigateTo);
      }
    } catch (err) {
      if (aiProvider === "gemini") {
        onChangeProvider("guardian");
        try {
          const res = await apiFetch<{
            reply: string;
            spokenReply: string;
            navigateTo: VoiceNavTarget;
            providerUsed: AiProviderId;
            languageCode: VoiceLangCode;
          }>("/api/ai/voice", {
            method: "POST",
            body: JSON.stringify({
              transcript: queryText,
              voiceLang,
              provider: "guardian",
              history: [...history, userMsg]
                .slice(-12)
                .map((h) => ({ role: h.role, text: h.text })),
              guardianContext: intelContext || undefined,
            }),
          });

          const aiMsg: UnifiedChatMessage = {
            id: `v-a-${Date.now() + 1}`,
            role: "assistant",
            text: res.reply,
            spokenText: res.spokenReply || res.reply,
            navigateTo: res.navigateTo,
            providerUsed: res.providerUsed,
            timestamp: Date.now(),
          };

          if (onAppendUnifiedExchange) {
            onAppendUnifiedExchange(userMsg, aiMsg);
          } else {
            setLocalHistory((prev) => [...prev, aiMsg]);
          }

          setMicState("ready");
          speakText(aiMsg.spokenText || aiMsg.text, aiMsg.id);
          if (res.navigateTo) {
            onNavigateTarget(res.navigateTo);
          }
          return;
        } catch {
          // continue to regular error fallback
        }
      }
      const errMsg = err instanceof Error ? err.message : "Voice assistant request failed.";
      setVoiceError(errMsg);
      setMicState("error");
      if (!customPrompt) {
        setTranscript(queryText);
      }
    } finally {
      setBusy(false);
    }
  }

  const micStatusLabel =
    micState === "listening"
      ? uiLang === "hi"
        ? captureMode === "media_recorder"
          ? "ऑडियो रिकॉर्ड हो रहा है..."
          : "माइक्रोफ़ोन सुन रहा है..."
        : captureMode === "media_recorder"
          ? "Listening (Gemini audio)..."
          : "Listening..."
      : micState === "processing"
        ? uiLang === "hi"
          ? "आवाज़ समझी जा रही है..."
          : "Processing..."
        : micState === "detected"
          ? uiLang === "hi"
            ? "पाठ पहचाना गया"
            : "Text detected"
          : micState === "error"
            ? uiLang === "hi"
              ? "आवाज़ पहचानने में त्रुटि"
              : "Failed to recognise speech"
            : uiLang === "hi"
              ? "सुनने के लिए तैयार"
              : "Ready to listen";

  const micStatusTone =
    micState === "listening"
      ? "text-[#E87575] border-[#E87575]/45 bg-[#2E1219]"
      : micState === "processing"
        ? "text-[#E6C98A] border-[#C6A15B]/45 bg-[#10243A]"
        : micState === "detected"
          ? "text-[#43C6A5] border-[#43C6A5]/45 bg-[#0B2825]"
          : micState === "error"
            ? "text-[#E87575] border-[#E87575]/45 bg-[#2E1219]"
            : "text-[#AEBBC9] border-[#C6A15B]/30 bg-[#10243A]";

  const displayedInputValue = interimText
    ? [transcript, interimText].filter(Boolean).join(" ")
    : transcript;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guardian-voice-title"
      className="fixed inset-0 z-50 bg-[#071525]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div className="gm-glass-card rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        {/* Header with 2D Illustration */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#C6A15B]/25">
          <div className="flex items-start gap-3.5 min-w-0">
            <VoiceAssistant2D className="w-12 h-12 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="guardian-voice-title" className="font-display text-lg font-bold text-[#F4F0E6]">
                  {uiLang === "hi" ? "गार्जियन AI वॉइस सहायक" : "Guardian AI Voice Assistant"}
                </h2>
                {aiProvider === "gemini" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E6C98A]">
                    <GeminiSparkleIcon className="w-3.5 h-3.5" /> Gemini
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#AEBBC9]">
                {uiLang === "hi"
                  ? "सुरक्षा प्रश्न पूछें, स्कैन परिणाम समझें या बोलकर अनुभाग खोलें।"
                  : "Speak naturally, transcribe instantly, get grounded safety answers & spoken playback."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopAllCapture("ready");
              stopSpeaking();
              onClose();
            }}
            aria-label={uiLang === "hi" ? "वॉइस सहायक बंद करें" : "Close voice assistant"}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#10243A] flex items-center justify-center text-[#AEBBC9] hover:text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Switcher + Quick English / Hindi / Hinglish + All Languages Modal */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-7">
              <AiProviderSwitcher provider={aiProvider} onChange={onChangeProvider} lang={uiLang} />
            </div>
            <div className="sm:col-span-5">
              <button
                type="button"
                onClick={onOpenLanguageModal}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#C6A15B]/45 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] flex items-center justify-between gap-2 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-[#E6C98A] shrink-0" />
                  <span className="truncate">{langOption.nativeName}</span>
                </span>
                <span className="text-[11px] font-bold text-[#C6A15B] shrink-0">
                  {uiLang === "hi" ? "सभी भाषाएं" : "All Languages"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-[#AEBBC9]">
              {uiLang === "hi" ? "त्वरित भाषा:" : "Quick voice mode:"}
            </span>
            {QUICK_VOICE_LANGS.map((opt) => {
              const active = voiceLang === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onChangeVoiceLang?.(opt.code)}
                  className={`min-h-[32px] px-3 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-[#252A32] border-[#E6C98A] text-[#E6C98A]"
                      : "bg-[#10243A]/75 border-[#C6A15B]/25 text-[#AEBBC9] hover:text-[#F4F0E6]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {intelContext?.summary && (
              <span className="ml-auto text-[11px] px-2.5 py-1 rounded-lg bg-[#0B2825] border border-[#43C6A5]/35 text-[#43C6A5] font-medium truncate max-w-full">
                {uiLang === "hi" ? "सक्रिय संदर्भ:" : "Active scan:"} {intelContext.activeSection}
                {typeof intelContext.score === "number" ? ` · ${intelContext.score}/100` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Microphone Control + Animated Listening Indicator + Editable Transcript Box */}
        <div className="p-4 rounded-2xl bg-[#071525]/85 border border-[#C6A15B]/30 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {micState !== "listening" ? (
                <>
                  <button
                    type="button"
                    disabled={busy || micState === "processing"}
                    onClick={startListening}
                    className="min-h-[44px] px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{uiLang === "hi" ? "बोलना शुरू करें" : "Start Listening"}</span>
                  </button>

                  {caps.sttSupported && caps.mediaRecorderSupported && (
                    <button
                      type="button"
                      disabled={busy || micState === "processing"}
                      onClick={() => startMediaRecorderFallback()}
                      title="Capture short audio clip & transcribe via Gemini"
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#E6C98A] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{uiLang === "hi" ? "ऑडियो रिकॉर्ड (Gemini)" : "Record Audio (Gemini STT)"}</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    stopAllCapture(captureMode === "media_recorder" ? "processing" : undefined)
                  }
                  className="min-h-[44px] px-4 py-2 rounded-xl gm-emergency-btn text-xs font-bold inline-flex items-center gap-2 gm-gold-pulse transition-all cursor-pointer active:scale-[0.98]"
                >
                  <MicOff className="w-4 h-4" />
                  <span>
                    {captureMode === "media_recorder"
                      ? uiLang === "hi"
                        ? "रोकें व लिखें"
                        : "Stop & Transcribe"
                      : uiLang === "hi"
                        ? "सुनना रोकें"
                        : "Stop Microphone"}
                  </span>
                </button>
              )}

              {/* Playback Controls */}
              {caps.ttsSupported && (
                <div className="inline-flex items-center gap-1.5">
                  {speakingState === "speaking" ? (
                    <button
                      type="button"
                      onClick={() => {
                        pauseSpeaking();
                        setSpeakingState("paused");
                      }}
                      aria-label="Pause spoken response"
                      className="min-h-[40px] px-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] text-xs font-semibold text-[#E6C98A] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>{uiLang === "hi" ? "रोकें" : "Pause"}</span>
                    </button>
                  ) : speakingState === "paused" ? (
                    <button
                      type="button"
                      onClick={() => {
                        resumeSpeaking();
                        setSpeakingState("speaking");
                      }}
                      aria-label="Resume spoken response"
                      className="min-h-[40px] px-2.5 rounded-xl border border-[#43C6A5]/45 bg-[#0B2825] text-xs font-semibold text-[#43C6A5] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{uiLang === "hi" ? "जारी" : "Resume"}</span>
                    </button>
                  ) : null}

                  {speakingState !== "idle" && (
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeaking();
                        setSpeakingState("idle");
                        setSpeakingMessageId(null);
                      }}
                      aria-label="Stop voice output"
                      className="min-h-[40px] px-2.5 rounded-xl border border-[#E87575]/45 bg-[#2E1219] text-xs font-semibold text-[#E87575] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{uiLang === "hi" ? "बंद" : "Stop"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const nextMute = !muted;
                      setMuted(nextMute);
                      if (nextMute) {
                        stopSpeaking();
                        setSpeakingState("idle");
                        setSpeakingMessageId(null);
                      }
                    }}
                    aria-label={muted ? "Unmute AI voice" : "Mute AI voice"}
                    title={muted ? "Voice muted — tap to unmute" : "Auto-speak enabled — tap to mute"}
                    className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A] text-[#AEBBC9] hover:text-[#F4F0E6] inline-flex items-center justify-center cursor-pointer"
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4 text-[#E87575]" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#E6C98A]" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Mic State Indicator */}
            <div
              role="status"
              aria-live="polite"
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-2 ${micStatusTone}`}
            >
              {micState === "listening" && (
                <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                  <span className="w-0.5 h-2 bg-[#E87575] rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-[#E6C98A] rounded-full animate-pulse" />
                  <span className="w-0.5 h-1.5 bg-[#E87575] rounded-full animate-pulse" />
                </span>
              )}
              {micState === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{micStatusLabel}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="voice-transcript-box" className="block text-xs font-semibold text-[#E6C98A]">
              {uiLang === "hi"
                ? "पहचाना गया पाठ (भेजने से पहले संपादित करें):"
                : "Recognized Transcript / Voice Prompt (Editable before sending):"}
            </label>
            <div className="flex gap-2">
              <textarea
                id="voice-transcript-box"
                rows={2}
                value={displayedInputValue}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setInterimText("");
                  if (micState === "error" || micState === "ready") {
                    setMicState(e.target.value.trim() ? "detected" : "ready");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitVoiceQuery();
                  }
                }}
                placeholder={
                  uiLang === "hi"
                    ? "बोलें या यहां लिखें — जैसे 'QR स्कैनर खोलें' या 'क्या KYC OTP कॉल सुरक्षित है?'"
                    : "Speak or type here — e.g. 'Open QR scanner' or 'Should I share OTP for KYC?'"
                }
                className="flex-1 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/90 px-3.5 py-2.5 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
              />
              <button
                type="button"
                disabled={busy || !displayedInputValue.trim()}
                onClick={() => submitVoiceQuery()}
                aria-label={uiLang === "hi" ? "भेजें" : "Send voice prompt"}
                className="min-h-[48px] px-4 rounded-xl gm-gold-btn text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98] shrink-0"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{busy ? "..." : uiLang === "hi" ? "पूछें" : "Ask"}</span>
              </button>
            </div>
          </div>

          {/* Quick Voice Action Suggestions */}
          <div className="flex flex-wrap gap-2">
            {VOICE_QUICK_PROMPTS.map((q) => (
              <button
                key={q.labelEn}
                type="button"
                disabled={busy}
                onClick={() => submitVoiceQuery(q.prompt)}
                className="min-h-[34px] px-3 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 hover:border-[#E6C98A] text-[11px] font-semibold text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {uiLang === "hi" ? q.labelHi : q.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Browser Support & Error Notice */}
        {voiceError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#2E1219] border border-[#E87575]/45 text-xs text-[#E87575] space-y-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{voiceError}</span>
            </div>
            {aiProvider === "gemini" && (
              <div className="flex flex-wrap gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => {
                    onChangeProvider("guardian");
                    setVoiceError(null);
                    setMicState("ready");
                    if (displayedInputValue.trim()) {
                      void submitVoiceQuery();
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0B2825] border border-[#43C6A5]/45 text-[#43C6A5] text-[11px] font-semibold cursor-pointer hover:bg-[#0B2825]/80"
                >
                  {uiLang === "hi" ? "गार्जियन सलाहकार से पूछें" : "Try Guardian Advisor"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unified Conversation History */}
        {(history.length > 0 || busy) && (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed border ${
                  item.role === "user"
                    ? "bg-[#10243A] border-[#C6A15B]/30 text-[#F4F0E6] ml-8"
                    : "bg-[#252A32]/85 border-[#E6C98A]/40 text-[#F4F0E6] mr-4"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-[#E6C98A]">
                    {item.role === "user"
                      ? uiLang === "hi"
                        ? "आप"
                        : "You"
                      : "Guardian Voice AI"}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.navigateTo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#43C6A5]">
                        <Navigation className="w-3 h-3" /> {item.navigateTo}
                      </span>
                    )}
                    {item.role === "assistant" && caps.ttsSupported && (
                      <button
                        type="button"
                        onClick={() => {
                          if (muted) setMuted(false);
                          speakAlertText(
                            item.spokenText || item.text,
                            voiceLang,
                            {
                              onStart: () => {
                                setSpeakingMessageId(item.id);
                                setSpeakingState("speaking");
                              },
                              onEnd: () => {
                                setSpeakingState("idle");
                                setSpeakingMessageId(null);
                              },
                              onError: () => {
                                setSpeakingState("idle");
                                setSpeakingMessageId(null);
                              },
                            },
                            { muted: false }
                          );
                        }}
                        aria-label="Replay spoken response"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#C6A15B]/30 bg-[#071525] text-[10px] font-semibold text-[#E6C98A] hover:border-[#E6C98A] cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>
                          {speakingMessageId === item.id && speakingState === "speaking"
                            ? uiLang === "hi"
                              ? "बोल रहा है"
                              : "Speaking"
                            : uiLang === "hi"
                              ? "सुनें / दोबारा सुनें"
                              : "Replay"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {item.role === "assistant" ? (
                  <SafeMarkdownText text={item.text} className="text-xs text-[#F4F0E6]" />
                ) : (
                  <p className="whitespace-pre-wrap">{item.text}</p>
                )}
              </div>
            ))}

            {busy && (
              <div className="p-3.5 rounded-2xl bg-[#252A32]/85 border border-[#C6A15B]/35 mr-8 text-xs text-[#E6C98A] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {uiLang === "hi"
                    ? "Guardian AI आपका सुरक्षा उत्तर तैयार कर रहा है..."
                    : "Guardian AI is preparing your safety guidance..."}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Explicit Privacy & Zero-Recording Guarantee */}
        <div className="p-3.5 rounded-2xl bg-[#0B2825]/60 border border-[#43C6A5]/35 flex items-start gap-2.5 text-[11px] text-[#AEBBC9]">
          <Lock className="w-4 h-4 text-[#43C6A5] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-[#43C6A5] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {uiLang === "hi"
                ? "शून्य ऑडियो संग्रहण · कोई पृष्ठभूमि माइक्रोफ़ोन नहीं"
                : "Zero Audio Recording Storage · On-Demand Microphone Only"}
            </p>
            <p>
              {caps.statusMessage}{" "}
              {uiLang === "hi"
                ? "आवाज़ केवल तभी सुनी जाती है जब आप ऊपर माइक बटन दबाते हैं; कोई ऑडियो फ़ाइल रिकॉर्ड या डेटाबेस में सेव नहीं होती।"
                : "Microphone runs only while you explicitly activate listening; zero audio clips are saved to disk or database."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
