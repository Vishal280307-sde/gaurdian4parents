import React, { useState } from "react";
import {
  ShieldCheck,
  Bell,
  PhoneCall,
  PhoneIncoming,
  ShieldAlert,
  Lock,
  Settings,
  CreditCard,
  ShieldOff,
  FileWarning,
  ArrowRight,
  Wallet,
  Users,
  AlertOctagon,
  Camera,
  BookOpen,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Activity,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";
import { sectionReveal } from "../lib/motionSystem";
import { apiFetch } from "../lib/api";
import { EmptyStateCard } from "./VisualAsset";
import { RiskHistoryPanel } from "./RiskHistoryPanel";
import { BankCrestBadge, EmergencyCallButton } from "./EmergencyBankCallModal";
import { SwipeableCardDeck } from "./SwipeableCardDeck";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import {
  Cybersecurity2D,
  EmergencyAssistance2D,
  FamilyProtection2D,
  FinancialProtection2D,
  GuardianAi2D,
  LinkedGuardians2D,
} from "./Illustrations2D";
import type { ScamAwarenessId } from "../data/awarenessContent";
import type { AppStatePayload, LangCode, TabKey } from "../types/guardian";

interface OverviewTabProps {
  state: AppStatePayload;
  lang: LangCode;
  onNavigate: (tab: TabKey) => void;
  onRefresh: () => Promise<void>;
  onOpenLiveQr?: () => void;
  onOpenAwareness?: (cardId?: ScamAwarenessId) => void;
}

const GOLD_HERO_BG = "/src/assets/images/gold_security_hero_1795443534804.jpg";

function safeHttps(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getTimeGreeting(lang: LangCode): string {
  const hr = new Date().getHours();
  if (hr < 12) return lang === "hi" ? "सुप्रभात" : "Good Morning";
  if (hr < 17) return lang === "hi" ? "नमस्कार" : "Good Afternoon";
  return lang === "hi" ? "शुभ संध्या" : "Good Evening";
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  lang,
  onNavigate,
  onRefresh,
  onOpenLiveQr,
  onOpenAwareness,
}) => {
  const { openEmergencyCall } = useEmergencyCall();
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  const [togglingCallProtect, setTogglingCallProtect] = useState(false);

  const isParent = state.user.role === "parent";
  const savedBanks = state.userBanks || [];
  const primaryBank =
    savedBanks.find((b) => b.isPrimary) ||
    savedBanks[0] ||
    (!isParent ? state.linkedParentBanks?.[0] : undefined) ||
    null;

  const activeGuardians = (state.links || []).filter((l) => l.status === "active");
  const linkedParents = state.linkedParents || [];
  const familyMemberCount = 1 + (isParent ? activeGuardians.length : linkedParents.length);

  const pendingApprovals = state.reqs.filter(
    (r) => r.st === "pending" || r.st === "verification_requested"
  ).length;
  const unreadCount = state.notifications.filter((n) => !n.read_at).length;
  const activeRedAlerts = isParent
    ? state.gsi?.activeRedAlerts || []
    : state.linkedGsiOverview?.activeRedAlerts || [];
  const qrList = isParent ? state.qrScans || [] : state.linkedQrScans || [];
  const callCount = isParent
    ? state.callWatcher?.calls?.length || 0
    : state.linkedCallWatcherEvents?.length || 0;

  const callSummary = state.callWatcher?.summary;
  const guardianCallSummaries = state.linkedCallProtectionSummary || [];
  const primaryGuardianCall = guardianCallSummaries[0];

  const autoEnabled = isParent
    ? Boolean(callSummary?.autoDetectionEnabled ?? state.callWatcher?.settings?.consent_status === "active")
    : Boolean(primaryGuardianCall?.autoDetectionEnabled);
  const callsScreenedCount = isParent
    ? callSummary?.callsScreened ?? (state.callWatcher?.calls?.length || 0)
    : guardianCallSummaries.reduce((sum, s) => sum + s.callsScreened, 0);
  const suspiciousCallCount = isParent
    ? callSummary?.suspiciousIdentified ?? 0
    : guardianCallSummaries.reduce((sum, s) => sum + s.suspiciousIdentified, 0);
  const lastScreeningAt = isParent
    ? callSummary?.lastScreeningAt ?? null
    : primaryGuardianCall?.lastScreeningAt ?? null;
  const recentlyFlaggedCalls = isParent
    ? callSummary?.recentlyFlagged || []
    : guardianCallSummaries.flatMap((g) => g.recentlyFlagged || []).slice(0, 5);

  const hasUrgentAlerts = activeRedAlerts.length > 0;
  const totalAlertsToday = activeRedAlerts.length + suspiciousCallCount;
  const greeting = getTimeGreeting(lang);

  const overallIndicator = hasUrgentAlerts
    ? lang === "hi"
      ? "समीक्षा आवश्यक"
      : "Attention Needed"
    : autoEnabled
      ? lang === "hi"
        ? "सुरक्षा सक्रिय"
        : "Protected"
      : lang === "hi"
        ? "मानक सुरक्षा"
        : "Standard Shield";

  const statusSentence = hasUrgentAlerts
    ? lang === "hi"
      ? `${activeRedAlerts.length} सक्रिय रेड अलर्ट की समीक्षा करें या आवश्यकता होने पर सीधे अपने बैंक से संपर्क करें।`
      : `${activeRedAlerts.length} active high-risk alert awaits your review; contact your bank immediately if details were shared.`
    : lang === "hi"
      ? "आपका परिवार खाता सहमति-प्रथम सुरक्षा, सत्यापित बैंक सहायता और शून्य कॉल-ऑडियो रिकॉर्डिंग के साथ सुरक्षित है।"
      : "Your family digital perimeter is shielded with consent-first oversight, verified bank support, and zero call recording.";

  const chartSegments = [
    {
      label: lang === "hi" ? "QR जांच" : "QR Checks",
      count: qrList.length,
      barClass: "bg-[#6CC4E8]",
    },
    {
      label: lang === "hi" ? "कॉल मेटाडेटा" : "Call Timing",
      count: callCount,
      barClass: "bg-[#C6A15B]",
    },
    {
      label: lang === "hi" ? "लंबित अनुमोदन" : "Pending Approvals",
      count: pendingApprovals,
      barClass: "bg-[#E6C98A]",
    },
    {
      label: lang === "hi" ? "रेड अलर्ट" : "Red Alerts",
      count: activeRedAlerts.length,
      barClass: "bg-[#E87575]",
    },
  ];
  const totalActivity = Math.max(1, chartSegments.reduce((sum, s) => sum + s.count, 0));

  async function toggleAutomaticCallProtection() {
    if (!isParent) return;
    setTogglingCallProtect(true);
    try {
      await apiFetch("/api/call-watcher/consent", {
        method: "POST",
        body: JSON.stringify({ action: autoEnabled ? "pause" : "activate" }),
      });
      await onRefresh();
    } finally {
      setTogglingCallProtect(false);
    }
  }

  async function markAllRead() {
    await apiFetch("/api/notifications/read", { method: "POST" });
    await onRefresh();
  }

  // Complementary Dashboard Colour Palette per Feature Card
  const featureCards = [
    {
      key: "live_qr",
      title: lang === "hi" ? "लाइव QR स्कैनर" : "Live QR Scanner",
      desc:
        lang === "hi"
          ? "भुगतान से पहले कैमरे से QR स्कैन करें।"
          : "Scan any UPI or link QR live with your camera.",
      actionLabel: lang === "hi" ? "स्कैन शुरू करें" : "Scan Now",
      Icon: Camera,
      surfaceCls: "bg-[#0D2A33]/92 border-[#6CC4E8]/40 hover:border-[#6CC4E8]",
      iconBoxCls: "bg-[#071525]/80 border-[#6CC4E8]/50 text-[#6CC4E8]",
      actionCls: "text-[#6CC4E8]",
      onClick: () => (onOpenLiveQr ? onOpenLiveQr() : onNavigate("scam_qr")),
    },
    {
      key: "cyber",
      title: lang === "hi" ? "साइबर सुरक्षा जांच" : "Cyber Safety Check",
      desc:
        lang === "hi"
          ? "नंबर, UPI ID और संदिग्ध लिंक जांचें।"
          : "Verify phone numbers, UPI handles & URLs.",
      actionLabel: lang === "hi" ? "अभी जांचें" : "Verify Now",
      Icon: ShieldCheck,
      surfaceCls: "bg-[#1E1A36]/92 border-[#B8A8F8]/38 hover:border-[#B8A8F8]",
      iconBoxCls: "bg-[#071525]/80 border-[#B8A8F8]/50 text-[#B8A8F8]",
      actionCls: "text-[#B8A8F8]",
      onClick: () => onNavigate("cyber_check"),
    },
    {
      key: "calls",
      title: lang === "hi" ? "कॉल सुरक्षा" : "Call Protection",
      desc:
        lang === "hi"
          ? "बिना ऑडियो रिकॉर्डिंग संदिग्ध कॉल जांचें।"
          : "Screen unknown callers with zero call recording.",
      actionLabel: lang === "hi" ? "कॉल जांचें" : "Open Shield",
      Icon: PhoneCall,
      surfaceCls: "bg-[#10243A]/92 border-[#AEBBC9]/38 hover:border-[#E6C98A]",
      iconBoxCls: "bg-[#071525]/80 border-[#AEBBC9]/45 text-[#AEBBC9]",
      actionCls: "text-[#AEBBC9]",
      onClick: () => onNavigate("calls_links"),
    },
    {
      key: "security_score",
      title: lang === "hi" ? "सुरक्षा स्कोर व अनुमोदन" : "Security Score & Family",
      desc:
        lang === "hi"
          ? `भुगतान लॉक और परिवार अनुमोदन (${pendingApprovals} लंबित)।`
          : `Payment guard & family queue (${pendingApprovals} pending).`,
      actionLabel: lang === "hi" ? "नियंत्रण खोलें" : "Manage Hub",
      Icon: Wallet,
      surfaceCls: "bg-[#252A32]/92 border-[#C6A15B]/45 hover:border-[#E6C98A]",
      iconBoxCls: "bg-[#071525]/80 border-[#C6A15B]/55 text-[#C6A15B]",
      actionCls: "text-[#E6C98A]",
      onClick: () => onNavigate("approvals"),
    },
    {
      key: "awareness",
      title: lang === "hi" ? "साइबर जागरूकता" : "Cyber Awareness",
      desc:
        lang === "hi"
          ? "9 सामान्य ठगी उदाहरण, ऑडियो व आधिकारिक पोर्टल।"
          : "9 scam guides, audio help & official portals.",
      actionLabel: lang === "hi" ? "गाइड देखें" : "Explore Guides",
      Icon: BookOpen,
      surfaceCls: "bg-[#0B2825]/92 border-[#43C6A5]/40 hover:border-[#43C6A5]",
      iconBoxCls: "bg-[#071525]/80 border-[#43C6A5]/50 text-[#43C6A5]",
      actionCls: "text-[#43C6A5]",
      onClick: () => (onOpenAwareness ? onOpenAwareness() : onNavigate("awareness")),
    },
    {
      key: "emergency",
      title: lang === "hi" ? "आपातकालीन SOS सहायता" : "Emergency SOS Help",
      desc:
        lang === "hi"
          ? "सत्यापित बैंक कॉल या 1930 सहायता।"
          : "Call your verified bank or dial 1930 fast.",
      actionLabel: lang === "hi" ? "आपातकालीन कॉल" : "Get Help",
      Icon: AlertOctagon,
      surfaceCls: "bg-[#2E1219]/92 border-[#E87575]/45 hover:border-[#E87575]",
      iconBoxCls: "bg-[#071525]/80 border-[#E87575]/55 text-[#E87575]",
      actionCls: "text-[#E87575]",
      onClick: () =>
        openEmergencyCall({
          source: "epp",
          reason: lang === "hi" ? "आपातकालीन वित्तीय सुरक्षा सहायता" : "Emergency financial protection assistance",
        }),
    },
  ];

  const primaryDebitUrl = safeHttps(
    primaryBank?.debitBlockUrl || primaryBank?.officialWebsite,
    "https://cybercrime.gov.in/"
  );
  const primaryUpiUrl = safeHttps(
    primaryBank?.upiBlockUrl || primaryBank?.officialWebsite,
    "https://cybercrime.gov.in/"
  );

  // 4 Dashboard KPI cards (Swipeable on mobile, 4-col grid on md+)
  const kpiCards = [
    <div
      key="kpi-family"
      className="h-full rounded-2xl p-5 flex items-start justify-between gap-3 bg-[#0C2340]/92 border border-[#56C2DF]/38 shadow-[0_12px_28px_-14px_rgba(3,8,18,0.8)]"
    >
      <div className="min-w-0">
        <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "परिवार के सदस्य" : "Family Members"}</p>
        <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#F4F0E6]">{familyMemberCount}</p>
        <p className="mt-1 text-[11px] text-[#56C2DF] font-medium truncate">
          {isParent
            ? lang === "hi"
              ? `${activeGuardians.length} सक्रिय अभिभावक`
              : `${activeGuardians.length} active guardians`
            : lang === "hi"
              ? `${linkedParents.length} जुड़े माता-पिता`
              : `${linkedParents.length} linked parents`}
        </p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#071525]/80 border border-[#56C2DF]/45 flex items-center justify-center text-[#56C2DF] shrink-0">
        <Users className="w-5 h-5" />
      </div>
    </div>,

    <div
      key="kpi-status"
      className="h-full rounded-2xl p-5 flex items-start justify-between gap-3 bg-[#0B2825]/92 border border-[#43C6A5]/38 shadow-[0_12px_28px_-14px_rgba(3,8,18,0.8)]"
    >
      <div className="min-w-0">
        <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "सुरक्षा स्थिति" : "Security Status"}</p>
        <p
          className={`mt-1.5 text-lg font-bold truncate ${
            hasUrgentAlerts ? "text-[#E87575]" : "text-[#43C6A5]"
          }`}
        >
          {overallIndicator}
        </p>
        <p className="mt-1 text-[11px] text-[#AEBBC9] truncate">
          {autoEnabled
            ? lang === "hi"
              ? "कॉल सुरक्षा चालू (ON)"
              : "Call Guard ON · QR Ready"
            : lang === "hi"
              ? "कॉल सुरक्षा बंद (OFF)"
              : "Call Guard OFF"}
        </p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#071525]/80 border border-[#43C6A5]/45 flex items-center justify-center text-[#43C6A5] shrink-0">
        <Shield className="w-5 h-5" />
      </div>
    </div>,

    <div
      key="kpi-alerts"
      className="h-full rounded-2xl p-5 flex items-start justify-between gap-3 bg-[#2B2112]/92 border border-[#E6C98A]/38 shadow-[0_12px_28px_-14px_rgba(3,8,18,0.8)]"
    >
      <div className="min-w-0">
        <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "सक्रिय अलर्ट" : "Alerts Today"}</p>
        <p
          className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
            totalAlertsToday > 0 ? "text-[#E87575]" : "text-[#E6C98A]"
          }`}
        >
          {totalAlertsToday}
        </p>
        <p className="mt-1 text-[11px] text-[#AEBBC9] truncate">
          {unreadCount > 0
            ? lang === "hi"
              ? `${unreadCount} अपठित सूचनाएं`
              : `${unreadCount} unread notifications`
            : lang === "hi"
              ? "कोई नया रेड अलर्ट नहीं"
              : "All notifications reviewed"}
        </p>
      </div>
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
          totalAlertsToday > 0
            ? "bg-[#2E1219] border-[#E87575]/50 text-[#E87575]"
            : "bg-[#071525]/80 border-[#E6C98A]/45 text-[#E6C98A]"
        }`}
      >
        <Bell className="w-5 h-5" />
      </div>
    </div>,

    <div
      key="kpi-finance"
      className="h-full rounded-2xl p-5 flex items-start justify-between gap-3 bg-[#252A32]/92 border border-[#C6A15B]/40 shadow-[0_12px_28px_-14px_rgba(3,8,18,0.8)]"
    >
      <div className="min-w-0">
        <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "वित्तीय अवलोकन" : "Financial Overview"}</p>
        <p className="mt-1.5 text-lg font-bold text-[#F4F0E6] truncate">
          {primaryBank ? primaryBank.shortCode : lang === "hi" ? "बैंक चुनें" : "Set Bank"}
        </p>
        <p className="mt-1 text-[11px] text-[#C6A15B] font-mono tabular-nums truncate">
          {pendingApprovals} {lang === "hi" ? "लंबित अनुमोदन" : "pending approvals"}
        </p>
      </div>
      <FinancialProtection2D className="w-11 h-11 shrink-0" />
    </div>,
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionReveal} className="space-y-6 sm:space-y-7">
      {/* 1. Welcome Hero Card + Linked Guardians Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 gm-glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <img
              src={GOLD_HERO_BG}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-bottom opacity-22"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071525]/92 via-[#10243A]/82 to-[#252A32]/72" />
            <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#C6A15B]/15 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#E6C98A]">
                  {greeting}
                </span>
                <span className="text-[#C6A15B]/45">·</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    hasUrgentAlerts ? "text-[#E87575]" : "text-[#43C6A5]"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  {overallIndicator}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                {state.user.profilePicture ? (
                  <img
                    src={state.user.profilePicture}
                    alt={state.user.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border border-[#C6A15B]/60 shadow-[0_0_18px_rgba(198,161,91,0.3)] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-[#252A32] border border-[#C6A15B]/55 flex items-center justify-center text-base font-bold text-[#E6C98A] shrink-0">
                    {state.user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F0E6] [text-wrap:balance]">
                  {lang === "hi" ? `नमस्ते, ${state.user.name}!` : `Hello, ${state.user.name}!`}
                </h1>
              </div>

              <p className="text-sm text-[#AEBBC9] leading-relaxed max-w-xl">{statusSentence}</p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate("approvals")}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl gm-gold-btn text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{lang === "hi" ? "परिवार हब देखें" : "View Family Hub"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => (onOpenLiveQr ? onOpenLiveQr() : onNavigate("scam_qr"))}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#C6A15B]/45 bg-[#10243A]/85 hover:border-[#E6C98A] text-[#F4F0E6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
                >
                  <Camera className="w-4 h-4 text-[#E6C98A] shrink-0" />
                  <span>{lang === "hi" ? "लाइव QR स्कैन" : "Live QR Scanner"}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openEmergencyCall({
                      source: "dashboard",
                      reason: lang === "hi" ? "आपातकालीन बैंक सहायता" : "Emergency bank assistance",
                    })
                  }
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl gm-emergency-btn text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
                >
                  <PhoneCall className="w-4 h-4 shrink-0" />
                  <span>{lang === "hi" ? "आपातकालीन SOS" : "Emergency SOS"}</span>
                </button>
              </div>
            </div>

            {/* Golden Matte 2D Family Shield Vector Illustration */}
            <div className="relative shrink-0">
              <FamilyProtection2D
                className="w-36 h-36 sm:w-44 sm:h-44 drop-shadow-[0_12px_32px_rgba(198,161,91,0.28)]"
                title={lang === "hi" ? "गार्जियन परिवार सुरक्षा कवच" : "Guardian Golden Shield family protection"}
              />
            </div>
          </div>
        </div>

        {/* Linked Guardians / Parents Card (#10243A + Muted Silver #AEBBC9) */}
        <div className="lg:col-span-4 rounded-3xl p-6 flex flex-col justify-between bg-[#10243A]/92 border border-[#AEBBC9]/35 shadow-[0_16px_36px_-14px_rgba(3,8,18,0.85)]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-[#F4F0E6] flex items-center gap-2.5">
                <LinkedGuardians2D className="w-9 h-9 shrink-0" />
                {isParent
                  ? lang === "hi"
                    ? "जुड़े अभिभावक"
                    : "Linked Guardians"
                  : lang === "hi"
                    ? "जुड़े माता-पिता"
                    : "Linked Parents"}
              </h2>
              <span
                className={`text-[11px] font-semibold ${
                  (isParent ? activeGuardians.length : linkedParents.length) > 0
                    ? "text-[#43C6A5]"
                    : "text-[#E6C98A]"
                }`}
              >
                {(isParent ? activeGuardians.length : linkedParents.length) > 0
                  ? lang === "hi"
                    ? "सक्रिय"
                    : "Connected"
                  : lang === "hi"
                    ? "प्रतीक्षित"
                    : "Setup"}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-[#AEBBC9] leading-relaxed">
              {isParent
                ? lang === "hi"
                  ? "केवल आपके द्वारा आमंत्रित सत्यापित परिजन ही अनुरोध देख सकते हैं।"
                  : "Only verified family members you invite can review flagged requests."
                : lang === "hi"
                  ? "वे खाते जिन्होंने आपको समीक्षा व अनुमोदन अनुमति दी है।"
                  : "Family accounts granting you read and approval oversight."}
            </p>

            <div className="mt-4 space-y-2.5">
              {isParent ? (
                activeGuardians.length > 0 ? (
                  activeGuardians.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#071525]/70 border border-[#AEBBC9]/25"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C6A15B]/30 to-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center text-xs font-bold text-[#F4F0E6] shrink-0">
                        {(l.guardian_name || "G").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F4F0E6] truncate">
                          {l.guardian_name || "Family Guardian"}
                        </p>
                        <p className="text-[11px] text-[#43C6A5] font-medium">
                          {l.is_secondary
                            ? lang === "hi"
                              ? "द्वितीयक · सक्रिय"
                              : "Secondary · Active"
                            : lang === "hi"
                              ? "प्राथमिक · सक्रिय"
                              : "Primary · Active"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#AEBBC9] py-3">
                    {lang === "hi"
                      ? "अभी कोई अभिभावक जुड़ा नहीं है। आमंत्रण कोड बनाएं।"
                      : "No active guardian linked yet. Generate an invite code."}
                  </p>
                )
              ) : linkedParents.length > 0 ? (
                linkedParents.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#071525]/70 border border-[#AEBBC9]/25"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C6A15B]/30 to-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center text-xs font-bold text-[#F4F0E6] shrink-0">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#F4F0E6] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#AEBBC9]">
                        Alerts {p.guardian_alerts ? "On" : "Off"} · Approvals {p.guardian_approve ? "On" : "Off"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#AEBBC9] py-3">
                  {lang === "hi"
                    ? "अभी कोई माता-पिता खाता जुड़ा नहीं है।"
                    : "No parent linked yet. Accept an invite code in Family Hub."}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onNavigate("approvals")}
              className="min-h-[42px] w-full py-2.5 px-4 rounded-2xl border border-[#C6A15B]/40 bg-[#071525]/75 hover:border-[#E6C98A] hover:bg-[#252A32] text-xs font-semibold text-[#F4F0E6] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#E6C98A]" />
              <span>
                {isParent
                  ? lang === "hi"
                    ? "अभिभावक जोड़ें / प्रबंधित करें"
                    : "Add Guardian & Manage Links"
                  : lang === "hi"
                    ? "परिवार लिंक प्रबंधित करें"
                    : "Manage Family Links"}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. 4 Dashboard KPI Cards (Android Swipe Carousel on <md, 4-col Grid on md+) */}
      <section aria-label={lang === "hi" ? "मुख्य सुरक्षा आंकड़े" : "Dashboard security statistics"}>
        <SwipeableCardDeck
          ariaLabel={lang === "hi" ? "मुख्य सुरक्षा आंकड़े कार्ड" : "Key security summary cards"}
          itemClassName="w-[78vw] max-w-[290px] shrink-0 snap-center"
          desktopGridClassName="md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4"
        >
          {kpiCards}
        </SwipeableCardDeck>
      </section>

      {/* 3. Wide Security Update Banner + Parents AI Spotlight */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 gp-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[#C6A15B]/35">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                hasUrgentAlerts
                  ? "bg-[#2E1219] border-[#E87575]/50 text-[#E87575]"
                  : pendingApprovals > 0
                    ? "bg-[#2B2112] border-[#E6C98A]/45 text-[#E6C98A]"
                    : "bg-[#252A32] border-[#C6A15B]/45 text-[#E6C98A]"
              }`}
            >
              {hasUrgentAlerts ? <AlertOctagon className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-bold text-[#F4F0E6]">
                {hasUrgentAlerts
                  ? lang === "hi"
                    ? `सुरक्षा अपडेट: ${activeRedAlerts.length} उच्च-जोखिम चेतावनी सक्रिय`
                    : `Security Alert: ${activeRedAlerts.length} High-Risk Warning Active`
                  : pendingApprovals > 0
                    ? lang === "hi"
                      ? `सुरक्षा अपडेट: ${pendingApprovals} परिवार अनुमोदन प्रतीक्षारत`
                      : `Security Update: ${pendingApprovals} Family Approval Waiting`
                    : lang === "hi"
                      ? "सुरक्षा अपडेट: गार्जियन शील्ड निगरानी सक्रिय"
                      : "Security Update: Guardian Shield Monitoring Active"}
              </h2>
              <p className="text-xs text-[#AEBBC9] leading-relaxed">
                {hasUrgentAlerts
                  ? lang === "hi"
                    ? "तुरंत नीचे विवरण जांचें या सहायता के लिए अपने बैंक से संपर्क करें।"
                    : "Review recent flagged QR/call reports below or call your verified bank helpline."
                  : lang === "hi"
                    ? `${qrList.length} QR जांच व ${callsScreenedCount} कॉल स्क्रीनिंग दर्ज हुई हैं।`
                    : `${qrList.length} QR inspections and ${callsScreenedCount} caller metadata screenings logged with zero audio recording.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowDetailedLogs((v) => !v)}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-[#C6A15B]/38 bg-[#10243A]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>
                {showDetailedLogs
                  ? lang === "hi"
                    ? "विवरण छुपाएं"
                    : "Hide Details"
                  : lang === "hi"
                    ? "विवरण देखें"
                    : "View Details"}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E6C98A]" />
            </button>

            {hasUrgentAlerts && (
              <button
                type="button"
                onClick={() =>
                  openEmergencyCall({
                    source: "dashboard",
                    riskLevel: "HIGH RISK",
                    reason: lang === "hi" ? "सक्रिय रेड अलर्ट समीक्षा" : "Active high-risk security alert",
                  })
                }
                className="min-h-[40px] px-4 py-2 rounded-xl gm-emergency-btn text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {lang === "hi" ? "बैंक को कॉल करें" : "Call Bank"}
              </button>
            )}
          </div>
        </div>

        {/* Parents AI Card (#0A192E + Champagne Gold #E6C98A) */}
        <button
          type="button"
          onClick={() => onNavigate("parents_ai")}
          className="lg:col-span-4 rounded-2xl p-4 sm:p-5 bg-[#0A192E]/95 border border-[#E6C98A]/40 hover:border-[#E6C98A] text-left flex items-center justify-between gap-3 transition-all hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <GuardianAi2D className="w-11 h-11 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#F4F0E6] truncate">
                {lang === "hi" ? "पेरेंट्स AI सलाहकार" : "Parents AI Advisor"}
              </h3>
              <p className="text-xs text-[#AEBBC9] truncate">
                {lang === "hi" ? "Gemini व गार्जियन बजट/सुरक्षा मदद" : "Gemini & Guardian family assistance"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#E6C98A] shrink-0" />
        </button>
      </section>

      {/* Activity Breakdown Progressive Bar */}
      <section className="gp-card rounded-2xl p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowActivityDetails((v) => !v)}
          aria-expanded={showActivityDetails}
          className="w-full flex items-center justify-between text-xs font-semibold text-[#E6C98A] cursor-pointer"
        >
          <span>
            {lang === "hi" ? "सुरक्षा गतिविधि सारांश देखें" : "Safety Activity Breakdown"} (
            {qrList.length + callCount + pendingApprovals + activeRedAlerts.length})
          </span>
          {showActivityDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showActivityDetails && (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full overflow-hidden bg-[#071525] flex">
              {chartSegments.map((seg) => (
                <div
                  key={seg.label}
                  style={{ width: `${Math.max(seg.count > 0 ? 8 : 0, (seg.count / totalActivity) * 100)}%` }}
                  className={`${seg.barClass} transition-all duration-200`}
                  title={`${seg.label}: ${seg.count}`}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#AEBBC9]">
              {chartSegments.map((seg) => (
                <span key={seg.label} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded-xs ${seg.barClass}`} />
                  <span>{seg.label}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#F4F0E6]">{seg.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. Feature Cards Grid (Android Swipe Deck on <md, 3-col Grid on lg+) */}
      <section aria-labelledby="safety-tools-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="safety-tools-heading" className="font-display text-base font-bold text-[#F4F0E6]">
            {lang === "hi" ? "सुरक्षा उपकरण और परिवार नियंत्रण" : "Safety Tools & Family Controls"}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("parents_ai")}
            className="text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer whitespace-nowrap"
          >
            {lang === "hi" ? "पेरेंट्स AI कार्यक्षेत्र →" : "Open Parents AI →"}
          </button>
        </div>

        <SwipeableCardDeck
          ariaLabel={lang === "hi" ? "सुरक्षा उपकरण कार्ड" : "Safety tool cards"}
          itemClassName="w-[82vw] max-w-[330px] shrink-0 snap-center"
          desktopGridClassName="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4"
        >
          {featureCards.map((card) => {
            const Icon = card.Icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className={`w-full h-full rounded-2xl p-5 border text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 shadow-[0_14px_30px_-14px_rgba(3,8,18,0.85)] transition-all duration-200 cursor-pointer group active:scale-[0.98] ${card.surfaceCls}`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${card.iconBoxCls}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base font-bold text-[#F4F0E6] leading-snug">{card.title}</h3>
                    <p className="text-xs text-[#AEBBC9] leading-snug">{card.desc}</p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${card.actionCls}`}>
                  <span>{card.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </SwipeableCardDeck>
      </section>

      {/* 5. Dedicated Emergency Financial Protection Section */}
      <section
        aria-labelledby="emergency-financial-heading"
        className="rounded-2xl p-6 space-y-5 bg-gradient-to-br from-[#2E1219]/90 via-[#10243A]/92 to-[#071525]/95 border border-[#E87575]/40 shadow-[0_16px_38px_-14px_rgba(3,8,18,0.85)]"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E87575]/25">
          <div className="flex items-start gap-3.5 min-w-0">
            {primaryBank ? (
              <BankCrestBadge shortCode={primaryBank.shortCode} />
            ) : (
              <EmergencyAssistance2D className="w-12 h-12 shrink-0" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-[#E87575]">
                {lang === "hi" ? "आपातकालीन वित्तीय सुरक्षा" : "Emergency Financial Protection"}
              </p>
              {primaryBank ? (
                <>
                  <h2 id="emergency-financial-heading" className="text-lg font-bold text-[#F4F0E6]">
                    {primaryBank.bankName}
                    {primaryBank.accountNickname ? ` · ${primaryBank.accountNickname}` : ""}
                  </h2>
                  <p className="text-xs text-[#AEBBC9] font-mono tabular-nums">
                    {primaryBank.callResolution.numberType === "fraud_reporting"
                      ? lang === "hi"
                        ? "सत्यापित धोखाधड़ी हेल्पलाइन:"
                        : "Verified Fraud Helpline:"
                      : lang === "hi"
                        ? "सत्यापित 24x7 ग्राहक सेवा:"
                        : "Verified 24x7 Customer Care:"}{" "}
                    <strong className="text-[#E6C98A]">
                      {primaryBank.callResolution.dialNumber || primaryBank.supportPhone}
                    </strong>{" "}
                    · {lang === "hi" ? "राष्ट्रीय साइबर अपराध:" : "National Cybercrime:"} 1930
                  </p>
                </>
              ) : (
                <>
                  <h2 id="emergency-financial-heading" className="text-lg font-bold text-[#F4F0E6]">
                    {lang === "hi"
                      ? "1-टैप आपातकालीन कॉल के लिए बैंक चुनें"
                      : "Select Your Primary Bank for 1-Tap Calling"}
                  </h2>
                  <p className="text-xs text-[#AEBBC9]">
                    {lang === "hi"
                      ? "आपकी प्रोफ़ाइल में अभी कोई बैंक नहीं जुड़ा है। तुरंत चुनने के लिए 'बैंक को कॉल करें' दबाएं।"
                      : "No bank saved yet. Tap Call My Bank to select your bank or configure it in Settings."}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <EmergencyCallButton
              lang={lang}
              primaryBankName={primaryBank?.shortCode || null}
              onClick={() =>
                openEmergencyCall({
                  source: "dashboard",
                  reason: lang === "hi" ? "संदिग्ध वित्तीय धोखाधड़ी सहायता" : "Suspected financial fraud assistance",
                })
              }
            />
            <button
              type="button"
              onClick={() => onNavigate("approvals")}
              className="min-h-[48px] inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-[#E6C98A]" />
              {lang === "hi" ? "बैंक बदलें" : "Change Bank"}
            </button>
          </div>
        </div>

        {/* 5 Dedicated Emergency Financial Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() =>
              openEmergencyCall({
                source: "epp",
                reason: lang === "hi" ? "तत्काल बैंक हेल्पलाइन कॉल" : "Urgent verified bank helpline call",
              })
            }
            className="min-h-[56px] p-3.5 rounded-xl border border-[#E87575]/45 bg-[#2E1219]/90 hover:border-[#E87575] text-left transition-colors cursor-pointer space-y-1 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#E87575]">
              <PhoneCall className="w-4 h-4 shrink-0" />
              <span>{lang === "hi" ? "मेरे बैंक को कॉल करें" : "Call My Bank"}</span>
            </div>
            <p className="text-[11px] text-[#F4F0E6] font-mono tabular-nums truncate">
              {primaryBank ? primaryBank.callResolution.dialNumber || primaryBank.supportPhone : "Select Bank"}
            </p>
          </button>

          <a
            href={primaryDebitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[56px] p-3.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 hover:border-[#E6C98A] text-left transition-colors space-y-1 block"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F0E6]">
              <CreditCard className="w-4 h-4 text-[#E6C98A] shrink-0" />
              <span>{lang === "hi" ? "डेबिट कार्ड ब्लॉक करें" : "Block My Debit Card"}</span>
            </div>
            <p className="text-[11px] text-[#AEBBC9]">
              {lang === "hi" ? "आधिकारिक बैंक पोर्टल खोलें" : "Open official card block portal"}
            </p>
          </a>

          <a
            href={primaryUpiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[56px] p-3.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 hover:border-[#E6C98A] text-left transition-colors space-y-1 block"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F0E6]">
              <Lock className="w-4 h-4 text-[#E6C98A] shrink-0" />
              <span>{lang === "hi" ? "मेरा UPI सुरक्षित करें" : "Secure My UPI"}</span>
            </div>
            <p className="text-[11px] text-[#AEBBC9]">
              {lang === "hi" ? "UPI रोकें या पिन बदलें" : "Pause UPI handle & reset PIN"}
            </p>
          </a>

          <button
            type="button"
            onClick={() => onNavigate("approvals")}
            className="min-h-[56px] p-3.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 hover:border-[#E6C98A] text-left transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F0E6]">
              <ShieldOff className="w-4 h-4 text-[#E6C98A] shrink-0" />
              <span>{lang === "hi" ? "भुगतान ऐप्स सुरक्षित करें" : "Secure My Payment Apps"}</span>
            </div>
            <p className="text-[11px] text-[#AEBBC9]">
              {lang === "hi" ? "आपातकालीन भुगतान लॉक" : "Activate Guardian payment lock"}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              openEmergencyCall({
                source: "lost_phone",
                threatCategory: lang === "hi" ? "साइबर धोखाधड़ी / फ़ोन गुम" : "Cyber Fraud / Lost Phone",
                riskLevel: "HIGH RISK",
                reason:
                  lang === "hi"
                    ? "1930 व cybercrime.gov.in पर तुरंत धोखाधड़ी रिपोर्ट करें"
                    : "Report cyber fraud immediately on 1930 & cybercrime.gov.in",
                suggestedAction:
                  "Please record my fraud complaint, freeze unauthorized channels, and share the transaction reference for 1930.",
              })
            }
            className="min-h-[56px] p-3.5 rounded-xl border border-[#E87575]/35 bg-[#10243A]/80 hover:border-[#E87575] text-left transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E87575]">
              <FileWarning className="w-4 h-4 shrink-0" />
              <span>{lang === "hi" ? "साइबर धोखाधड़ी रिपोर्ट करें" : "Report Cyber Fraud"}</span>
            </div>
            <p className="text-[11px] text-[#AEBBC9]">
              {lang === "hi" ? "1930 हेल्पलाइन व गुम फ़ोन मदद" : "1930 helpline & lost phone steps"}
            </p>
          </button>
        </div>
      </section>

      {/* 6. Automatic Call Protection Card */}
      <section className="gp-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Cybersecurity2D
              className="hidden sm:block w-14 h-14 shrink-0"
              title={
                lang === "hi"
                  ? "स्वचालित फ़ोन कॉल सुरक्षा कवच"
                  : "Automatic background incoming call protection illustration"
              }
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center shrink-0">
                  <PhoneIncoming className="w-4 h-4 text-[#E6C98A]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#F4F0E6]">
                    {lang === "hi" ? "स्वचालित कॉल सुरक्षा" : "Automatic Call Protection"}
                  </h2>
                  <p className="text-xs text-[#AEBBC9] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#43C6A5] shrink-0" />
                    <span>
                      {lang === "hi"
                        ? "केवल नंबर मेटाडेटा और प्रतिष्ठा जांच — माइक्रोफ़ोन या कॉल ऑडियो कभी रिकॉर्ड नहीं होता।"
                        : "Metadata & reputation checks only — zero microphone access, zero call recording."}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isParent ? (
              <button
                type="button"
                disabled={togglingCallProtect}
                onClick={toggleAutomaticCallProtection}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                  autoEnabled
                    ? "gm-gold-btn border-transparent"
                    : "bg-[#10243A] text-[#AEBBC9] border-[#C6A15B]/30 hover:border-[#E6C98A]"
                }`}
              >
                {lang === "hi"
                  ? `स्वचालित पहचान: ${autoEnabled ? "चालू (ON)" : "बंद (OFF)"}`
                  : `Automatic Detection: ${autoEnabled ? "ON" : "OFF"}`}
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#E6C98A]">
                {lang === "hi"
                  ? `स्वचालित पहचान: ${autoEnabled ? "चालू (ON)" : "बंद (OFF)"}`
                  : `Automatic Detection: ${autoEnabled ? "ON" : "OFF"}`}
              </span>
            )}

            <button
              type="button"
              onClick={() => onNavigate("calls_links")}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/85 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === "hi" ? "कॉल स्क्रीनिंग खोलें" : "Open Call Screening"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 pt-4 border-t border-[#C6A15B]/20">
          <div>
            <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "स्वचालित स्थिति" : "Detection Status"}</p>
            <p className={`mt-1 text-base font-bold ${autoEnabled ? "text-[#43C6A5]" : "text-[#E6C98A]"}`}>
              {autoEnabled ? (lang === "hi" ? "ON (सक्रिय)" : "ON") : lang === "hi" ? "OFF (रोका गया)" : "OFF"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#AEBBC9]">{lang === "hi" ? "जांची गई कॉल" : "Calls Screened"}</p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#F4F0E6]">{callsScreenedCount}</p>
          </div>

          <div>
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi" ? "संदिग्ध नंबर मिले" : "Suspicious Identified"}
            </p>
            <p
              className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                suspiciousCallCount > 0 ? "text-[#E87575]" : "text-[#F4F0E6]"
              }`}
            >
              {suspiciousCallCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi" ? "अंतिम स्क्रीनिंग गतिविधि" : "Last Screening Activity"}
            </p>
            <p className="mt-1 text-sm font-semibold font-mono tabular-nums text-[#E6C98A]">
              {lastScreeningAt
                ? new Date(lastScreeningAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : lang === "hi"
                  ? "अभी कोई नहीं"
                  : "No calls yet"}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#C6A15B]/20">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h3 className="text-xs font-semibold text-[#F4F0E6] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#E6C98A]" />
              {lang === "hi" ? "हाल ही में चिह्नित नंबर (मास्क्ड)" : "Recently Flagged Numbers (Masked)"}
            </h3>
            <span className="text-[11px] text-[#AEBBC9]">
              {lang === "hi" ? "मेटाडेटा व प्रतिष्ठा जांच" : "Metadata & reputation intelligence"}
            </span>
          </div>

          {recentlyFlaggedCalls.length === 0 ? (
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "अभी कोई संदिग्ध या चिह्नित इनकमिंग कॉल दर्ज नहीं हुई है।"
                : "No suspicious or flagged incoming numbers recorded yet."}
            </p>
          ) : (
            <div className="divide-y divide-[#C6A15B]/15">
              {recentlyFlaggedCalls.map((fc) => (
                <div key={fc.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-semibold text-[#F4F0E6]">{fc.caller_masked}</span>
                    <span
                      className={`font-semibold ${
                        fc.risk_classification === "HIGH RISK" ? "text-[#E87575]" : "text-[#E6C98A]"
                      }`}
                    >
                      {fc.risk_classification}
                    </span>
                    <span className="text-[#AEBBC9] truncate">{fc.call_status}</span>
                  </div>
                  <span className="font-mono tabular-nums text-[#C6A15B] shrink-0">
                    {new Date(fc.incoming_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 7. Progressive Disclosure for Detailed Logs, Risk History & Audit Trail */}
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setShowDetailedLogs((v) => !v)}
          aria-expanded={showDetailedLogs}
          className="gp-card rounded-2xl px-5 py-4 w-full flex items-center justify-between gap-3 text-left hover:border-[#E6C98A] transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#F4F0E6]">
              {lang === "hi"
                ? "विस्तृत इतिहास, सूचनाएं और ऑडिट लॉग"
                : "Detailed Risk History, Notifications & Audit Logs"}
            </h2>
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "तकनीकी इतिहास और परिवार सूचनाएं देखने के लिए क्लिक करें।"
                : "Inspect full risk scoring history, alerts, and tamper-evident audit records."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E6C98A] shrink-0">
            {showDetailedLogs
              ? lang === "hi"
                ? "कम दिखाएं"
                : "Hide Details"
              : lang === "hi"
                ? "और जानें"
                : "Know More"}
            {showDetailedLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showDetailedLogs && (
          <div className="space-y-6">
            <RiskHistoryPanel
              history={isParent ? state.riskHistory || [] : state.linkedRiskHistory || []}
              lang={lang}
              isParent={isParent}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 gp-card rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#E6C98A]" />
                    <h3 className="text-sm font-semibold text-[#F4F0E6]">
                      {lang === "hi" ? "परिवार सूचनाएं" : "Family Notifications"}
                    </h3>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {lang === "hi" ? "सभी पढ़ी हुई मानें" : "Mark all read"}
                    </button>
                  )}
                </div>

                {state.notifications.length === 0 ? (
                  <EmptyStateCard
                    compact
                    title={lang === "hi" ? "कोई नई सूचना नहीं" : "All Clear — No New Alerts"}
                    description={
                      lang === "hi"
                        ? "सुरक्षा अलर्ट, अभिभावक आमंत्रण और भुगतान अनुमोदन सूचनाएं यहां दिखेंगी।"
                        : "Safety alerts, guardian invites, and payment verification notices will appear here."
                    }
                  />
                ) : (
                  <div className="divide-y divide-[#C6A15B]/15">
                    {state.notifications.slice(0, 6).map((n) => (
                      <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className={`text-sm font-medium ${!n.read_at ? "text-[#F4F0E6]" : "text-[#AEBBC9]"}`}>
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#AEBBC9]">{n.body}</p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-[#C6A15B] shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 gp-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-[#F4F0E6] mb-4">
                  {lang === "hi" ? "सुरक्षित ऑडिट लॉग" : "Tamper-Evident Audit Trail"}
                </h3>
                {state.audit.length === 0 ? (
                  <EmptyStateCard
                    compact
                    title={lang === "hi" ? "ऑडिट लॉग प्रतीक्षा में" : "Audit Trail Ready"}
                    description={
                      lang === "hi"
                        ? "कार्रवाई होने पर छिपे हुए पहचानकर्ताओं के साथ ऑडिट लॉग बनते हैं।"
                        : "Tamper-evident events with redacted identifiers appear as actions occur."
                    }
                  />
                ) : (
                  <div className="divide-y divide-[#C6A15B]/15">
                    {state.audit.slice(0, 7).map((a, idx) => (
                      <div key={`${a.h}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                        <p className="text-xs text-[#AEBBC9] truncate">{a.ev}</p>
                        <span className="text-[11px] font-mono tabular-nums text-[#C6A15B] shrink-0">
                          {a.t} · {a.h.slice(0, 6)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
};
