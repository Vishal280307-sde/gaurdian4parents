import jsQR from "jsqr";

export interface LocalScamAssessment {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  signals: string[];
  guidance: string;
}

const RULES: { pattern: RegExp; weight: number; label: string; category: string }[] = [
  { pattern: /\b(kyc|pan\s*card|aadhaar|account\s*(suspend|block|freez|deactivat))/i, weight: 32, label: "Account suspension or KYC threat", category: "kyc_impersonation" },
  { pattern: /\b(otp|one\s*time\s*password|cvv|atm\s*pin|upi\s*pin|mpin)\b/i, weight: 38, label: "Requests OTP, PIN, or CVV", category: "credential_theft" },
  { pattern: /\b(anydesk|teamviewer|quicksupport|rustdesk|screen\s*shar)/i, weight: 40, label: "Remote screen-sharing app request", category: "remote_access_scam" },
  { pattern: /\b(digital\s*arrest|cbi|ncb|customs|trai|income\s*tax\s*notice|police\s*case|warrant)/i, weight: 42, label: "Fake authority or digital arrest claim", category: "authority_impersonation" },
  { pattern: /\b(electricity\s*bill|power\s*disconnect|meter\s*update|gas\s*connection)/i, weight: 30, label: "Utility disconnection urgency", category: "utility_scam" },
  { pattern: /\b(lottery|prize|jackpot|cashback|reward\s*claim)/i, weight: 28, label: "Unexpected reward or prize claim", category: "lottery_reward_scam" },
  { pattern: /\b(urgent|immediately|within\s*\d+\s*(min|hour)|act\s*now|last\s*warning)/i, weight: 18, label: "Artificial time pressure", category: "urgency_manipulation" },
  { pattern: /\b(enter\s*pin\s*to\s*receive|receive\s*money|collect\s*request|scan\s*to\s*get)/i, weight: 35, label: "Deceptive receive-money PIN trick", category: "upi_collect_scam" },
  { pattern: /https?:\/\/[^\s]+/i, weight: 12, label: "Contains external link", category: "suspicious_link" },
];

export function evaluateMessageLocally(text: string): LocalScamAssessment {
  const clean = text.trim();
  if (!clean) {
    return {
      score: 0,
      level: "LOW",
      category: "none_detected",
      signals: [],
      guidance: "Paste a suspicious message to evaluate.",
    };
  }
  let score = 0;
  const signals: string[] = [];
  let category = "none_detected";
  let top = 0;
  for (const r of RULES) {
    if (r.pattern.test(clean)) {
      score += r.weight;
      signals.push(r.label);
      if (r.weight > top) {
        top = r.weight;
        category = r.category;
      }
    }
  }
  const finalScore = Math.min(100, score);
  const level: LocalScamAssessment["level"] =
    finalScore >= 75 ? "CRITICAL" : finalScore >= 45 ? "HIGH" : finalScore >= 20 ? "MEDIUM" : "LOW";
  const guidance =
    level === "CRITICAL" || level === "HIGH"
      ? "Stop immediately. Do not share OTP or PIN. Call your guardian or bank on a saved official number."
      : level === "MEDIUM"
        ? "Verify independently with your family guardian before acting."
        : "No strong scam indicators found. Still verify unknown senders.";

  return { score: finalScore, level, category, signals, guidance };
}

export async function decodeQrFromImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (!code || !code.data) {
    throw new Error("Could not detect a readable QR code in this image.");
  }
  return code.data;
}
