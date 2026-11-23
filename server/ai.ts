import { GoogleGenAI, Type } from "@google/genai";

export type AiProviderId = "gemini" | "guardian";
export type VoiceLangCode =
  | "en"
  | "hi"
  | "hinglish"
  | "bn"
  | "ml"
  | "kn"
  | "ta"
  | "te"
  | "mr"
  | "bgc"
  | "bho";

export type VoiceNavTarget =
  | "overview"
  | "scam_qr"
  | "cyber_check"
  | "calls_links"
  | "awareness"
  | "approvals"
  | "parents_ai"
  | "emergency_call"
  | "live_qr"
  | null;

export interface GuardianIntelContextInput {
  activeSection?: string;
  contextType?: string;
  summary?: string;
  score?: number;
  riskLevel?: string;
  verificationStatus?: string;
  signals?: string[];
  sourcesUnavailable?: string[];
}

export class GeminiServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 502, code = "GEMINI_UNAVAILABLE") {
    super(message);
    this.name = "GeminiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const GEMINI_TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GEMINI_TRANSCRIBE_MODEL =
  process.env.GEMINI_TRANSCRIBE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

const LANGUAGE_INSTRUCTIONS: Record<VoiceLangCode, string> = {
  en: "simple, clear, reassuring English suitable for parents and elderly users",
  hi: "Hindi (natural Devanagari script हिन्दी, simple, warm, and respectful tone)",
  hinglish: "natural Hinglish (friendly conversational mix of Hindi in Roman script and simple English, easy for Indian parents to read and hear)",
  bn: "Bengali (natural Bengali script বাংলা, simple respectful tone)",
  ml: "Malayalam (natural Malayalam script മലയാളം, simple, warm, and respectful tone)",
  kn: "Kannada (natural Kannada script ಕನ್ನಡ, simple, warm, and respectful tone)",
  ta: "Tamil (natural Tamil script தமிழ், simple, warm, and respectful tone)",
  te: "Telugu (natural Telugu script తెలుగు, clear, warm, and respectful tone)",
  mr: "Marathi (natural Devanagari script मराठी, simple respectful tone)",
  bgc: "Haryanvi written cleanly in Devanagari script, warm and easy to understand for elders",
  bho: "Bhojpuri / Bihari written cleanly in Devanagari script, warm and easy to understand for elders",
};

export function detectLanguageFromText(text: string): VoiceLangCode | null {
  if (!text) return null;
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml"; // Malayalam
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn"; // Kannada
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi)
  if (/\b(kya|kaise|batao|karo|nahi|paise|rupaye|mera|aap|hoga|mujhe|dhokha|bheja|khata|bataiye)\b/i.test(text)) {
    return "hinglish";
  }
  return null;
}

export function normalizeVoiceLang(lang?: string, textHint?: string): VoiceLangCode {
  if (textHint) {
    const detected = detectLanguageFromText(textHint);
    if (detected && (!lang || lang === "en")) {
      return detected;
    }
  }
  const clean = String(lang || "en").trim().toLowerCase();
  if (
    clean === "hi" ||
    clean === "hinglish" ||
    clean === "bn" ||
    clean === "ml" ||
    clean === "kn" ||
    clean === "ta" ||
    clean === "te" ||
    clean === "mr" ||
    clean === "bgc" ||
    clean === "bho"
  ) {
    return clean;
  }
  return "en";
}

export function isGeminiConfigured(): boolean {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  return Boolean(apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "REPLACE_WITH_YOUR_KEY");
}

function getAiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "REPLACE_WITH_YOUR_KEY") {
    throw new GeminiServiceError(
      "Gemini API key is not configured in Settings > Secrets. Switch to Guardian Advisor or configure GEMINI_API_KEY on the server.",
      503,
      "GEMINI_KEY_MISSING"
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractRawStatusAndMessage(err: unknown): { status?: number; message: string } {
  if (!err) return { message: "Unknown Gemini service error." };
  const errObj = err as { status?: number; statusCode?: number; code?: number; message?: string };
  let msg = errObj.message || (typeof err === "string" ? err : "Unknown Gemini error.");
  let status = errObj.status ?? errObj.statusCode ?? (typeof errObj.code === "number" ? errObj.code : undefined);

  // @google/genai often embeds raw JSON inside err.message
  const trimmed = msg.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { code?: number; message?: string; status?: string } };
      if (parsed.error?.message) msg = parsed.error.message;
      if (typeof parsed.error?.code === "number") status = parsed.error.code;
    } catch {
      // ignore non-JSON message
    }
  }
  return { status, message: msg };
}

export function mapGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const { status, message } = extractRawStatusAndMessage(err);
  const lower = message.toLowerCase();

  if (lower.includes("not configured") || lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
    return new GeminiServiceError(
      "Gemini API key is missing or invalid on the server. Please verify GEMINI_API_KEY in Settings > Secrets.",
      503,
      "GEMINI_AUTH_ERROR"
    );
  }
  if (status === 401 || status === 403 || lower.includes("permission denied") || lower.includes("unauthorized")) {
    return new GeminiServiceError(
      "Gemini API authentication was rejected. Please verify the server GEMINI_API_KEY permissions.",
      502,
      "GEMINI_AUTH_ERROR"
    );
  }
  if (status === 404 || lower.includes("model") && (lower.includes("not found") || lower.includes("unsupported"))) {
    return new GeminiServiceError(
      "The configured Gemini model is currently unavailable for this project.",
      502,
      "GEMINI_MODEL_UNAVAILABLE"
    );
  }
  if (status === 429 || lower.includes("quota") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return new GeminiServiceError(
      "Gemini AI usage limit reached temporarily. Please wait a few seconds or switch to Guardian Advisor.",
      429,
      "GEMINI_QUOTA_EXCEEDED"
    );
  }
  if (status === 503 || lower.includes("high demand") || lower.includes("overloaded") || lower.includes("unavailable")) {
    return new GeminiServiceError(
      "Gemini AI is experiencing high demand right now. Please retry in a moment or switch to Guardian Advisor.",
      503,
      "GEMINI_HIGH_DEMAND"
    );
  }
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted")) {
    return new GeminiServiceError(
      "Gemini AI took too long to respond. Please try a shorter question or retry.",
      504,
      "GEMINI_TIMEOUT"
    );
  }
  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("network")) {
    return new GeminiServiceError(
      "Network connection to Gemini AI failed. Check connectivity and try again.",
      502,
      "GEMINI_NETWORK_ERROR"
    );
  }
  return new GeminiServiceError(
    message.length > 220 ? `${message.slice(0, 217)}...` : message,
    502,
    "GEMINI_REQUEST_FAILED"
  );
}

async function withGeminiTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxRetries = options.maxRetries ?? 1;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new GeminiServiceError("Gemini AI request timed out.", 504, "GEMINI_TIMEOUT")), timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      lastErr = err;
      const mapped = mapGeminiError(err);
      const retryable = mapped.statusCode === 503 && attempt < maxRetries;
      if (!retryable) {
        throw mapped;
      }
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  throw mapGeminiError(lastErr);
}

export async function generateContentWithModelFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  options: { timeoutMs?: number; maxRetries?: number } = {}
) {
  const modelsToTry = Array.from(new Set([preferredModel, ...FALLBACK_MODELS].filter(Boolean)));
  let lastErr: unknown;
  for (let i = 0; i < modelsToTry.length; i += 1) {
    const candidateModel = modelsToTry[i];
    try {
      return await withGeminiTimeoutAndRetry(
        () => ai.models.generateContent({ ...params, model: candidateModel }),
        options
      );
    } catch (err) {
      lastErr = err;
      const mapped = mapGeminiError(err);
      const isLast = i === modelsToTry.length - 1;
      if (
        !isLast &&
        (mapped.code === "GEMINI_MODEL_UNAVAILABLE" || mapped.statusCode === 404 || mapped.statusCode === 502)
      ) {
        continue;
      }
      throw mapped;
    }
  }
  throw mapGeminiError(lastErr);
}

export function redactSensitive(text: string): string {
  return String(text || "")
    .replace(/\b\d{4,16}\b/g, "[NUMBER]")
    .replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+/g, "[UPI_OR_EMAIL]")
    .trim();
}

export function detectVoiceNavigationIntent(transcript: string): VoiceNavTarget {
  const q = String(transcript || "").toLowerCase();
  if (!q) return null;

  if (/(emergency|sos|call my bank|call bank|fraud helpline|1930|bank helpline|आपातकाल|बैंक को कॉल|জরুরি|तात्काळ|అత్యవసర)/i.test(q)) {
    return "emergency_call";
  }
  if (/(live qr|scan qr|qr scanner|open.*qr.*scanner|camera qr|open scanner|qr स्कैन|क्यूआर स्कैन|লাইव qr|qr స్కాన్)/i.test(q)) {
    return "live_qr";
  }
  if (/(scam qr|qr check|qr inspector|message check|qr जांच|संदेश जांच)/i.test(q)) {
    return "scam_qr";
  }
  if (/(cyber check|safety check|check number|verify upi|verify link|साइबर सुरक्षा|नंबर जांच)/i.test(q)) {
    return "cyber_check";
  }
  if (/(phone fraud|call protection|calls|phishing|कॉल सुरक्षा|फ़ोन धोखाधड़ी|কল সুরক্ষা)/i.test(q)) {
    return "calls_links";
  }
  if (/(awareness|scam guide|learn scam|जागरूकता|गाइड|সচেতনতা|జాగ్రత్త)/i.test(q)) {
    return "awareness";
  }
  if (/(approval|settings|profile|manage bank|family hub|अनुमोदन|सेटिंग्स|परिवार)/i.test(q)) {
    return "approvals";
  }
  if (/(parents ai|budget|financial insights|पेरेंट्स|बजट)/i.test(q)) {
    return "parents_ai";
  }
  if (/(overview|dashboard|home|डैशबोर्ड|होम|ড্যাশবোর্ড|హోమ్)/i.test(q)) {
    return "overview";
  }
  return null;
}

const LOCAL_NAV_CONFIRM: Record<VoiceLangCode, Record<Exclude<VoiceNavTarget, null>, string>> = {
  en: {
    overview: "Opening your Guardian Dashboard overview.",
    scam_qr: "Opening QR & Scam Message Check.",
    cyber_check: "Opening Personal Cyber Safety Check.",
    calls_links: "Opening Phone Fraud & Link Protection.",
    awareness: "Opening the Cyber Awareness & Scam Guides centre.",
    approvals: "Opening Family Approvals & Settings.",
    parents_ai: "Opening Parents AI & Financial Insights.",
    emergency_call: "Opening Bank Emergency Assistance right away.",
    live_qr: "Opening the Live Camera QR Scanner.",
  },
  hi: {
    overview: "आपका गार्जियन डैशबोर्ड खोला जा रहा है।",
    scam_qr: "QR और संदेश जांच अनुभाग खोला जा रहा है।",
    cyber_check: "व्यक्तिगत साइबर सुरक्षा जांच खोली जा रही है।",
    calls_links: "फ़ोन धोखाधड़ी और कॉल सुरक्षा खोली जा रही है।",
    awareness: "साइबर जागरूकता और स्कैम गाइड केंद्र खोला जा रहा है।",
    approvals: "परिवार अनुमोदन और सेटिंग्स खोली जा रही हैं।",
    parents_ai: "पेरेंट्स AI और वित्तीय अंतर्दृष्टि खोली जा रही है।",
    emergency_call: "तुरंत आपातकालीन बैंक कॉल सहायता खोली जा रही है।",
    live_qr: "लाइव कैमरा QR स्कैनर खोला जा रहा है।",
  },
  hinglish: {
    overview: "Aapka Guardian Dashboard overview khola ja raha hai.",
    scam_qr: "QR aur Scam Message Check section khol rahe hain.",
    cyber_check: "Personal Cyber Safety Check section khol rahe hain.",
    calls_links: "Phone Fraud aur Call Protection khol rahe hain.",
    awareness: "Cyber Awareness aur Scam Guides khol rahe hain.",
    approvals: "Family Approvals aur Settings khol rahe hain.",
    parents_ai: "Parents AI aur Financial Insights khol rahe hain.",
    emergency_call: "Turant Bank Emergency Assistance khol rahe hain.",
    live_qr: "Live Camera QR Scanner khol rahe hain.",
  },
  bn: {
    overview: "গার্ডিয়ান ড্যাশবোর্ড খোলা হচ্ছে।",
    scam_qr: "QR এবং স্ক্যাম বার্তা যাচাই খোলা হচ্ছে।",
    cyber_check: "ব্যক্তিগত সাইবার নিরাপত্তা যাচাই খোলা হচ্ছে।",
    calls_links: "ফোন জালিয়াতি এবং কল সুরক্ষা খোলা হচ্ছে।",
    awareness: "সাইবার সচেতনতা কেন্দ্র খোলা হচ্ছে।",
    approvals: "পারিবারিক অনুমোদন ও সেটিংস খোলা হচ্ছে।",
    parents_ai: "প্যারেন্টস AI খোলা হচ্ছে।",
    emergency_call: "জরুরি ব্যাংক কল সহায়তা খোলা হচ্ছে।",
    live_qr: "লাইভ ক্যামেরা QR স্ক্যানার খোলা হচ্ছে।",
  },
  mr: {
    overview: "गार्जियन डॅशबोर्ड उघडत आहे.",
    scam_qr: "QR आणि फसवणूक तपासणी विभाग उघडत आहे.",
    cyber_check: "वैयक्तिक सायबर सुरक्षा तपासणी उघडत आहे.",
    calls_links: "फोन फसवणूक आणि कॉल सुरक्षा उघडत आहे.",
    awareness: "सायबर जागरूकता केंद्र उघडत आहे.",
    approvals: "कुटुंब मान्यता आणि सेटिंग्ज उघडत आहेत.",
    parents_ai: "पॅरेंट्स AI उघडत आहे.",
    emergency_call: "तात्काळ बँक कॉल मदत उघडत आहे.",
    live_qr: "लाइव्ह कॅमेरा QR स्कॅनर उघडत आहे.",
  },
  te: {
    overview: "మీ గార్డియన్ డ్యాష్‌బోర్డ్ తెరుస్తున్నాను.",
    scam_qr: "QR మరియు స్కామ్ సందేశ తనిఖీ విభాగం తెరుస్తున్నాను.",
    cyber_check: "వ్యక్తిగత సైబర్ భద్రతా తనిఖీ తెరుస్తున్నాను.",
    calls_links: "ఫోన్ మోసం మరియు కాల్ రక్షణ తెరుస్తున్నాను.",
    awareness: "సైబర్ అవగాహన కేంద్రం తెరుస్తున్నాను.",
    approvals: "కుటుంబ ఆమోదాలు మరియు సెట్టింగ్స్ తెరుస్తున్నాను.",
    parents_ai: "పేరెంట్స్ AI తెరుస్తున్నాను.",
    emergency_call: "అత్యవసర బ్యాంక్ కాల్ సహాయం తెరుస్తున్నాను.",
    live_qr: "లైవ్ కెమెరా QR స్కానర్ తెరుస్తున్నాను.",
  },
  ml: {
    overview: "നിങ്ങളുടെ ഗാർഡിയൻ ഡാഷ്‌ബോർഡ് തുറക്കുന്നു.",
    scam_qr: "ക്യുആർ & തട്ടിപ്പ് സന്ദേശ പരിശോധന തുറക്കുന്നു.",
    cyber_check: "വ്യക്തിഗത സൈബർ സുരക്ഷാ പരിശോധന തുറക്കുന്നു.",
    calls_links: "ഫോൺ തട്ടിപ്പ്, കോൾ സുരക്ഷ തുറക്കുന്നു.",
    awareness: "സൈബർ ബോധവൽക്കരണ കേന്ദ്രം തുറക്കുന്നു.",
    approvals: "കുടുംബ അനുമതികളും ക്രമീകരണങ്ങളും തുറക്കുന്നു.",
    parents_ai: "പേരെന്റ്സ് എഐ തുറക്കുന്നു.",
    emergency_call: "അടിയന്തര ബാങ്ക് കോൾ സഹായം ഉടൻ തുറക്കുന്നു.",
    live_qr: "തത്സമയ ക്യാമറ ക്യുആർ സ്കാനർ തുറക്കുന്നു.",
  },
  kn: {
    overview: "ನಿಮ್ಮ ಗಾರ್ಡಿಯನ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    scam_qr: "ಕ್ಯೂಆರ್ ಮತ್ತು ವಂಚನೆ ಸಂದೇಶ ಪರಿಶೀಲನೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    cyber_check: "ವೈಯಕ್ತಿಕ ಸೈಬರ್ ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    calls_links: "ಫೋನ್ ವಂಚನೆ ಮತ್ತು ಕರೆ ರಕ್ಷಣೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    awareness: "ಸೈಬರ್ ಜಾಗೃತಿ ಕೇಂದ್ರ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    approvals: "ಕುಟುಂಬ ಅನುಮೋದನೆಗಳು ಮತ್ತು ಸೆಟ್ಟಿಂಗ್ಸ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    parents_ai: "ಪೇರೆಂಟ್ಸ್ ಎಐ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    emergency_call: "ತುರ್ತು ಬ್ಯಾಂಕ್ ಕರೆ ನೆರವು ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
    live_qr: "ಲೈವ್ ಕ್ಯಾಮೆರಾ ಕ್ಯೂಆರ್ ಸ್ಕ್ಯಾನರ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.",
  },
  ta: {
    overview: "உங்கள் கார்டியன் டாஷ்போர்டு திறக்கப்படுகிறது.",
    scam_qr: "க்யூஆர் மற்றும் மோசடி செய்தி சரிபார்ப்பு திறக்கப்படுகிறது.",
    cyber_check: "தனிப்பட்ட சைபர் பாதுகாப்பு சரிபார்ப்பு திறக்கப்படுகிறது.",
    calls_links: "தொலைபேசி மோசடி மற்றும் அழைப்பு பாதுகாப்பு திறக்கப்படுகிறது.",
    awareness: "சைபர் விழிப்புணர்வு மையம் திறக்கப்படுகிறது.",
    approvals: "குடும்ப ஒப்புதல்கள் மற்றும் அமைப்புகள் திறக்கப்படுகிறது.",
    parents_ai: "பேரண்ட்ஸ் ஏஐ திறக்கப்படுகிறது.",
    emergency_call: "அவசர வங்கி அழைப்பு உதவி திறக்கப்படுகிறது.",
    live_qr: "நேரலை கேமரா க்யூஆர் ஸ்கேனர் திறக்கப்படுகிறது.",
  },
  bgc: {
    overview: "आपका गार्जियन डैशबोर्ड खोल रहे हैं।",
    scam_qr: "QR और संदेश जांच वाला हिस्सा खोल रहे हैं।",
    cyber_check: "साइबर सुरक्षा जांच खोल रहे हैं।",
    calls_links: "कॉल सुरक्षा और नंबर जांच खोल रहे हैं।",
    awareness: "साइबर जागरूकता गाइड खोल रहे हैं।",
    approvals: "परिवार की मंजूरी और सेटिंग्स खोल रहे हैं।",
    parents_ai: "पेरेंट्स AI मदद खोल रहे हैं।",
    emergency_call: "तुरंत इमरजेंसी बैंक कॉल मदद खोल रहे हैं।",
    live_qr: "लाइव कैमरा QR स्कैनर खोल रहे हैं।",
  },
  bho: {
    overview: "रउआ गार्जियन डैशबोर्ड खुल रहल बा।",
    scam_qr: "QR आ संदेश जांच वाला पेज खुल रहल बा।",
    cyber_check: "साइबर सुरक्षा जांच खुल रहल बा।",
    calls_links: "फ़ोन कॉल सुरक्षा खुल रहल बा।",
    awareness: "साइबर जागरूकता गाइड खुल रहल बा।",
    approvals: "परिवार मंजूरी आ सेटिंग्स खुल रहल बा।",
    parents_ai: "पेरेंट्स AI खुल रहल बा।",
    emergency_call: "तुरंत इमरजेंसी बैंक कॉल मदद खुल रहल बा।",
    live_qr: "लाइव कैमरा QR स्कैनर खुल रहल बा।",
  },
};

const LOCAL_SAFETY_ADVICE: Record<VoiceLangCode, { otpWarning: string; generalSafe: string }> = {
  en: {
    otpWarning:
      "Stop immediately. Banks and government officials NEVER ask for OTP, UPI PIN, screen-sharing apps like AnyDesk, or QR scans to receive money. If you shared details, open Bank Emergency Assistance or dial 1930.",
    generalSafe:
      "Pause before acting on any urgent payment, unknown caller, or link. Verify directly with your family guardian or saved bank helpline before paying.",
  },
  hi: {
    otpWarning:
      "तुरंत रुकें। कोई भी बैंक या सरकारी अधिकारी कभी OTP, UPI PIN, स्क्रीन-शेयरिंग ऐप या पैसे प्राप्त करने के लिए QR स्कैन नहीं मांगता। यदि जानकारी साझा हुई है, तो तुरंत अपने बैंक को कॉल करें या 1930 डायल करें।",
    generalSafe:
      "किसी भी जल्दबाज़ी वाले भुगतान, अज्ञात कॉल या लिंक पर भरोसा करने से पहले रुकें। पैसे भेजने से पहले अपने परिवार के अभिभावक या सहेजे गए बैंक नंबर पर पुष्टि करें।",
  },
  hinglish: {
    otpWarning:
      "Turant ruk jaiye! Koi bhi bank ya sarkari adhikari kabhi OTP, UPI PIN, screen-sharing app (jaise AnyDesk) ya paise paane ke liye QR scan nahi maangta. Agar galti se details share ho gayi hain, toh turant Bank Emergency Assistance kholein ya 1930 dial karein.",
    generalSafe:
      "Kisi bhi jaldbazi wale payment, anjaan call ya link par bharosa karne se pehle thoda rukein. Payment se pehle apne family guardian ya official bank helpline se confirm zaroor karein.",
  },
  bn: {
    otpWarning:
      "এখনই থামুন। কোনো ব্যাংক বা সরকারি কর্মকর্তা কখনো OTP, UPI PIN বা টাকা পাওয়ার জন্য QR স্ক্যান চায় না। তথ্য দিলে অবিলম্বে আপনার ব্যাংকে কল করুন বা 1930 নম্বরে জানান।",
    generalSafe:
      "যেকোনো তাড়াহুড়োর পেমেন্ট, অজানা কল বা লিঙ্কে ক্লিক করার আগে থামুন। পরিবারের অভিভাবক বা ব্যাংকের আসল নম্বরে কথা বলে নিশ্চিত হন।",
  },
  mr: {
    otpWarning:
      "तात्काळ थांबा. कोणतीही बँक किंवा सरकारी अधिकारी कधीही OTP, UPI PIN किंवा पैसे मिळवण्यासाठी QR स्कॅन मागत नाही. माहिती शेअर केली असल्यास ताबडतोब बँकेला कॉल करा किंवा 1930 वर कळवा.",
    generalSafe:
      "कोणत्याही घाईच्या पेमेंट, अनोळखी कॉल किंवा लिंकवर विश्वास ठेवण्यापूर्वी थांबा. कुटुंबातील पालक किंवा अधिकृत बँक क्रमांकावर खात्री करा.",
  },
  te: {
    otpWarning:
      "వెంటనే ఆపండి. ఏ బ్యాంకు లేదా ప్రభుత్వ అధికారి ఎప్పుడూ OTP, UPI PIN లేదా డబ్బు అందుకోవడానికి QR స్కాన్ అడగరు. వివరాలు పంచుకున్నట్లయితే వెంటనే మీ బ్యాంకుకు కాల్ చేయండి లేదా 1930 కు డయల్ చేయండి.",
    generalSafe:
      "అత్యవసర చెల్లింపులు, తెలియని కాల్స్ లేదా లింకులపై చర్య తీసుకునే ముందు ఆగండి. మీ కుటుంబ సంరక్షకుడితో లేదా బ్యాంకు నంబర్‌తో నిర్ధారించుకోండి.",
  },
  ml: {
    otpWarning:
      "ഉടൻ നിർത്തുക. ബാങ്കുകളോ സർക്കാർ ഉദ്യോഗസ്ഥരോ പണം ലഭിക്കുന്നതിനായി ഒടിപിയോ, യുപിഐ പിന്നോ, ക്യുആർ സ്കാനോ ആവശ്യപ്പെടില്ല. വിവരങ്ങൾ നൽകിയിട്ടുണ്ടെങ്കിൽ ബാങ്കിനെ ബന്ധപ്പെടുക അല്ലെങ്കിൽ 1930 ഡയൽ ചെയ്യുക.",
    generalSafe:
      "അടിയന്തര പേയ്‌മെന്റ്, അജ്ഞാത കോളുകൾ എന്നിവയിൽ പ്രവർത്തിക്കുന്നതിന് മുമ്പ് സംയമനം പാലിക്കുക. കുടുംബാംഗങ്ങളോടോ ബാങ്കിലോ വിളിച്ച് ഉറപ്പാക്കുക.",
  },
  kn: {
    otpWarning:
      "ತಕ್ಷಣ ನಿಲ್ಲಿಸಿ. ಯಾವುದೇ ಬ್ಯಾಂಕ್ ಅಥವಾ ಸರ್ಕಾರಿ ಅಧಿಕಾರಿ ಹಣ ಪಡೆಯಲು ಒಟಿಪಿ, ಯುಪಿಐ ಪಿನ್ ಅಥವಾ ಕ್ಯೂಆರ್ ಸ್ಕ್ಯಾನ್ ಕೇಳುವುದಿಲ್ಲ. ಮಾಹಿತಿ ಹಂಚಿಕೊಂಡಿದ್ದರೆ ಕೂಡಲೇ ಬ್ಯಾಂಕ್ ಅಥವಾ 1930 ಗೆ ಕರೆ ಮಾಡಿ.",
    generalSafe:
      "ಯಾವುದೇ ತುರ್ತು ಪಾವತಿ, ಅಪರಿಚಿತ ಕರೆ ಅಥವಾ ಲಿಂಕ್ ಕ್ಲಿಕ್ ಮಾಡುವ ಮುನ್ನ ಎಚ್ಚರ ವಹಿಸಿ. ಕುಟುಂಬದ ಪೋಷಕರು ಅಥವಾ ಬ್ಯಾಂಕ್ ಜೊತೆ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
  },
  ta: {
    otpWarning:
      "உடனடியாக நிறுத்துங்கள். பணம் பெறுவதற்கு எந்த வங்கியும் அரசு அதிகாரியும் ஒருபோதும் OTP, UPI PIN அல்லது QR ஸ்கேன் கேட்க மாட்டார்கள். விவரங்களைப் பகிர்ந்திருந்தால் உடனடியாக வங்கிக்கு அழைக்கவும் அல்லது 1930 ஐ டயல் செய்யவும்.",
    generalSafe:
      "அவசர கட்டணம், தெரியாத அழைப்புகள் அல்லது இணைப்புகளை கிளிக் செய்வதற்கு முன் கவனமாக இருங்கள். குடும்ப பாதுகாவலர் அல்லது அதிகாரப்பூர்வ வங்கியில் உறுதிப்படுத்தவும்.",
  },
  bgc: {
    otpWarning:
      "तुरंत रुक जाओ। कोई भी बैंक या सरकारी अफसर कदे भी OTP, UPI PIN या पैसे लेने खातिर QR स्कैन कोन्या मांगता। जे जानकारी दे दी हो तो तुरंत अपने बैंक नै फोन करो या 1930 मिलाओ।",
    generalSafe:
      "किसी भी जल्दी वाले पेमेंट, अनजान कॉल या लिंक पर क्लिक करण तैं पहलां रुको। अपने घर के अभिभावक या असली बैंक नंबर पै बात करके पक्का करो।",
  },
  bho: {
    otpWarning:
      "तुरंत रुक जाईं। कवनो बैंक भा सरकारी अफसर कबो OTP, UPI PIN भा पइसा पावे खातिर QR स्कैन ना मांगेला। अगर जानकारी दे देले बानी त तुरंत बैंक के फोन करीं भा 1930 प कॉल करीं।",
    generalSafe:
      "कवनो हड़बड़ी वाला पेमेंट, अनजान कॉल भा लिंक प भरोसा करे से पहिले रुकीं। परिवार के अभिभावक भा बैंक के सही नंबर प बात करके पक्का कर लीं।",
  },
};

export interface GroundedSourceSummary {
  sourceName: string;
  verificationStatus: string;
  result: string;
  limitations?: string;
}

export interface GroundedIndicatorSummary {
  label: string;
  points: number;
  evidence: string[];
  sourceName: string;
  verified: boolean;
}

export function buildGuardianContextBlock(
  intel?: GuardianIntelContextInput | null,
  signals: string[] = []
): string {
  const parts: string[] = [];
  if (intel?.activeSection) parts.push(`Active section: ${intel.activeSection}`);
  if (intel?.contextType) parts.push(`Active check category: ${intel.contextType}`);
  if (typeof intel?.score === "number") {
    parts.push(`Current deterministic suspicion score: ${intel.score}/100 (${intel.riskLevel || "UNSPECIFIED"})`);
  } else if (intel?.riskLevel) {
    parts.push(`Current risk classification: ${intel.riskLevel}`);
  }
  if (intel?.verificationStatus) {
    parts.push(`Source verification status: ${intel.verificationStatus}`);
  }
  if (intel?.summary) {
    parts.push(`Current check summary (redacted): ${redactSensitive(intel.summary).slice(0, 600)}`);
  }
  const combinedSignals = Array.from(
    new Set([...(intel?.signals || []), ...signals].map((s) => redactSensitive(s)).filter(Boolean))
  );
  if (combinedSignals.length > 0) {
    parts.push(`Observed indicators: ${combinedSignals.slice(0, 8).join("; ")}`);
  }
  if (intel?.sourcesUnavailable && intel.sourcesUnavailable.length > 0) {
    parts.push(`Unavailable sources (scored 0 pts): ${intel.sourcesUnavailable.join(", ")}`);
  }
  return parts.length > 0 ? parts.join("\n") : "No active scan context attached.";
}

export function explainRiskLocally(params: {
  text: string;
  signals: string[];
  level: string;
  lang: string;
  score?: number;
}): { explanation: string; nextSteps: string[] } {
  const vLang = normalizeVoiceLang(params.lang);
  const scoreTxt = typeof params.score === "number" ? `${params.score}/100` : params.level;
  const sigText = params.signals.slice(0, 3).join("; ") || (vLang === "hi" ? "स्थानीय नियम जांच" : "Local pattern check");
  if (vLang === "hi") {
    return {
      explanation: `गार्जियन नियम सलाहकार: यह जांच ${scoreTxt} जोखिम स्तर पर है। मुख्य संकेत: ${sigText}। याद रखें, 0 स्कोर भी 100% सुरक्षा की गारंटी नहीं है और कोई कॉल ऑडियो रिकॉर्ड नहीं किया गया।`,
      nextSteps: [
        "किसी भी कॉल या लिंक पर OTP, UPI PIN या पासवर्ड न बताएं।",
        "भुगतान करने से पहले परिवार के अभिभावक से सहेजे गए नंबर पर बात करें।",
        "शक होने पर 'बैंक आपातकालीन सहायता' या 1930 का उपयोग करें।",
      ],
    };
  }
  if (vLang === "hinglish") {
    return {
      explanation: `Guardian Advisor: Yeh check ${scoreTxt} risk level par hai. Mukhya sanket: ${sigText}. Dhyaan rakhein, 0 score bhi 100% safety ki guarantee nahi hai aur koi call audio record nahi kiya gaya.`,
      nextSteps: [
        "Kisi bhi call ya link par OTP, UPI PIN ya password na batayein.",
        "Payment karne se pehle apne family guardian ya official bank number par confirm karein.",
        "Shaq hone par 'Bank Emergency Assistance' kholein ya 1930 dial karein.",
      ],
    };
  }
  return {
    explanation: `Guardian Safety Advisor: This check scored ${scoreTxt} based on local evidence (${sigText}). Note that a 0 score is never a safety guarantee, and no call audio was listened to or recorded.`,
    nextSteps: [
      "Never share OTP, UPI PIN, or remote-access codes.",
      "Verify the recipient directly with your family guardian before transferring money.",
      "Use Bank Emergency Assistance or dial 1930 if credentials were exposed.",
    ],
  };
}

export async function explainRiskWithGemini(params: {
  text: string;
  signals: string[];
  level: string;
  lang: string;
  contextType: string;
  provider?: AiProviderId;
  score?: number;
  riskLevel?: string;
  verificationStatus?: string;
  indicators?: GroundedIndicatorSummary[];
  sourcesUnavailable?: string[];
  findings?: string[];
  sourceChecks?: GroundedSourceSummary[];
}): Promise<{ explanation: string; nextSteps: string[] }> {
  if (params.provider === "guardian") {
    return explainRiskLocally(params);
  }
  const ai = getAiClient();
  const safeText = redactSensitive(params.text).slice(0, 1200);
  const vLang = normalizeVoiceLang(params.lang);
  const langLabel = LANGUAGE_INSTRUCTIONS[vLang];

  const findingsBlock = (params.findings && params.findings.length ? params.findings : params.signals).join("; ") || "None";
  const indicatorsBlock =
    params.indicators && params.indicators.length
      ? params.indicators
          .map(
            (ind) =>
              `- ${ind.label} (+${ind.points} pts, ${ind.verified ? "verified" : "unverified"}, source=${ind.sourceName}): ${ind.evidence.join("; ")}`
          )
          .join("\n")
      : "No scored suspicion indicators triggered.";
  const sourcesBlock =
    params.sourceChecks && params.sourceChecks.length
      ? params.sourceChecks
          .map(
            (s) =>
              `- ${s.sourceName}: status=${s.verificationStatus}, result=${s.result}${s.limitations ? `, limitation=${s.limitations}` : ""}`
          )
          .join("\n")
      : "No external source lookup summary attached.";
  const unavailableBlock =
    params.sourcesUnavailable && params.sourcesUnavailable.length > 0
      ? params.sourcesUnavailable.join(", ")
      : "None";

  const scoreLine =
    typeof params.score === "number"
      ? `${params.score}/100 (${params.riskLevel || params.level})`
      : `${params.level}`;

  const response = await generateContentWithModelFallback(ai, GEMINI_TEXT_MODEL, {
    contents: [
      `Context type: ${params.contextType}`,
      `Final deterministic suspicion score: ${scoreLine}`,
      `Verification status: ${params.verificationStatus || params.level}`,
      `Scored indicators:\n${indicatorsBlock}`,
      `Actual detected findings: ${findingsBlock}`,
      `Sources checked:\n${sourcesBlock}`,
      `Unavailable sources (added 0 points): ${unavailableBlock}`,
      `Redacted input snippet: ${safeText}`,
    ].join("\n\n"),
    config: {
      systemInstruction: `You are Guardian AI, a calm, trustworthy family digital-safety advisor helping parents understand scan results. Write in ${langLabel}.
CRITICAL RULES:
1. Refer ONLY to the actual deterministic score, scored indicators, findings, and source verification statuses provided above.
2. NEVER change, override, or invent numeric suspicion scores, fraud reports, external blacklists, police cases, or call audio transcripts.
3. Explicitly distinguish verified intelligence matches from heuristic/unverified indicators and unavailable sources.
4. Clearly note that a score of 0 does NOT guarantee safety, and a high score indicates risk rather than proof of criminal activity.
5. For phone-call screening, clarify that no call audio was listened to or recorded.
6. Explain why the result received its exact score/risk level and give 2-4 practical safety steps. Never ask for OTPs, PINs, or passwords.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          nextSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["explanation", "nextSteps"],
      },
    },
  });

  const rawText = (response.text || "").trim();
  if (!rawText) {
    throw new GeminiServiceError("Gemini returned an empty explanation. Please try again.", 502, "GEMINI_EMPTY_RESPONSE");
  }

  let parsed: { explanation?: string; nextSteps?: string[] };
  try {
    parsed = JSON.parse(rawText) as { explanation?: string; nextSteps?: string[] };
  } catch {
    parsed = { explanation: rawText, nextSteps: [] };
  }

  return {
    explanation:
      parsed.explanation?.trim() ||
      (vLang === "hi"
        ? "कृपया किसी भी कार्रवाई से पहले अपने परिवार के अभिभावक से सीधे पुष्टि करें।"
        : "Please verify this request directly with your family guardian before acting."),
    nextSteps:
      Array.isArray(parsed.nextSteps) && parsed.nextSteps.length
        ? parsed.nextSteps.slice(0, 4)
        : vLang === "hi"
          ? ["OTP या UPI PIN साझा न करें", "परिवार के अभिभावक से सहेजे गए नंबर पर पुष्टि करें"]
          : ["Do not share OTP or PIN", "Verify with your family guardian on a saved number"],
  };
}

export function guardianSafetyAdvisorChat(params: {
  message: string;
  signals: string[];
  lang: string;
  guardianContext?: GuardianIntelContextInput | null;
}): string {
  const vLang = normalizeVoiceLang(params.lang);
  const advice = LOCAL_SAFETY_ADVICE[vLang];
  const q = String(params.message || "").toLowerCase();
  const hasSignals = (params.signals && params.signals.length > 0) || Boolean(params.guardianContext?.signals?.length);
  if (/(otp|pin|kyc|anydesk|teamviewer|qr|refund|prize|cashback|blocked|suspend|arrest|link|scam|fraud|bank)/i.test(q)) {
    const scoreNote =
      typeof params.guardianContext?.score === "number"
        ? ` Active check score: ${params.guardianContext.score}/100 (${params.guardianContext.riskLevel || "RISK"}).`
        : "";
    return `${advice.otpWarning}${scoreNote}`;
  }
  const mergedSignals = [...(params.guardianContext?.signals || []), ...params.signals];
  const sigNote = hasSignals
    ? vLang === "hi"
      ? ` (पहचाने गए संकेत: ${mergedSignals.slice(0, 2).join(", ")})`
      : ` (Detected signals: ${mergedSignals.slice(0, 2).join(", ")})`
    : "";
  return `${advice.generalSafe}${sigNote}`;
}

function buildUnifiedGuardianSystemPrompt(langLabel: string, includeVoiceNav: boolean): string {
  return `You are Guardian AI, an intelligent, friendly and privacy-first digital safety assistant designed to protect Indian families against online scams, financial fraud, phishing, impersonation and social engineering.
Your primary purpose is to help users understand risks and make safer decisions.

PERSONALITY:
- Friendly and approachable.
- Patient and respectful.
- Intelligent and practical.
- Calm during emergencies.
- Easy to understand for parents and elderly users (never unnecessarily technical, never judgmental).

COMMUNICATION & GROUNDING RULES:
1. Respond in ${langLabel}. If the user communicates in a specific Indian language or dialect (English, Hindi, Bengali, Malayalam, Kannada, Tamil, Telugu, or Hinglish), match that language naturally.
2. Keep answers concise (usually 2 to 4 clear, supportive sentences or a compact numbered list 1., 2., 3.) unless more detail is requested.
3. Explain technical risks in everyday language. Give actionable, practical safety steps.
4. Distinguish verified intelligence from heuristic/unverified indicators. Refer only to actual Guardian Intelligence Context provided. Never invent scores, blacklist records, police cases, or call audio transcripts.
5. NEVER ask users to share OTPs, UPI PINs, passwords, CVVs, or full card numbers, and NEVER claim you have blocked a transaction or called a bank unless that action was executed by an authorized system.
6. Clearly note that a 0/100 score is not a 100% safety guarantee, and a high score is an indicator of risk.
7. For phone screening, clarify that zero call audio was listened to or recorded.
8. If the user appears to be facing an active scam or emergency, provide immediate practical steps: stop payment, block contact, open Bank Emergency Assistance, or dial India's cybercrime helpline 1930.
${
  includeVoiceNav
    ? `9. Return valid JSON with fields:
- "reply": string (complete Markdown response for display)
- "spokenReply": string (plain conversational text for text-to-speech, concise, without markdown symbols, asterisks, or URLs)
- "navigateTo": string (one of ["overview","scam_qr","cyber_check","calls_links","awareness","approvals","parents_ai","emergency_call","live_qr"] ONLY if user asks to open that view, else "")`
    : `9. Use clear markdown formatting suitable for clean chat display.`
}`;
}

export async function chatWithGemini(params: {
  history: { role: string; text: string }[];
  message: string;
  signals: string[];
  lang: string;
  provider?: AiProviderId;
  guardianContext?: GuardianIntelContextInput | null;
}): Promise<{ text: string; providerUsed: AiProviderId; navigateTo: VoiceNavTarget }> {
  const localNav = detectVoiceNavigationIntent(params.message);
  const vLang = normalizeVoiceLang(params.lang, params.message);

  if (params.provider === "guardian" || !isGeminiConfigured()) {
    return {
      text: guardianSafetyAdvisorChat({
        message: params.message,
        signals: params.signals,
        lang: vLang,
        guardianContext: params.guardianContext,
      }),
      providerUsed: "guardian",
      navigateTo: localNav,
    };
  }

  const ai = getAiClient();
  const langLabel = LANGUAGE_INSTRUCTIONS[vLang];
  const recentHistory = params.history
    .slice(-8)
    .map((h) => `${h.role === "user" ? "User" : "Guardian AI"}: ${redactSensitive(h.text)}`)
    .join("\n");
  const contextBlock = buildGuardianContextBlock(params.guardianContext, params.signals);

  const response = await generateContentWithModelFallback(ai, GEMINI_TEXT_MODEL, {
    contents: [
      `Guardian Intelligence Context:\n${contextBlock}`,
      recentHistory ? `Recent conversation:\n${recentHistory}` : "",
      `User message: ${redactSensitive(params.message)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    config: {
      systemInstruction: buildUnifiedGuardianSystemPrompt(langLabel, false),
    },
  });

  const text = (response.text || "").trim();
  if (!text) {
    throw new GeminiServiceError(
      "Gemini returned an empty reply. Please rephrase your question and try again.",
      502,
      "GEMINI_EMPTY_RESPONSE"
    );
  }

  return {
    text,
    providerUsed: "gemini",
    navigateTo: localNav,
  };
}

export async function voiceAssist(params: {
  transcript: string;
  voiceLang: string;
  provider: AiProviderId;
  history?: { role: string; text: string }[];
  contextSignals?: string[];
  guardianContext?: GuardianIntelContextInput | null;
}): Promise<{
  reply: string;
  spokenReply: string;
  navigateTo: VoiceNavTarget;
  providerUsed: AiProviderId;
  languageCode: VoiceLangCode;
}> {
  const vLang = normalizeVoiceLang(params.voiceLang, params.transcript);
  const safeTranscript = redactSensitive(params.transcript).slice(0, 800);
  const localNav = detectVoiceNavigationIntent(safeTranscript);

  if (params.provider === "guardian" || !isGeminiConfigured()) {
    if (localNav) {
      const navText = LOCAL_NAV_CONFIRM[vLang][localNav];
      return {
        reply: navText,
        spokenReply: navText,
        navigateTo: localNav,
        providerUsed: "guardian",
        languageCode: vLang,
      };
    }
    const text = guardianSafetyAdvisorChat({
      message: safeTranscript,
      signals: params.contextSignals || [],
      lang: vLang,
      guardianContext: params.guardianContext,
    });
    return {
      reply: text,
      spokenReply: text,
      navigateTo: null,
      providerUsed: "guardian",
      languageCode: vLang,
    };
  }

  const ai = getAiClient();
  const langLabel = LANGUAGE_INSTRUCTIONS[vLang];
  const recentHistory = (params.history || [])
    .slice(-8)
    .map((h) => `${h.role === "user" ? "User" : "Guardian AI"}: ${redactSensitive(h.text)}`)
    .join("\n");
  const contextBlock = buildGuardianContextBlock(params.guardianContext, params.contextSignals || []);

  const response = await generateContentWithModelFallback(ai, GEMINI_TEXT_MODEL, {
    contents: [
      `Selected voice language: ${vLang} (${langLabel})`,
      `Guardian Intelligence Context:\n${contextBlock}`,
      recentHistory ? `Recent conversation:\n${recentHistory}` : "",
      `User spoken/typed input: ${safeTranscript}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    config: {
      systemInstruction: buildUnifiedGuardianSystemPrompt(langLabel, true),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          spokenReply: { type: Type.STRING },
          navigateTo: { type: Type.STRING },
        },
        required: ["reply", "spokenReply", "navigateTo"],
      },
    },
  });

  const rawText = (response.text || "").trim();
  if (!rawText) {
    throw new GeminiServiceError(
      "Gemini Voice AI returned an empty reply. Please try speaking or sending again.",
      502,
      "GEMINI_EMPTY_RESPONSE"
    );
  }

  let parsed: { reply?: string; spokenReply?: string; navigateTo?: string } = {};
  try {
    parsed = JSON.parse(rawText) as { reply?: string; spokenReply?: string; navigateTo?: string };
  } catch {
    parsed = {
      reply: rawText,
      spokenReply: rawText.replace(/[*_`#]/g, ""),
      navigateTo: "",
    };
  }

  const validNavs = new Set([
    "overview",
    "scam_qr",
    "cyber_check",
    "calls_links",
    "awareness",
    "approvals",
    "parents_ai",
    "emergency_call",
    "live_qr",
  ]);
  const rawNav = String(parsed.navigateTo || "").trim();
  const resolvedNav: VoiceNavTarget = validNavs.has(rawNav) ? (rawNav as VoiceNavTarget) : localNav;

  const replyText = (parsed.reply || "").trim();
  const spokenText = (parsed.spokenReply || replyText).replace(/[*_`#]/g, "").trim();
  if (!replyText) {
    throw new GeminiServiceError("Gemini returned no voice response text.", 502, "GEMINI_EMPTY_RESPONSE");
  }

  return {
    reply: replyText,
    spokenReply: spokenText || replyText,
    navigateTo: resolvedNav,
    providerUsed: "gemini",
    languageCode: vLang,
  };
}

export async function transcribeAudioWithGemini(params: {
  base64Audio: string;
  mimeType: string;
  voiceLang?: string;
}): Promise<{ transcript: string; languageCode: VoiceLangCode }> {
  const cleanMime = String(params.mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const allowedAudioMimes = new Set([
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
  ]);
  if (!allowedAudioMimes.has(cleanMime)) {
    throw new GeminiServiceError(
      `Unsupported audio format (${cleanMime || "unknown"}). Please record using WebM, MP4, OGG, or WAV.`,
      400,
      "UNSUPPORTED_AUDIO_MIME"
    );
  }
  if (!params.base64Audio || params.base64Audio.length < 32) {
    throw new GeminiServiceError("Audio clip was empty. Please speak clearly into the microphone.", 400, "EMPTY_AUDIO");
  }

  const vLang = normalizeVoiceLang(params.voiceLang);
  const ai = getAiClient();
  const langHint =
    vLang === "hi"
      ? "Expected language: Hindi (Devanagari) or Hinglish."
      : vLang === "hinglish"
        ? "Expected language: Hinglish (Hindi/English mix)."
        : `Expected language hint: ${LANGUAGE_INSTRUCTIONS[vLang]}.`;

  const response = await generateContentWithModelFallback(
    ai,
    GEMINI_TRANSCRIBE_MODEL,
    {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: cleanMime,
              data: params.base64Audio,
            },
          },
          {
            text: `Transcribe the spoken audio accurately into plain text only (no commentary, markdown, or timestamps). ${langHint}`,
          },
        ],
      },
    },
    { timeoutMs: 22_000, maxRetries: 1 }
  );

  const transcript = (response.text || "").trim();
  if (!transcript) {
    throw new GeminiServiceError(
      "Could not detect clear speech in the recording. Please speak closer to the microphone and try again.",
      422,
      "NO_SPEECH_DETECTED"
    );
  }

  return { transcript, languageCode: vLang };
}

export async function extractScreenshotTextWithGemini(params: {
  base64Data: string;
  mimeType: string;
}): Promise<{ extractedText: string }> {
  const ai = getAiClient();
  const response = await generateContentWithModelFallback(ai, GEMINI_TEXT_MODEL, {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.base64Data,
          },
        },
        {
          text: "Transcribe all visible SMS, WhatsApp, or payment alert text from this screenshot accurately. Return only the extracted message text without extra commentary.",
        },
      ],
    },
  });
  return {
    extractedText: (response.text || "").trim(),
  };
}

export function generateGuardianLocalParentsGuidance(params: {
  toolKey: string;
  prompt: string;
  contextSummary: string;
  lang: string;
}): string {
  const vLang = normalizeVoiceLang(params.lang);
  if (vLang === "hi") {
    return `गार्जियन परिवार योजना (${params.toolKey}):\n1. मासिक आवश्यक खर्चों (दवाइयां, किराना, बिजली/पानी) को अलग सूची में रखें।\n2. केवल-पढ़ने योग्य बजट सीमा तय करें और किसी भी नए भुगतान अनुरोध की अभिभावक से पुष्टि करें।\n3. ध्यान रखें: बैंक पासवर्ड, OTP या PIN कभी साझा न करें।\nसंदर्भ: ${params.contextSummary}`;
  }
  return `Guardian Family Plan (${params.toolKey}):\n1. Separate essential monthly categories (medicines, groceries, utility bills) for clear tracking.\n2. Set calm monthly thresholds and review unfamiliar payment requests with your linked guardian.\n3. Safety reminder: Never enter bank passwords, card numbers, PINs, or OTPs.\nContext: ${params.contextSummary}`;
}

export async function generateParentsAiGuidance(params: {
  toolKey: string;
  prompt: string;
  contextSummary: string;
  lang: string;
  provider?: AiProviderId;
}): Promise<string> {
  if (params.provider === "guardian") {
    return generateGuardianLocalParentsGuidance(params);
  }
  const ai = getAiClient();
  const vLang = normalizeVoiceLang(params.lang);
  const langLabel = LANGUAGE_INSTRUCTIONS[vLang];
  const response = await withGeminiTimeoutAndRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Tool: ${params.toolKey}\nFamily context: ${params.contextSummary}\nRequest: ${redactSensitive(params.prompt)}`,
      config: {
        systemInstruction: `You are Parents AI, a calm family organization, caregiving, and household budgeting assistant. Reply in ${langLabel}. Be structured, warm, and concise. Never ask for bank passwords, PINs, OTPs, or card numbers.`,
      },
    })
  );
  return (response.text || "").trim() || "Here is a structured plan you can review with your family.";
}
