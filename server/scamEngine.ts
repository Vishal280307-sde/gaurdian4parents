export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ScamAnalysisResult {
  score: number;
  level: RiskLevel;
  category: string;
  signals: string[];
  guidance: string;
  guidanceHi: string;
}

const SCAM_PATTERNS: { pattern: RegExp; weight: number; label: string; category: string }[] = [
  { pattern: /\b(kyc|pan\s*card|aadhaar|account\s*(suspend|block|freez|deactivat))/i, weight: 32, label: "Account suspension / KYC threat", category: "kyc_impersonation" },
  { pattern: /\b(otp|one\s*time\s*password|cvv|atm\s*pin|upi\s*pin|mpin)\b/i, weight: 38, label: "Requests confidential OTP, PIN, or CVV", category: "credential_theft" },
  { pattern: /\b(anydesk|teamviewer|quicksupport|rustdesk|screen\s*shar)/i, weight: 40, label: "Remote screen-sharing app request", category: "remote_access_scam" },
  { pattern: /\b(digital\s*arrest|cbi|ncb|customs|trai|income\s*tax\s*notice|police\s*case|warrant)/i, weight: 42, label: "Fake authority / digital arrest intimidation", category: "authority_impersonation" },
  { pattern: /\b(electricity\s*bill|power\s*disconnect|meter\s*update|gas\s*connection)/i, weight: 30, label: "Utility disconnection urgency", category: "utility_scam" },
  { pattern: /\b(lottery|prize|jackpot|cashback|reward\s*claim|claim\s*₹|won\s*rs)/i, weight: 28, label: "Unexpected reward or lottery claim", category: "lottery_reward_scam" },
  { pattern: /\b(urgent|immediately|within\s*\d+\s*(min|hour)|act\s*now|last\s*warning)/i, weight: 18, label: "Artificial time pressure", category: "urgency_manipulation" },
  { pattern: /\b(enter\s*pin\s*to\s*receive|receive\s*money\s*via\s*upi|collect\s*request|scan\s*to\s*get)/i, weight: 35, label: "Deceptive 'enter PIN to receive money' trick", category: "upi_collect_scam" },
  { pattern: /https?:\/\/[^\s]+/i, weight: 12, label: "Contains external link", category: "suspicious_link" },
];

export function analyzeScamText(rawText: string): ScamAnalysisResult {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      score: 0,
      level: "LOW",
      category: "none_detected",
      signals: [],
      guidance: "Paste a message or transcript to check for scam indicators.",
      guidanceHi: "संदिग्ध संकेतों की जांच के लिए संदेश या बातचीत यहाँ पेस्ट करें।",
    };
  }

  let score = 0;
  const signals: string[] = [];
  let topCategory = "none_detected";
  let topWeight = 0;

  for (const rule of SCAM_PATTERNS) {
    if (rule.pattern.test(text)) {
      score += rule.weight;
      signals.push(rule.label);
      if (rule.weight > topWeight) {
        topWeight = rule.weight;
        topCategory = rule.category;
      }
    }
  }

  const finalScore = Math.min(100, score);
  const level: RiskLevel =
    finalScore >= 75 ? "CRITICAL" : finalScore >= 45 ? "HIGH" : finalScore >= 20 ? "MEDIUM" : "LOW";

  let guidance = "No strong scam indicators found, though always verify unknown senders independently.";
  let guidanceHi = "कोई बड़ा धोखाधड़ी संकेत नहीं मिला, फिर भी अनजान प्रेषक की अलग से पुष्टि करें।";

  if (level === "CRITICAL" || level === "HIGH") {
    guidance = "Stop immediately. Do not share OTP, PIN, or install apps. Call your family guardian or bank using a saved official number.";
    guidanceHi = "तुरंत रुकें। OTP, PIN साझा न करें और कोई ऐप इंस्टॉल न करें। अपने अभिभावक या बैंक के आधिकारिक नंबर पर कॉल करें।";
  } else if (level === "MEDIUM") {
    guidance = "Proceed with caution. Verify this request with a saved family number before clicking links or paying.";
    guidanceHi = "सावधानी रखें। किसी लिंक पर क्लिक या भुगतान करने से पहले परिवार के सदस्य से पुष्टि करें।";
  }

  return {
    score: finalScore,
    level,
    category: topCategory,
    signals,
    guidance,
    guidanceHi,
  };
}
