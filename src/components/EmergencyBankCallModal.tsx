import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PhoneCall,
  AlertOctagon,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  X,
  Lock,
  Smartphone,
  CreditCard,
  ShieldOff,
  FileWarning,
  Settings,
  Info,
  CheckCircle2,
  Landmark,
  Search,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { BankingSecurity2D, EmergencyAssistance2D } from "./Illustrations2D";
import type {
  AppStatePayload,
  EmergencyCallContext,
  EmergencyCallResolution,
  LangCode,
  TabKey,
  UserBankAccountItem,
  VerifiedBankDirectoryItem,
} from "../types/guardian";

interface EmergencyCallButtonProps {
  onClick: () => void;
  lang: LangCode;
  primaryBankName?: string | null;
  compact?: boolean;
  className?: string;
}

export const EmergencyCallButton: React.FC<EmergencyCallButtonProps> = ({
  onClick,
  lang,
  primaryBankName,
  compact = false,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gm-emergency-btn inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#E87575]/55 font-semibold tracking-tight active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6C98A] whitespace-nowrap shrink-0 ${
        compact ? "min-h-[44px] px-4 py-2.5 text-xs sm:text-sm" : "min-h-[48px] px-5 py-3 text-sm"
      } ${className}`}
    >
      <PhoneCall className={compact ? "w-4 h-4 shrink-0" : "w-5 h-5 shrink-0"} />
      <span className="truncate">
        {lang === "hi" ? "आपातकाल – मेरे बैंक को कॉल करें" : "Emergency – Call My Bank"}
        {primaryBankName ? ` (${primaryBankName})` : ""}
      </span>
    </button>
  );
};

export const BankCrestBadge: React.FC<{ shortCode?: string | null; size?: "sm" | "md" }> = ({
  shortCode,
  size = "md",
}) => {
  const code = (shortCode || "BK").slice(0, 6).toUpperCase();
  const dims = size === "sm" ? "w-9 h-9 text-[10px]" : "w-12 h-12 text-xs";
  return (
    <div
      aria-hidden="true"
      className={`${dims} rounded-xl bg-gradient-to-br from-[#071525] to-[#10243A] border border-[#C6A15B]/55 text-[#E6C98A] font-mono font-bold flex flex-col items-center justify-center shrink-0 shadow-[0_0_14px_-4px_rgba(198,161,91,0.35)]`}
    >
      <Landmark className={size === "sm" ? "w-3.5 h-3.5 mb-0.5" : "w-4 h-4 mb-0.5"} />
      <span className="leading-none tracking-tight">{code}</span>
    </div>
  );
};

interface EmergencyBankCallModalProps {
  open: boolean;
  context: EmergencyCallContext | null;
  state: AppStatePayload;
  lang: LangCode;
  onClose: () => void;
  onNavigate: (tab: TabKey) => void;
  onRefresh: () => Promise<void>;
}

interface BankLookupApiResponse {
  matched: boolean;
  verified: boolean;
  query: string;
  bank: {
    id: string;
    bankName: string;
    shortCode: string;
    officialWebsite: string;
    sourceUrl: string;
    lastVerifiedDate: string;
    upiBlockUrl?: string | null;
    debitBlockUrl?: string | null;
    fraudReportUrl?: string | null;
  } | null;
  callResolution: EmergencyCallResolution | null;
  message: string;
  messageHi: string;
}

const UNVERIFIED_MESSAGE_EN =
  "We couldn't verify this bank's emergency contact. Please visit your bank's official website or use its official mobile application.";
const UNVERIFIED_MESSAGE_HI =
  "हम इस बैंक का आपातकालीन संपर्क सत्यापित नहीं कर सके। कृपया अपने बैंक की आधिकारिक वेबसाइट पर जाएं या उसके आधिकारिक मोबाइल ऐप का उपयोग करें।";

function buildSafeHttpsHref(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

export const EmergencyBankCallModal: React.FC<EmergencyBankCallModalProps> = ({
  open,
  context,
  state,
  lang,
  onClose,
  onNavigate,
  onRefresh,
}) => {
  const savedBanks = state.userBanks || [];
  const linkedParentBanks = state.linkedParentBanks || [];
  const directory = state.bankDirectory || [];
  const isParent = state.user.role === "parent";

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [tempDirectoryId, setTempDirectoryId] = useState<string>("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [unverifiedQuery, setUnverifiedQuery] = useState<string | null>(null);
  const [unverifiedMsg, setUnverifiedMsg] = useState<{ en: string; hi: string } | null>(null);

  const [useGeneralCare, setUseGeneralCare] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copiedNum, setCopiedNum] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [savingQuickBank, setSavingQuickBank] = useState(false);
  const [quickBankError, setQuickBankError] = useState<string | null>(null);
  const [callIntentNote, setCallIntentNote] = useState<string | null>(null);

  const combinedCandidates: (UserBankAccountItem & { ownerLabel?: string })[] = useMemo(() => {
    const own = savedBanks.map((b) => ({ ...b, ownerLabel: undefined }));
    if (!isParent && linkedParentBanks.length > 0) {
      return [
        ...own,
        ...linkedParentBanks.map((pb) => ({
          ...pb,
          ownerLabel: `${pb.parentName}'s Primary Bank`,
        })),
      ];
    }
    return own;
  }, [savedBanks, linkedParentBanks, isParent]);

  useEffect(() => {
    if (!open) return;
    setConfirmOpen(false);
    setUseGeneralCare(false);
    setCopiedNum(null);
    setCopiedSummary(false);
    setQuickBankError(null);
    setCallIntentNote(null);
    setUnverifiedQuery(null);
    setUnverifiedMsg(null);
    setBankSearchQuery("");

    const primary =
      savedBanks.find((b) => b.isPrimary) ||
      savedBanks[0] ||
      (!isParent ? linkedParentBanks[0] : undefined);
    setSelectedSavedId(primary ? primary.id : "");
    setTempDirectoryId("");
    setShowBankPicker(!primary);
  }, [open, savedBanks, linkedParentBanks, isParent]);

  const filteredDirectory = useMemo(() => {
    const q = bankSearchQuery.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (d) =>
        d.bank_name.toLowerCase().includes(q) ||
        d.short_code.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
    );
  }, [bankSearchQuery, directory]);

  const activeSavedBank = combinedCandidates.find((b) => b.id === selectedSavedId) || null;
  const activeTempBank: VerifiedBankDirectoryItem | null =
    !activeSavedBank && tempDirectoryId
      ? directory.find((d) => d.id === tempDirectoryId || d.short_code === tempDirectoryId) || null
      : null;

  const activeResolution = activeSavedBank
    ? activeSavedBank.callResolution
    : activeTempBank
      ? activeTempBank.callResolution
      : null;

  const activeBankId = activeSavedBank?.bankId || activeTempBank?.id || null;
  const activeWebsite = buildSafeHttpsHref(
    activeSavedBank?.officialWebsite || activeTempBank?.official_website || activeResolution?.officialWebsite,
    "https://cybercrime.gov.in/"
  );
  const activeDebitUrl = buildSafeHttpsHref(
    activeSavedBank?.debitBlockUrl || activeTempBank?.debit_block_url,
    activeWebsite
  );
  const activeUpiUrl = buildSafeHttpsHref(
    activeSavedBank?.upiBlockUrl || activeTempBank?.upi_block_url,
    activeWebsite
  );
  const activeFraudUrl = buildSafeHttpsHref(
    activeSavedBank?.fraudReportUrl || activeTempBank?.fraud_report_url,
    "https://cybercrime.gov.in/"
  );

  const chosenNumber =
    activeResolution && activeResolution.canDial
      ? useGeneralCare && activeResolution.supportPhone && activeResolution.supportTelUri
        ? {
            phone: activeResolution.supportPhone,
            telUri: activeResolution.supportTelUri,
            label:
              lang === "hi"
                ? "आधिकारिक सामान्य ग्राहक सेवा (24x7)"
                : "Official General Customer Care (24x7)",
            isFraudLine: false,
          }
        : {
            phone: activeResolution.dialNumber!,
            telUri: activeResolution.telUri!,
            label: lang === "hi" ? activeResolution.numberTypeLabelHi : activeResolution.numberTypeLabel,
            isFraudLine: activeResolution.numberType === "fraud_reporting",
          }
      : null;

  const reasonDisplay =
    (lang === "hi" ? context?.reasonHi : context?.reason) ||
    (context?.source === "lost_phone"
      ? lang === "hi"
        ? "फ़ोन गुम या चोरी — तत्काल खाता, UPI और कार्ड सुरक्षा"
        : "Lost or stolen phone — Urgent account, UPI & card protection"
      : lang === "hi"
        ? "संदिग्ध वित्तीय धोखाधड़ी / अनधिकृत लेनदेन"
        : "Suspected financial fraud / unauthorized activity");

  const incidentSummaryText = useMemo(() => {
    const bankLabel = activeResolution?.bankName || (lang === "hi" ? "बैंक चयनित नहीं" : "Bank not selected");
    const lines = [
      `Guardian for Parents — Incident Summary (No PIN/OTP/Password Included)`,
      `Bank: ${bankLabel}`,
      `Reason: ${context?.reason || (context?.source === "lost_phone" ? "Lost or stolen phone emergency" : "Suspected financial fraud")}`,
    ];
    if (context?.threatCategory) lines.push(`Detected Category: ${context.threatCategory}`);
    if (context?.riskLevel) {
      lines.push(
        `Risk Level: ${context.riskLevel}${typeof context.score === "number" ? ` (${context.score}/100)` : ""}`
      );
    }
    if (context?.incidentDescription) lines.push(`Details: ${context.incidentDescription}`);
    if (context?.suggestedAction) lines.push(`Request to Bank: ${context.suggestedAction}`);
    return lines.join("\n");
  }, [activeResolution?.bankName, context, lang]);

  if (!open) return null;

  function openBankChanger() {
    setShowBankPicker(true);
    setConfirmOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }

  function selectVerifiedDirectoryBank(bank: VerifiedBankDirectoryItem) {
    setSelectedSavedId("");
    setTempDirectoryId(bank.id);
    setUnverifiedQuery(null);
    setUnverifiedMsg(null);
    setConfirmOpen(false);
    setUseGeneralCare(false);
    setCallIntentNote(null);
    setShowBankPicker(false);
  }

  function selectOtherUnsupportedBank(label: string) {
    setSelectedSavedId("");
    setTempDirectoryId("");
    setConfirmOpen(false);
    setCallIntentNote(null);
    setUnverifiedQuery(label);
    setUnverifiedMsg({
      en: UNVERIFIED_MESSAGE_EN,
      hi: UNVERIFIED_MESSAGE_HI,
    });
  }

  async function handleBankSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = bankSearchQuery.trim();
    if (!q || lookupBusy) return;
    setLookupBusy(true);
    setConfirmOpen(false);
    setCallIntentNote(null);
    try {
      const res = await apiFetch<BankLookupApiResponse>(
        `/api/public/banks/lookup?q=${encodeURIComponent(q)}`
      );
      if (res.verified && res.bank) {
        const matched = directory.find(
          (d) =>
            d.id === res.bank?.id ||
            d.short_code.toUpperCase() === res.bank?.shortCode.toUpperCase()
        );
        if (matched) {
          selectVerifiedDirectoryBank(matched);
          return;
        }
      }
      setSelectedSavedId("");
      setTempDirectoryId("");
      setUnverifiedQuery(q);
      setUnverifiedMsg({
        en: res.message || UNVERIFIED_MESSAGE_EN,
        hi: res.messageHi || UNVERIFIED_MESSAGE_HI,
      });
    } catch {
      const localMatch = directory.find(
        (d) =>
          d.short_code.toLowerCase() === q.toLowerCase() ||
          d.bank_name.toLowerCase().includes(q.toLowerCase())
      );
      if (localMatch && q.length >= 2 && !["bank", "other", "india", "local"].includes(q.toLowerCase())) {
        selectVerifiedDirectoryBank(localMatch);
      } else {
        selectOtherUnsupportedBank(q);
      }
    } finally {
      setLookupBusy(false);
    }
  }

  async function logCallIntent(launchMethod: "tel_dialer" | "copy_number" | "national_1930", dialNumber?: string | null) {
    try {
      await apiFetch("/api/emergency-bank/call-intent", {
        method: "POST",
        body: JSON.stringify({
          bankId: activeBankId,
          reason: context?.reason || (context?.source === "lost_phone" ? "Lost or stolen phone" : "Suspected financial fraud"),
          launchMethod,
          dialNumber: dialNumber || null,
        }),
      });
      setCallIntentNote(
        launchMethod === "copy_number"
          ? lang === "hi"
            ? "नंबर कॉपी हो गया। कृपया अपने फ़ोन डायलर से स्वयं कॉल करें।"
            : "Helpline number copied. Please place the call directly from your phone or calling app."
          : lang === "hi"
            ? "डायलर लॉन्च अनुरोध सहेजा गया। कॉल आपके डिवाइस डायलर द्वारा स्वयं किया जाता है।"
            : "Dialer launch opened. Your device completes the call only when you press call."
      );
      await onRefresh();
    } catch {
      // Do not interrupt user emergency calling if audit log request fails
    }
  }

  async function handleCopyNumber(num: string) {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedNum(num);
      setTimeout(() => setCopiedNum(null), 2500);
      await logCallIntent("copy_number", num);
    } catch {
      // fallback ignored
    }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(incidentSummaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  }

  async function saveSelectedDirectoryBankToProfile(bankId: string) {
    setQuickBankError(null);
    setSavingQuickBank(true);
    try {
      await apiFetch("/api/user/banks", {
        method: "POST",
        body: JSON.stringify({ bankId, isPrimary: true }),
      });
      await onRefresh();
    } catch (err) {
      setQuickBankError(err instanceof Error ? err.message : "Could not save bank to profile.");
    } finally {
      setSavingQuickBank(false);
    }
  }

  const alreadySavedActiveBank = Boolean(
    activeTempBank && savedBanks.some((sb) => sb.bankId === activeTempBank.id)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-bank-call-title"
      className="fixed inset-0 z-50 bg-[#071525]/86 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div className="gm-glass-card rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl">
        {/* Header with Banking Security 2D Illustration */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#C6A15B]/20">
          <div className="flex items-start gap-3.5">
            <BankingSecurity2D className="w-12 h-12 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#E87575] inline-flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                {lang === "hi" ? "सत्यापित आपातकालीन सहायता" : "Verified Emergency Banking Support"}
              </p>
              <h2 id="emergency-bank-call-title" className="font-display text-lg sm:text-xl font-bold text-[#F4F0E6] tracking-tight">
                {lang === "hi" ? "बैंक आपातकालीन सहायता" : "Bank Emergency Assistance"}
              </h2>
              <p className="mt-0.5 text-xs text-[#AEBBC9]">
                {lang === "hi"
                  ? "अपने बैंक की आधिकारिक आपातकालीन सहायता खोजने के लिए अपना बैंक चुनें। कभी भी OTP या PIN न बताएं।"
                  : "Select your bank to find its official emergency support. Never share OTP, UPI PIN, or passwords on any call."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === "hi" ? "आपातकालीन संवाद बंद करें" : "Close emergency bank dialog"}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-[#C6A15B]/30 flex items-center justify-center text-[#AEBBC9] hover:text-[#F4F0E6] hover:border-[#E6C98A] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Profile Banks Quick Switcher */}
        {combinedCandidates.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#AEBBC9]">
                {lang === "hi"
                  ? "प्रोफ़ाइल में सहेजे गए बैंक"
                  : "Your Saved Profile Banks"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBankPicker((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  {showBankPicker
                    ? lang === "hi"
                      ? "खोज छिपाएं"
                      : "Hide Bank Finder"
                    : lang === "hi"
                      ? "कोई अन्य बैंक खोजें"
                      : "Check Any Indian Bank"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate("approvals");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#AEBBC9] hover:text-[#F4F0E6] hover:underline cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {lang === "hi" ? "सेटिंग्स" : "Manage in Settings"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {combinedCandidates.map((bk) => {
                const selected = bk.id === selectedSavedId && !unverifiedQuery;
                return (
                  <button
                    key={bk.id}
                    type="button"
                    onClick={() => {
                      setSelectedSavedId(bk.id);
                      setTempDirectoryId("");
                      setUnverifiedQuery(null);
                      setUnverifiedMsg(null);
                      setConfirmOpen(false);
                      setUseGeneralCare(false);
                    }}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selected
                        ? "bg-[#252A32] text-[#F4F0E6] border-[#C6A15B] shadow-[0_0_16px_-4px_rgba(198,161,91,0.45)]"
                        : "bg-[#071525]/70 text-[#AEBBC9] border-[#C6A15B]/25 hover:border-[#E6C98A]"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>{bk.bankName}</span>
                      {bk.isPrimary && (
                        <span className="text-[#E6C98A]">
                          · {lang === "hi" ? "प्राथमिक" : "Primary"}
                        </span>
                      )}
                    </div>
                    {(bk.accountNickname || bk.ownerLabel || bk.lastFourDigits) && (
                      <div className="text-[11px] mt-0.5 text-[#AEBBC9]">
                        {[bk.ownerLabel, bk.accountNickname, bk.lastFourDigits ? `••••${bk.lastFourDigits}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1 — Searchable Bank Selector & Popular Indian Banks */}
        {showBankPicker && (
          <div className="p-4 rounded-2xl bg-[#071525]/80 border border-[#C6A15B]/40 space-y-3.5">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#E6C98A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#F4F0E6] space-y-0.5">
                <p className="font-semibold">
                  {lang === "hi"
                    ? "चरण 1 · सत्यापित बैंक चुनें या नाम खोजें"
                    : "Step 1 · Select or Search Your Bank"}
                </p>
                <p className="text-[#AEBBC9]">
                  {lang === "hi"
                    ? "Guardian आपके फ़ोन नंबर से बैंक का अनुमान नहीं लगाता। आधिकारिक आपातकालीन नंबर देखने के लिए नीचे बैंक खोजें या चुनें:"
                    : "Guardian never guesses your bank from your phone number. Search any bank name or tap a verified Indian bank below:"}
                </p>
              </div>
            </div>

            <form onSubmit={handleBankSearchSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#AEBBC9] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={bankSearchQuery}
                  onChange={(e) => setBankSearchQuery(e.target.value)}
                  placeholder={
                    lang === "hi"
                      ? "बैंक का नाम लिखें (जैसे SBI, HDFC, ICICI, Axis...)"
                      : "Search bank name (e.g. SBI, HDFC, ICICI, Axis, PNB...)"
                  }
                  aria-label={lang === "hi" ? "बैंक का नाम खोजें" : "Search bank name"}
                  className="w-full min-h-[44px] rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/90 pl-9 pr-3 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
                />
              </div>
              <button
                type="submit"
                disabled={lookupBusy || !bankSearchQuery.trim()}
                className="gm-gold-btn min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {lookupBusy
                  ? lang === "hi"
                    ? "जांच रहे हैं..."
                    : "Checking..."
                  : lang === "hi"
                    ? "बैंक सत्यापित करें"
                    : "Check Bank"}
              </button>
            </form>

            {/* Quick Bank Chips */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#AEBBC9]">
                {lang === "hi" ? "लोकप्रिय सत्यापित भारतीय बैंक:" : "Popular Verified Indian Banks:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {filteredDirectory.map((d) => {
                  const isActive = activeTempBank?.id === d.id && !unverifiedQuery;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => selectVerifiedDirectoryBank(d)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#252A32] border-[#E6C98A] text-[#E6C98A]"
                          : "bg-[#10243A]/85 border-[#C6A15B]/25 text-[#F4F0E6] hover:border-[#E6C98A]"
                      }`}
                    >
                      {d.short_code} · {d.bank_name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => selectOtherUnsupportedBank("Other Banks")}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    unverifiedQuery === "Other Banks"
                      ? "bg-[#2E1219] border-[#E87575] text-[#E87575]"
                      : "bg-[#10243A]/70 border-[#C6A15B]/25 text-[#AEBBC9] hover:text-[#F4F0E6] hover:border-[#E6C98A]"
                  }`}
                >
                  {lang === "hi" ? "अन्य बैंक (Other Banks)" : "Other Banks"}
                </button>
              </div>
              {filteredDirectory.length === 0 && bankSearchQuery.trim() && (
                <p className="text-[11px] text-[#E6C98A]">
                  {lang === "hi"
                    ? `सूची में कोई सीधा मिलान नहीं मिला — "${bankSearchQuery.trim()}" की आधिकारिक जांच के लिए ऊपर "बैंक सत्यापित करें" दबाएं।`
                    : `No direct match in quick chips — press "Check Bank" above to verify "${bankSearchQuery.trim()}".`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Smart Context Summary (when triggered from Fraud Result or Lost Phone) */}
        {context && (context.threatCategory || context.riskLevel || context.incidentDescription || context.source === "lost_phone") && (
          <div className="p-4 rounded-2xl bg-[#071525]/75 border border-[#C6A15B]/25 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F0E6]">
                <ShieldAlert className="w-4 h-4 text-[#E87575]" />
                <span>{lang === "hi" ? "आपातकालीन कॉल संदर्भ सारांश" : "Emergency Incident Context"}</span>
              </div>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] text-xs font-semibold text-[#E6C98A] hover:border-[#E6C98A] cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#43C6A5]" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSummary
                  ? lang === "hi"
                    ? "सारांश कॉपी हुआ"
                    : "Summary Copied"
                  : lang === "hi"
                    ? "बैंक के लिए सारांश कॉपी करें"
                    : "Copy Incident Summary"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {context.threatCategory && (
                <div>
                  <span className="text-[#AEBBC9] block">
                    {lang === "hi" ? "पहचानी गई श्रेणी" : "Detected Threat Category"}
                  </span>
                  <span className="font-semibold text-[#F4F0E6]">{context.threatCategory}</span>
                </div>
              )}
              {context.riskLevel && (
                <div>
                  <span className="text-[#AEBBC9] block">
                    {lang === "hi" ? "जोखिम स्तर" : "Risk Level"}
                  </span>
                  <span className="font-semibold font-mono tabular-nums text-[#E87575]">
                    {context.riskLevel}
                    {typeof context.score === "number" ? ` · ${context.score}/100` : ""}
                  </span>
                </div>
              )}
              {context.incidentDescription && (
                <div className="sm:col-span-2">
                  <span className="text-[#AEBBC9] block">
                    {lang === "hi" ? "घटना विवरण (मास्क्ड)" : "Incident Description (Masked)"}
                  </span>
                  <span className="text-[#F4F0E6]">{context.incidentDescription}</span>
                </div>
              )}
              {(context.suggestedAction || context.suggestedActionHi) && (
                <div className="sm:col-span-2 p-3 rounded-xl bg-[#10243A]/85 border border-[#C6A15B]/25 text-[#F4F0E6]">
                  <span className="font-semibold text-[#E6C98A] block mb-0.5">
                    {lang === "hi" ? "बैंक को क्या बताएं:" : "What to explain to your bank:"}
                  </span>
                  {lang === "hi" && context.suggestedActionHi ? context.suggestedActionHi : context.suggestedAction}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2 & 3: Verified BANK EMERGENCY SUPPORT Panel OR Unverified Fallback */}
        {unverifiedQuery && unverifiedMsg ? (
          <div className="p-5 rounded-2xl bg-[#2E1219]/90 border border-[#E87575]/45 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#E87575]">
                  {lang === "hi" ? "असत्यापित बैंक प्रविष्टि" : "Unverified Bank Contact"} · {unverifiedQuery}
                </p>
                <p className="text-sm font-semibold text-[#F4F0E6]">
                  {lang === "hi" ? unverifiedMsg.hi : unverifiedMsg.en}
                </p>
              </div>
              <button
                type="button"
                onClick={openBankChanger}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#C6A15B]/45 bg-[#10243A] text-xs font-semibold text-[#E6C98A] hover:border-[#E6C98A] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {lang === "hi" ? "बैंक बदलें" : "Change Bank"}
              </button>
            </div>
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "Guardian कभी भी अनुमानित या असत्यापित फ़ोन नंबर नहीं दिखाता। आप अपने डेबिट कार्ड के पीछे छपे आधिकारिक नंबर या नीचे दिए राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 का उपयोग कर सकते हैं।"
                : "Guardian never guesses or invents helpline numbers. You can also check the toll-free number printed on the back of your debit card or report financial fraud immediately via 1930 below."}
            </p>
          </div>
        ) : activeResolution && activeResolution.status === "ready" && chosenNumber ? (
          <div className="rounded-2xl border border-[#C6A15B]/50 bg-[#10243A]/92 p-4 sm:p-5 space-y-4 shadow-[0_0_24px_-8px_rgba(198,161,91,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#C6A15B]/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#43C6A5] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === "hi" ? "बैंक आपातकालीन सहायता" : "BANK EMERGENCY SUPPORT"}
              </span>
              {activeTempBank && !alreadySavedActiveBank && (
                <button
                  type="button"
                  disabled={savingQuickBank}
                  onClick={() => saveSelectedDirectoryBankToProfile(activeTempBank.id)}
                  className="text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {savingQuickBank
                    ? lang === "hi"
                      ? "सहेजा जा रहा है..."
                      : "Saving..."
                    : lang === "hi"
                      ? "+ मेरी प्रोफ़ाइल में प्राथमिक बैंक सहेजें"
                      : "+ Save as My Primary Bank"}
                </button>
              )}
            </div>

            {quickBankError && <p className="text-xs text-[#E87575]">{quickBankError}</p>}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <BankCrestBadge shortCode={activeResolution.shortCode} />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-[#E6C98A]">{chosenNumber.label}</p>
                  <h3 className="text-lg font-bold text-[#F4F0E6]">{activeResolution.bankName}</h3>
                  <p className="text-xs text-[#AEBBC9]">
                    <strong className="text-[#F4F0E6]">{lang === "hi" ? "कारण:" : "Reason:"}</strong>{" "}
                    {reasonDisplay}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-[#AEBBC9]">
                  {lang === "hi" ? "आपातकालीन संपर्क (सत्यापित)" : "Emergency Contact"}
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#E6C98A] tracking-tight">
                  {chosenNumber.phone}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#43C6A5]">
                  {lang === "hi" ? "सत्यापन: आधिकारिक बैंक स्रोत" : "Verification: Official bank source"}
                  {activeResolution.lastVerifiedDate ? ` · ${activeResolution.lastVerifiedDate}` : ""}
                </p>
              </div>
            </div>

            {/* Official Line Distinction: Fraud Helpline vs 24x7 Care */}
            {activeResolution.fraudPhone && activeResolution.supportPhone && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#C6A15B]/20 text-xs">
                <span className="text-[#AEBBC9]">
                  {useGeneralCare
                    ? lang === "hi"
                      ? `समर्पित धोखाधड़ी हेल्पलाइन भी उपलब्ध: ${activeResolution.fraudPhone}`
                      : `Dedicated fraud helpline also available: ${activeResolution.fraudPhone}`
                    : lang === "hi"
                      ? `सामान्य 24x7 ग्राहक सेवा: ${activeResolution.supportPhone}`
                      : `General 24x7 customer care: ${activeResolution.supportPhone}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUseGeneralCare((v) => !v);
                    setConfirmOpen(false);
                  }}
                  className="font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                >
                  {useGeneralCare
                    ? lang === "hi"
                      ? "धोखाधड़ी हेल्पलाइन पर स्विच करें"
                      : "Switch to Fraud Helpline"
                    : lang === "hi"
                      ? "सामान्य ग्राहक सेवा उपयोग करें"
                      : "Use General Customer Care"}
                </button>
              </div>
            )}

            {/* Official Source & Website Verification Metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#AEBBC9]">
              {activeResolution.sourceUrl && (
                <a
                  href={buildSafeHttpsHref(activeResolution.sourceUrl, activeWebsite)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#C6A15B] hover:text-[#E6C98A] hover:underline"
                >
                  <span>{lang === "hi" ? "आधिकारिक सत्यापन स्रोत देखें" : "View Official Verification Source"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* 4 Clear Action Buttons OR Confirmation Step */}
            {!confirmOpen ? (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="gm-emergency-btn min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
                >
                  <PhoneCall className="w-4 h-4 shrink-0" />
                  <span>{lang === "hi" ? "अभी कॉल करें" : "Call Now"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyNumber(chosenNumber.phone)}
                  className="min-h-[46px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] cursor-pointer active:scale-[0.98]"
                >
                  {copiedNum === chosenNumber.phone ? (
                    <Check className="w-4 h-4 text-[#43C6A5] shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#E6C98A] shrink-0" />
                  )}
                  <span>
                    {copiedNum === chosenNumber.phone
                      ? lang === "hi"
                        ? "कॉपी हो गया"
                        : "Copied"
                      : lang === "hi"
                        ? "नंबर कॉपी करें"
                        : "Copy Number"}
                  </span>
                </button>

                <a
                  href={activeWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#E6C98A] whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === "hi" ? "आधिकारिक वेबसाइट" : "Visit Website"}</span>
                </a>

                <button
                  type="button"
                  onClick={openBankChanger}
                  className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#AEBBC9] shrink-0" />
                  <span>{lang === "hi" ? "बैंक बदलें" : "Change Bank"}</span>
                </button>
              </div>
            ) : (
              <div
                role="region"
                aria-label={lang === "hi" ? "कॉल पुष्टि" : "Confirm Emergency Bank Call"}
                className="p-4 rounded-xl bg-[#2E1219]/90 border border-[#E87575]/45 space-y-3"
              >
                <p className="text-sm font-semibold text-[#E87575]">
                  {lang === "hi" ? "फ़ोन डायलर खोलने की पुष्टि करें" : "Confirm Launching Phone Dialer"}
                </p>
                <div className="text-xs text-[#F4F0E6] space-y-1">
                  <p>
                    <strong>{lang === "hi" ? "बैंक:" : "Bank:"}</strong> {activeResolution.bankName}
                  </p>
                  <p>
                    <strong>{lang === "hi" ? "कारण:" : "Reason:"}</strong> {reasonDisplay}
                  </p>
                  <p>
                    <strong>{lang === "hi" ? "प्रकार:" : "Helpline Type:"}</strong> {chosenNumber.label}
                  </p>
                  <p className="font-mono tabular-nums">
                    <strong>{lang === "hi" ? "नंबर:" : "Number:"}</strong> {chosenNumber.phone}
                  </p>
                </div>
                <p className="text-[11px] text-[#AEBBC9]">
                  {lang === "hi"
                    ? "आगे बढ़ने पर मोबाइल में फ़ोन डायलर खुलेगा। डेस्कटॉप पर 'कॉपी करें' का उपयोग करके अपने फ़ोन से डायल करें। Guardian स्वचालित रूप से कॉल नहीं करता।"
                    : "Mobile devices will open the native phone dialer. On desktop browsers without calling apps, use 'Copy for Desktop' and dial on your phone. Guardian never auto-dials."}
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <a
                    href={chosenNumber.telUri}
                    onClick={() => logCallIntent("tel_dialer", chosenNumber.phone)}
                    className="gm-emergency-btn min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    <PhoneCall className="w-4 h-4" />
                    {lang === "hi"
                      ? `डायलर में कॉल करें (${chosenNumber.phone})`
                      : `Confirm & Dial ${chosenNumber.phone}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(chosenNumber.phone)}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/88 text-xs font-semibold text-[#F4F0E6] hover:border-[#E6C98A] cursor-pointer active:scale-[0.98]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {lang === "hi" ? "डेस्कटॉप के लिए कॉपी करें" : "Copy for Desktop"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-[#AEBBC9] hover:underline cursor-pointer"
                  >
                    {lang === "hi" ? "वापस" : "Back"}
                  </button>
                </div>
              </div>
            )}

            {callIntentNote && (
              <div className="flex items-center gap-2 text-xs text-[#43C6A5]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{callIntentNote}</span>
              </div>
            )}
          </div>
        ) : activeResolution && (activeResolution.status === "unavailable" || activeResolution.status === "invalid_record") ? (
          <div className="p-4 rounded-xl bg-[#2E1219]/90 border border-[#E87575]/45 text-xs text-[#E87575] space-y-1.5">
            <p className="font-semibold">
              {lang === "hi" ? activeResolution.numberTypeLabelHi : activeResolution.numberTypeLabel}
            </p>
            <p>{lang === "hi" ? activeResolution.messageHi : activeResolution.message}</p>
          </div>
        ) : null}

        {/* Step 5: Distinct "Report Financial Fraud" Section (1930 + cybercrime.gov.in) */}
        <div className="p-4 rounded-2xl bg-[#2E1219]/85 border border-[#E87575]/45 text-[#F4F0E6] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <EmergencyAssistance2D className="w-11 h-11 shrink-0" />
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#E87575]">
                {lang === "hi" ? "वित्तीय धोखाधड़ी की रिपोर्ट करें" : "Report Financial Fraud"}
              </p>
              <p className="text-xs font-semibold text-[#E6C98A]">
                {lang === "hi"
                  ? "राष्ट्रीय साइबर अपराध रिपोर्टिंग सेवा (भारत)"
                  : "India National Cyber Crime Reporting Service (Separate from Bank Helpline)"}
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-[#F4F0E6]">
                1930 · https://cybercrime.gov.in/
              </p>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "धोखाधड़ी से पैसा कटने पर तुरंत 1930 पर कॉल कर लेनदेन फ्रीज़ कराएं (यह भारत सरकार की राष्ट्रीय हेल्पलाइन है)।"
                  : "Call 1930 immediately if money was debited fraudulently to request rapid fund freeze via India's official national cybercrime service."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="tel:1930"
              onClick={() => logCallIntent("national_1930", "1930")}
              className="gm-emergency-btn min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap active:scale-[0.98]"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              {lang === "hi" ? "1930 कॉल करें" : "Call 1930"}
            </a>
            <a
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] hover:border-[#E6C98A] text-[#F4F0E6] text-xs font-semibold whitespace-nowrap"
            >
              {lang === "hi" ? "पोर्टल खोलें" : "cybercrime.gov.in"}
              <ExternalLink className="w-3.5 h-3.5 text-[#E6C98A]" />
            </a>
          </div>
        </div>

        {/* 6 Quick Emergency Actions (Before or After Calling) */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-[#AEBBC9]">
            {lang === "hi" ? "त्वरित आपातकालीन सुरक्षा कार्रवाई" : "Quick Emergency Actions (Before or After Calling)"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <a
              href={activeFraudUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 block"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <FileWarning className="w-3.5 h-3.5 text-[#E87575]" />
                  {lang === "hi" ? "अनधिकृत लेनदेन रिपोर्ट करें" : "Report Unauthorized Transactions"}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0 text-[#E6C98A]" />
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "तुरंत बैंक की धोखाधड़ी हेल्पलाइन और 1930 पर विवाद दर्ज करें।"
                  : "Report disputed debits within golden hour to bank & cybercrime.gov.in."}
              </p>
            </a>

            <a
              href={activeDebitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 block"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#E6C98A]" />
                  {lang === "hi" ? "डेबिट कार्ड ब्लॉक करें" : "Block Debit Card"}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0 text-[#E6C98A]" />
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "आधिकारिक नेटबैंकिंग या बैंक हेल्पलाइन से कार्ड हॉटलिस्ट करें।"
                  : "Hotlist ATM/debit card immediately via official bank portal or helpline."}
              </p>
            </a>

            <a
              href={activeUpiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 block"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#43C6A5]" />
                  {lang === "hi" ? "UPI एक्सेस सुरक्षित करें" : "Secure UPI Access"}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0 text-[#E6C98A]" />
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "बैंक से UPI चैनल अस्थायी रूप से ब्लॉक करने को कहें और UPI PIN बदलें।"
                  : "Ask bank to pause UPI ID/channel and reset UPI PIN immediately."}
              </p>
            </a>

            <a
              href="https://ceir.sancharsaathi.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 block"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#E87575]" />
                  {lang === "hi" ? "गुम या चोरी फ़ोन रिपोर्ट करें" : "Report Lost or Stolen Phone"}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0 text-[#E6C98A]" />
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "टेलीकॉम ऑपरेटर से SIM ब्लॉक कराएं और Sanchar Saathi CEIR पर IMEI ब्लॉक करें।"
                  : "Block SIM with carrier first, then block IMEI on Sanchar Saathi CEIR."}
              </p>
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate("approvals");
              }}
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 text-left cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldOff className="w-3.5 h-3.5 text-[#E6C98A]" />
                  {lang === "hi" ? "खाता प्रतिबंध अनुरोध करें" : "Request Account Restriction"}
                </span>
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "कॉल पर अस्थायी डेबिट फ़्रीज़ मांगें और Guardian पेमेंट लॉक चालू करें।"
                  : "Ask bank for temporary debit freeze & activate Guardian Payment Lock."}
              </p>
            </button>

            <a
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/75 hover:border-[#E6C98A] transition-colors space-y-1 block"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-[#F4F0E6]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#E87575]" />
                  {lang === "hi" ? "साइबर धोखाधड़ी रिपोर्ट करें" : "Report Cyber Fraud (1930)"}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0 text-[#E6C98A]" />
              </div>
              <p className="text-[11px] text-[#AEBBC9]">
                {lang === "hi"
                  ? "आधिकारिक राष्ट्रीय पोर्टल cybercrime.gov.in पर शिकायत दर्ज करें।"
                  : "File online financial fraud complaint at cybercrime.gov.in."}
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
