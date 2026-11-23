import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  QrCode,
  PhoneCall,
  Lock,
  UserPlus,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Landmark,
} from "lucide-react";
import { motion } from "motion/react";
import { apiFetch, setMemoryAuthToken } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { evaluateMessageLocally, type LocalScamAssessment } from "../lib/scamClient";
import { VisualAsset } from "./VisualAsset";
import { ProfilePictureInput } from "./ProfilePictureInput";
import type { AuthUser, UserGender, UserRole, VerifiedBankDirectoryItem } from "../types/guardian";

interface AuthGateProps {
  onAuthenticated: (user: AuthUser) => void;
  lang: "en" | "hi";
}

const REMEMBER_STORAGE_KEY = "guardian_remembered_user";
const GOLD_SHIELD_ART = "/src/assets/images/gold_family_shield_1795443534490.jpg";

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated, lang }) => {
  const [mode, setMode] = useState<"signin" | "register" | "recover">("signin");
  const [role, setRole] = useState<UserRole>("parent");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [createdRecovery, setCreatedRecovery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publicBanks, setPublicBanks] = useState<VerifiedBankDirectoryItem[]>([]);
  const [primaryBankId, setPrimaryBankId] = useState("");
  const [gender, setGender] = useState<"" | UserGender>("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState(
    "URGENT: Your bank KYC will be suspended in 30 minutes. Install AnyDesk or click http://sbi-kyc-update.xyz to verify OTP."
  );
  const [quickResult, setQuickResult] = useState<LocalScamAssessment | null>(() =>
    evaluateMessageLocally(
      "URGENT: Your bank KYC will be suspended in 30 minutes. Install AnyDesk or click http://sbi-kyc-update.xyz to verify OTP."
    )
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { username?: string; role?: UserRole };
        if (parsed.username) {
          setUsername(parsed.username);
          setRememberMe(true);
        }
        if (parsed.role === "parent" || parsed.role === "guardian") {
          setRole(parsed.role);
        }
      }
    } catch {
      // ignore storage failure
    }
    apiFetch<{ banks: VerifiedBankDirectoryItem[] }>("/api/public/banks")
      .then((res) => setPublicBanks(res.banks || []))
      .catch(() => {});
  }, []);

  async function handlePreviewLaunch(targetRole: UserRole) {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ user: AuthUser; sessionToken: string }>("/api/auth/preview-family", {
        method: "POST",
        body: JSON.stringify({ role: targetRole }),
      });
      setMemoryAuthToken(res.sessionToken);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch preview family.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedRecovery(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await apiFetch<{ user: AuthUser; sessionToken: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password, role }),
        });
        try {
          if (rememberMe) {
            localStorage.setItem(
              REMEMBER_STORAGE_KEY,
              JSON.stringify({ username: username.trim().toLowerCase(), role })
            );
          } else {
            localStorage.removeItem(REMEMBER_STORAGE_KEY);
          }
        } catch {
          // ignore storage failure
        }
        setMemoryAuthToken(res.sessionToken);
        onAuthenticated(res.user);
      } else if (mode === "register") {
        const res = await apiFetch<{ ok: boolean; recoveryCode: string; message: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username,
            name,
            password,
            role,
            primaryBankId: primaryBankId || undefined,
            gender: gender || undefined,
            profilePicture: profilePicture || undefined,
          }),
        });
        setCreatedRecovery(res.recoveryCode);
        setPassword("");
        setPrimaryBankId("");
        setGender("");
        setProfilePicture(null);
        setMode("signin");
      } else {
        const res = await apiFetch<{ ok: boolean; recoveryCode: string }>("/api/auth/recover", {
          method: "POST",
          body: JSON.stringify({ username, recoveryCode, newPassword }),
        });
        setCreatedRecovery(res.recoveryCode);
        setRecoveryCode("");
        setNewPassword("");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: "signin" | "register" | "recover") {
    setMode(nextMode);
    setError(null);
    setShowPassword(false);
    setShowNewPassword(false);
  }

  const inputCls =
    "w-full rounded-xl border border-[#C6A15B]/32 bg-[#071525]/85 px-3.5 py-2.5 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/70 focus:outline-none focus:border-[#E6C98A] transition-colors";

  const features = [
    {
      Icon: QrCode,
      title: lang === "hi" ? "QR धोखाधड़ी पहचान" : "QR Fraud Detection",
      desc:
        lang === "hi"
          ? "भुगतान से पहले संदिग्ध UPI हैंडल, पूर्व-भरी राशि और छिपे लिंक की जांच करें।"
          : "Inspect UPI payment QRs for risky handles, preset amounts, and hidden links before paying.",
    },
    {
      Icon: PhoneCall,
      title: lang === "hi" ? "फ़ोन धोखाधड़ी पहचान" : "Phone Fraud Detection",
      desc:
        lang === "hi"
          ? "बिना कॉल ऑडियो रिकॉर्ड किए अज्ञात कॉलर और कॉल-भुगतान समय जोखिम पहचानें।"
          : "Screen unknown callers and call-payment timing overlaps without recording call audio.",
    },
    {
      Icon: ShieldCheck,
      title: lang === "hi" ? "व्यक्तिगत साइबर सुरक्षा जांच" : "Personal Cyber Safety Check",
      desc:
        lang === "hi"
          ? "पारदर्शी स्रोत विवरण के साथ मोबाइल नंबर, ईमेल, UPI ID, बैंक खाते और URL जांचें।"
          : "Verify mobile numbers, emails, UPI IDs, bank accounts, and URLs with transparent sources.",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionReveal}
      className="w-full max-w-6xl mx-auto py-2 sm:py-4"
    >
      <div className="gm-glass-card rounded-3xl overflow-hidden flex flex-col md:flex-row items-stretch">
        {/* Left Golden Matte Branding Panel */}
        <section
          aria-label={lang === "hi" ? "ब्रांड परिचय और मुख्य सुरक्षा सुविधाएं" : "Guardian AI Overview"}
          className="relative md:w-[40%] lg:w-[43%] shrink-0 bg-gradient-to-br from-[#071525] via-[#10243A] to-[#252A32] text-[#F4F0E6] p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-hidden border-b md:border-b-0 md:border-r border-[#C6A15B]/25"
        >
          {/* Decorative Golden Crest Watermark */}
          <svg
            aria-hidden="true"
            viewBox="0 0 360 360"
            className="pointer-events-none absolute -right-16 -bottom-16 w-72 h-72 text-[#C6A15B] opacity-[0.12]"
            fill="none"
          >
            <circle cx="180" cy="180" r="158" stroke="currentColor" strokeWidth="1.2" strokeDasharray="6 6" />
            <circle cx="180" cy="180" r="118" stroke="currentColor" strokeWidth="1" />
            <path
              d="M180 68L254 98V166C254 218 222 262 180 282C138 262 106 218 106 166V98L180 68Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E6C98A]/25 to-[#10243A] border border-[#C6A15B]/60 flex items-center justify-center shadow-[0_0_20px_rgba(198,161,91,0.3)] shrink-0">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-[#E6C98A]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l7 3v5c0 4.8-3 8.9-7 10.5C8 19.9 5 15.8 5 11V6l7-3z" />
                  <path d="M9.5 12.2l1.8 1.8 3.5-3.8" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-bold tracking-tight text-[#F4F0E6] truncate">
                  Guardian AI
                </p>
                <p className="text-xs text-[#E6C98A]">
                  {lang === "hi" ? "माता-पिता व परिवार सुरक्षा मंच" : "Guardian for Parents · Family Shield"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-tight leading-snug text-[#F4F0E6] [text-wrap:balance]">
                {lang === "hi"
                  ? "आपके परिवार की डिजिटल सुरक्षा यहीं से शुरू होती है।"
                  : "Your Family's Digital Safety Starts Here."}
              </h1>
              <p className="text-sm text-[#AEBBC9] leading-relaxed max-w-md">
                {lang === "hi"
                  ? "Guardian AI परिवारों को संदिग्ध कॉल, नकली QR कोड, फ़िशिंग लिंक और ऑनलाइन ठगी से शांत व पारदर्शी सुरक्षा देता है।"
                  : "Guardian AI helps families identify suspicious callers, fraudulent UPI QR codes, phishing links, and online scams with calm, consent-first protection."}
              </p>
            </div>

            <VisualAsset
              src={GOLD_SHIELD_ART}
              alt={
                lang === "hi"
                  ? "परिवार डिजिटल सुरक्षा कवच और नेटवर्क सुरक्षा दृश्य"
                  : "Guardian AI family digital protection shield artwork"
              }
              lazy={false}
              className="aspect-[4/3] max-h-44 sm:max-h-48 w-full border-[#C6A15B]/45"
            />

            <div className="space-y-4 pt-2 border-t border-[#C6A15B]/20">
              {features.map((feat) => {
                const Icon = feat.Icon;
                return (
                  <div key={feat.title} className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[#252A32]/90 border border-[#C6A15B]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-[#E6C98A]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-[#F4F0E6] leading-snug">{feat.title}</h2>
                      <p className="mt-0.5 text-xs text-[#AEBBC9] leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-4 border-t border-[#C6A15B]/20 flex flex-wrap items-center justify-between gap-2 text-xs text-[#AEBBC9]">
            <span>
              {lang === "hi"
                ? "सहमति-प्रथम देखरेख · शून्य कॉल-ऑडियो रिकॉर्डिंग"
                : "Consent-first family oversight · Zero call-audio recording"}
            </span>
          </div>
        </section>

        {/* Right Frosted Login / Register / Recover Panel */}
        <section
          aria-label={lang === "hi" ? "साइन इन व खाता प्रबंधन" : "Account Sign In"}
          className="flex-1 min-w-0 bg-[#10243A]/78 backdrop-blur-xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-1 p-1 bg-[#071525]/85 border border-[#C6A15B]/30 rounded-xl mb-6">
              {(["signin", "register", "recover"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    mode === m
                      ? "gm-gold-btn"
                      : "text-[#AEBBC9] hover:text-[#F4F0E6]"
                  }`}
                >
                  {m === "signin"
                    ? lang === "hi"
                      ? "साइन इन"
                      : "Sign In"
                    : m === "register"
                      ? lang === "hi"
                        ? "नया खाता"
                        : "Create Account"
                      : lang === "hi"
                        ? "रिकवरी"
                        : "Recover"}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <h2 className="font-display text-xl font-bold text-[#F4F0E6] tracking-tight">
                {mode === "signin"
                  ? lang === "hi"
                    ? "अपने परिवार सुरक्षा खाते में साइन इन करें"
                    : "Sign in to your family workspace"
                  : mode === "register"
                    ? lang === "hi"
                      ? "नया माता-पिता या अभिभावक खाता बनाएं"
                      : "Create your family safety account"
                    : lang === "hi"
                      ? "रिकवरी कोड से पासवर्ड रीसेट करें"
                      : "Reset password with recovery code"}
              </h2>
              <p className="mt-1 text-xs text-[#AEBBC9]">
                {mode === "signin"
                  ? lang === "hi"
                    ? "अपना यूज़रनेम, भूमिका और पासवर्ड दर्ज करें।"
                    : "Enter your username, account role, and password to continue."
                  : mode === "register"
                    ? lang === "hi"
                      ? "खाता बनने पर आपको एक वन-टाइम रिकवरी कोड मिलेगा।"
                      : "You will receive a one-time recovery code after signing up."
                    : lang === "hi"
                      ? "नया पासवर्ड सेट करने के लिए अपना यूज़रनेम और सहेजा गया रिकवरी कोड दर्ज करें।"
                      : "Enter your username and saved one-time recovery code."}
              </p>
            </div>

            {createdRecovery && (
              <div className="mb-4 p-3.5 rounded-xl border border-[#C6A15B]/55 bg-[#252A32]/90 text-xs text-[#F4F0E6]">
                <p className="font-semibold text-[#E6C98A]">
                  {lang === "hi" ? "अपना वन-टाइम रिकवरी कोड सुरक्षित रखें:" : "Save your one-time recovery code:"}
                </p>
                <p className="mt-1 font-mono text-sm select-all">{createdRecovery}</p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl border border-[#E87575]/45 bg-[#2E1219] text-xs text-[#E87575] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== "recover" && (
                <div>
                  <label className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                    {lang === "hi" ? "खाता भूमिका" : "Account Role"}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole("parent")}
                      className={`min-h-[42px] py-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        role === "parent"
                          ? "border-[#E6C98A] bg-[#2B2112]/80 text-[#F4F0E6] shadow-[0_0_16px_-4px_rgba(198,161,91,0.45)]"
                          : "border-[#C6A15B]/25 bg-[#071525]/70 text-[#AEBBC9] hover:border-[#C6A15B]/60 hover:text-[#F4F0E6]"
                      }`}
                    >
                      {lang === "hi" ? "माता-पिता" : "Parent"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("guardian")}
                      className={`min-h-[42px] py-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        role === "guardian"
                          ? "border-[#E6C98A] bg-[#2B2112]/80 text-[#F4F0E6] shadow-[0_0_16px_-4px_rgba(198,161,91,0.45)]"
                          : "border-[#C6A15B]/25 bg-[#071525]/70 text-[#AEBBC9] hover:border-[#C6A15B]/60 hover:text-[#F4F0E6]"
                      }`}
                    >
                      {lang === "hi" ? "अभिभावक" : "Guardian"}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-username" className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                  {lang === "hi" ? "यूज़रनेम" : "Username"}
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ramesh_parent"
                  className={inputCls}
                />
              </div>

              {mode === "register" && (
                <>
                  <div>
                    <label htmlFor="auth-fullname" className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                      {lang === "hi" ? "पूरा नाम" : "Full Name"}
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Kulkarni"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="auth-primary-bank"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#E6C98A] mb-1.5"
                    >
                      <Landmark className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>
                        {lang === "hi"
                          ? "प्राथमिक बैंक (आपातकालीन कॉल के लिए)"
                          : "Primary Bank (for Emergency Calling)"}
                      </span>
                    </label>
                    <select
                      id="auth-primary-bank"
                      value={primaryBankId}
                      onChange={(e) => setPrimaryBankId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">
                        {lang === "hi"
                          ? "-- बाद में सेटिंग्स में चुनें (वैकल्पिक) --"
                          : "-- Select now or later in Settings (Optional) --"}
                      </option>
                      {publicBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-[#AEBBC9]">
                      {lang === "hi"
                        ? "Guardian आपके फ़ोन नंबर से बैंक का अनुमान नहीं लगाता।"
                        : "Guardian never guesses your bank from your phone number."}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="auth-gender" className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                      {lang === "hi" ? "लिंग (वैकल्पिक)" : "Gender (Optional)"}
                    </label>
                    <select
                      id="auth-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "" | UserGender)}
                      className={inputCls}
                    >
                      <option value="">{lang === "hi" ? "-- वैकल्पिक: चुनें --" : "-- Optional: Select --"}</option>
                      <option value="male">{lang === "hi" ? "पुरुष" : "Male"}</option>
                      <option value="female">{lang === "hi" ? "महिला" : "Female"}</option>
                      <option value="other">{lang === "hi" ? "अन्य" : "Other"}</option>
                      <option value="prefer_not_to_say">
                        {lang === "hi" ? "बताना नहीं चाहते" : "Prefer not to say"}
                      </option>
                    </select>
                  </div>

                  <ProfilePictureInput
                    value={profilePicture}
                    onChange={setProfilePicture}
                    lang={lang}
                    fallbackName={name || username}
                  />
                </>
              )}

              {mode !== "recover" ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="auth-password" className="block text-xs font-semibold text-[#E6C98A]">
                      {lang === "hi" ? "पासवर्ड (8+ अक्षर)" : "Password (8+ characters)"}
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("recover")}
                        className="text-xs font-medium text-[#E6C98A] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {lang === "hi" ? "पासवर्ड भूल गए?" : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={lang === "hi" ? "पासवर्ड दर्ज करें" : "Enter password"}
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? lang === "hi"
                            ? "पासवर्ड छिपाएं"
                            : "Hide password"
                          : lang === "hi"
                            ? "पासवर्ड दिखाएं"
                            : "Show password"
                      }
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="auth-recovery-code" className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                      {lang === "hi" ? "रिकवरी कोड" : "Recovery Code"}
                    </label>
                    <input
                      id="auth-recovery-code"
                      type="text"
                      required
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="GRD-XXXXXX-XXXX"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-new-password" className="block text-xs font-semibold text-[#E6C98A] mb-1.5">
                      {lang === "hi" ? "नया पासवर्ड (8+ अक्षर)" : "New Password (8+ characters)"}
                    </label>
                    <div className="relative">
                      <input
                        id="auth-new-password"
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={lang === "hi" ? "नया पासवर्ड चुनें" : "Choose a new password"}
                        className={`${inputCls} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={
                          showNewPassword
                            ? lang === "hi"
                              ? "नया पासवर्ड छिपाएं"
                              : "Hide new password"
                            : lang === "hi"
                              ? "नया पासवर्ड दिखाएं"
                              : "Show new password"
                        }
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {mode === "signin" && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <label className="inline-flex items-center gap-2 text-xs text-[#AEBBC9] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#C6A15B]/45 accent-[#C6A15B] cursor-pointer"
                    />
                    <span>{lang === "hi" ? "इस डिवाइस पर यूज़रनेम याद रखें" : "Remember username on this device"}</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl gm-gold-btn text-sm font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]"
              >
                {mode === "signin" ? (
                  <>
                    <Lock className="w-4 h-4" />
                    {busy
                      ? lang === "hi"
                        ? "साइन इन हो रहा है..."
                        : "Signing In..."
                      : lang === "hi"
                        ? "साइन इन करें"
                        : "Sign In"}
                  </>
                ) : mode === "register" ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    {busy
                      ? lang === "hi"
                        ? "खाता बन रहा है..."
                        : "Creating Account..."
                      : lang === "hi"
                        ? "खाता बनाएं"
                        : "Create Account"}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {busy
                      ? lang === "hi"
                        ? "रीसेट हो रहा है..."
                        : "Resetting..."
                      : lang === "hi"
                        ? "पासवर्ड रीसेट करें"
                        : "Reset Password"}
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-[#AEBBC9]">
              {mode === "signin" ? (
                <>
                  {lang === "hi" ? "Guardian AI पर नए हैं?" : "New to Guardian AI?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                  >
                    {lang === "hi" ? "नया खाता बनाएं" : "Create Account"}
                  </button>
                </>
              ) : (
                <>
                  {lang === "hi" ? "पहले से खाता है?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                  >
                    {lang === "hi" ? "साइन इन पर लौटें" : "Back to Sign In"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-7 pt-5 border-t border-[#C6A15B]/20 space-y-4">
            <div>
              <p className="text-xs font-medium text-[#AEBBC9] mb-2.5">
                {lang === "hi"
                  ? "तुरंत कार्यक्षेत्र पूर्वावलोकन · जुड़ा हुआ नमूना परिवार"
                  : "Instant Workspace Preview · Linked Sample Family"}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePreviewLaunch("parent")}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#252A32] hover:bg-[#10243A] text-[#F4F0E6] border border-[#C6A15B]/45 hover:border-[#E6C98A] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E6C98A]" />
                  {lang === "hi" ? "माता-पिता कार्यक्षेत्र" : "Open Parent Workspace"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePreviewLaunch("guardian")}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C6A15B]/28 bg-[#071525]/75 hover:border-[#E6C98A] text-[#F4F0E6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {lang === "hi" ? "अभिभावक कंसोल" : "Open Guardian Console"}
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setQuickOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E6C98A] hover:underline cursor-pointer"
              >
                {lang === "hi" ? "लॉगिन के बिना तुरंत संदेश जांचें" : "Quick local message check (no sign-in needed)"}
                {quickOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {quickOpen && (
                <div className="mt-3 p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/80 space-y-2.5">
                  <textarea
                    rows={2}
                    value={quickText}
                    onChange={(e) => {
                      setQuickText(e.target.value);
                      setQuickResult(evaluateMessageLocally(e.target.value));
                    }}
                    placeholder={
                      lang === "hi"
                        ? "संदिग्ध SMS या WhatsApp संदेश यहां पेस्ट करें..."
                        : "Paste a suspicious SMS or WhatsApp message..."
                    }
                    className="w-full rounded-xl border border-[#C6A15B]/25 bg-[#10243A] px-3 py-2 text-xs text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
                  />
                  {quickResult && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#AEBBC9]">
                      <span
                        className={`font-semibold ${
                          quickResult.level === "CRITICAL" || quickResult.level === "HIGH"
                            ? "text-[#E87575]"
                            : quickResult.level === "MEDIUM"
                              ? "text-[#E6C98A]"
                              : "text-[#43C6A5]"
                        }`}
                      >
                        {quickResult.level === "LOW"
                          ? lang === "hi"
                            ? "कोई ज्ञात खतरा नहीं (स्थानीय जांच)"
                            : "No Known Match (Local Check)"
                          : `${quickResult.level} ${lang === "hi" ? "जोखिम" : "Risk"}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-[#AEBBC9]">{quickResult.score} / 100</span>
                      {quickResult.signals.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#AEBBC9]">{quickResult.signals.slice(0, 2).join(" / ")}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#AEBBC9] leading-relaxed">
              {lang === "hi"
                ? "पासवर्ड और परिवार सेफ़ वर्ड सर्वर पर सुरक्षित हैश के रूप में संग्रहीत होते हैं। सत्र टोकन केवल मेमोरी में रहते हैं।"
                : "Passwords and family safe words are salted and scrypt-hashed on the server. Session tokens stay in memory only."}
            </p>
          </div>
        </section>
      </div>
    </motion.div>
  );
};
