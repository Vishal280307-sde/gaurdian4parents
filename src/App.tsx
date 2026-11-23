import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LogOut,
  AlertOctagon,
  X,
  ExternalLink,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  PhoneCall,
  CheckSquare,
  Sparkles,
  Menu,
  Smartphone,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  BookOpen,
  Search,
  Users,
  Cpu,
  Send,
  ArrowRight,
  Camera,
  Mic,
  Globe,
  Volume2,
  Square,
  Copy,
  Check,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { apiFetch, setMemoryAuthToken } from "./lib/api";
import { isTtsSupported, speakAlertText, stopSpeaking } from "./lib/tts";
import { getVoiceLanguageOption } from "./lib/voiceAssistant";
import { AuthGate } from "./components/AuthGate";
import { OverviewTab } from "./components/OverviewTab";
import { ScamQrTab } from "./components/ScamQrTab";
import { CyberCheckTab } from "./components/CyberCheckTab";
import { CallLinkTab } from "./components/CallLinkTab";
import { ApprovalsPrivacyTab } from "./components/ApprovalsPrivacyTab";
import { ParentsAiTab } from "./components/ParentsAiTab";
import { AwarenessCentreTab } from "./components/AwarenessCentreTab";
import { EmergencyCallProvider } from "./context/EmergencyCallContext";
import { EmergencyBankCallModal, EmergencyCallButton } from "./components/EmergencyBankCallModal";
import { GuardianVoiceModal } from "./components/GuardianVoiceModal";
import { LanguageSelectorModal } from "./components/LanguageSelectorModal";
import { AiProviderSwitcher, GeminiSparkleIcon } from "./components/GeminiBadgeIcon";
import { SafeMarkdownText } from "./components/SafeMarkdownText";
import { EmergencyAssistance2D, GuardianAi2D } from "./components/Illustrations2D";
import { SCAM_AWARENESS_CARDS, type ScamAwarenessId } from "./data/awarenessContent";
import type {
  AiProviderId,
  AppStatePayload,
  AuthUser,
  EmergencyCallContext,
  FontSizeScale,
  GuardianIntelContext,
  LangCode,
  TabKey,
  UnifiedChatMessage,
  VoiceLangCode,
  VoiceNavTarget,
} from "./types/guardian";

const GOLD_HERO_BG = "/src/assets/images/gold_security_hero_1795443534804.jpg";
const GOLD_AI_ORB = "/src/assets/images/gold_ai_orb_1795443535808.jpg";

interface SearchShortcut {
  id: string;
  label: string;
  sublabel: string;
  keywords: string;
  action: () => void;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AppStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [lang, setLang] = useState<LangCode>("en");
  const [voiceLang, setVoiceLang] = useState<VoiceLangCode>(() => {
    try {
      const saved = localStorage.getItem("guardian_voice_lang") as VoiceLangCode | null;
      if (saved && ["en", "hi", "hinglish", "bn", "mr", "te", "bgc", "bho"].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore storage error
    }
    return "en";
  });
  const [aiProvider, setAiProvider] = useState<AiProviderId>(() => {
    try {
      const saved = localStorage.getItem("guardian_ai_provider");
      if (saved === "gemini" || saved === "guardian") return saved;
    } catch {
      // ignore storage error
    }
    return "gemini";
  });
  const [fontScale, setFontScale] = useState<FontSizeScale>(() => {
    try {
      const saved = localStorage.getItem("guardian_font_scale");
      if (saved === "sm" || saved === "base" || saved === "lg" || saved === "xl") return saved;
    } catch {
      // ignore storage error
    }
    return "base";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyBankOpen, setEmergencyBankOpen] = useState(false);
  const [emergencyBankCtx, setEmergencyBankCtx] = useState<EmergencyCallContext | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarLogoutConfirm, setSidebarLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openLiveScannerInitially, setOpenLiveScannerInitially] = useState(false);
  const [focusedAwarenessCard, setFocusedAwarenessCard] = useState<ScamAwarenessId | null>(null);

  // Voice & Language modals
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Top bar global search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  // Floating AI assistant unified conversation + intelligence context
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiQuickInput, setAiQuickInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<UnifiedChatMessage[]>([]);
  const [aiQuickError, setAiQuickError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [aiQuickBusy, setAiQuickBusy] = useState(false);
  const [aiChatSpeakingId, setAiChatSpeakingId] = useState<string | null>(null);
  const [aiCopiedMsgId, setAiCopiedMsgId] = useState<string | null>(null);
  const [intelContext, setIntelContext] = useState<GuardianIntelContext | null>(null);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const openEmergencyBankCall = useCallback((ctx?: EmergencyCallContext) => {
    setEmergencyBankCtx(ctx || { source: "dashboard" });
    setEmergencyOpen(false);
    setNotificationsOpen(false);
    setAiDrawerOpen(false);
    setVoiceModalOpen(false);
    setEmergencyBankOpen(true);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const data = await apiFetch<AppStatePayload>("/api/state");
      setUser(data.user);
      setState(data);
    } catch {
      setUser(null);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    try {
      localStorage.setItem("guardian_ai_provider", aiProvider);
    } catch {
      // ignore storage error
    }
  }, [aiProvider]);

  useEffect(() => {
    try {
      localStorage.setItem("guardian_voice_lang", voiceLang);
    } catch {
      // ignore storage error
    }
  }, [voiceLang]);

  useEffect(() => {
    const handlePopState = () => {
      if (!user) {
        setState(null);
        setTab("overview");
        setEmergencyOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    if (notificationsOpen || searchFocused) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [notificationsOpen, searchFocused]);

  useEffect(() => {
    const map: Record<FontSizeScale, string> = {
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
    };
    document.documentElement.style.fontSize = map[fontScale];
    try {
      localStorage.setItem("guardian_font_scale", fontScale);
    } catch {
      // ignore storage failure
    }
  }, [fontScale]);

  function stepFontScale(direction: -1 | 0 | 1) {
    const order: FontSizeScale[] = ["sm", "base", "lg", "xl"];
    if (direction === 0) {
      setFontScale("base");
      return;
    }
    const idx = order.indexOf(fontScale);
    const nextIdx = Math.min(order.length - 1, Math.max(0, idx + direction));
    setFontScale(order[nextIdx]);
  }

  const navigateTab = useCallback((nextTab: TabKey) => {
    stopSpeaking();
    setTab(nextTab);
    setMobileNavOpen(false);
    setSearchFocused(false);
  }, []);

  const openAwarenessTopic = useCallback(
    (cardId?: ScamAwarenessId) => {
      setFocusedAwarenessCard(cardId ?? null);
      navigateTab("awareness");
    },
    [navigateTab]
  );

  const openLiveQrScanner = useCallback(() => {
    setOpenLiveScannerInitially(true);
    navigateTab("scam_qr");
  }, [navigateTab]);

  const handleVoiceNavigationTarget = useCallback(
    (target: Exclude<VoiceNavTarget, null>) => {
      if (target === "emergency_call") {
        openEmergencyBankCall({
          source: "dashboard",
          reason: lang === "hi" ? "वॉइस सहायक आपातकालीन बैंक कॉल" : "Emergency bank call requested via Voice Assistant",
        });
        return;
      }
      if (target === "live_qr") {
        setOpenLiveScannerInitially(true);
        setTab("scam_qr");
        return;
      }
      setTab(target);
    },
    [lang, openEmergencyBankCall]
  );

  const handleSelectVoiceLang = useCallback((code: VoiceLangCode) => {
    setVoiceLang(code);
    if (code === "hi") setLang("hi");
    else if (code === "en") setLang("en");
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network failures and still clear client session
    }
    setMemoryAuthToken(null);
    setUser(null);
    setState(null);
    setTab("overview");
    setEmergencyOpen(false);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setSidebarLogoutConfirm(false);
    setAiDrawerOpen(false);
    setVoiceModalOpen(false);
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // ignore history errors
    }
  }

  useEffect(() => {
    if (aiDrawerOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiDrawerOpen, aiChatMessages.length, aiQuickBusy]);

  const appendUnifiedExchange = useCallback(
    (userMsg: UnifiedChatMessage, aiMsg: UnifiedChatMessage) => {
      setAiChatMessages((prev) => [...prev, userMsg, aiMsg]);
    },
    []
  );

  const handleIntelContextChange = useCallback((ctx: GuardianIntelContext) => {
    setIntelContext(ctx);
  }, []);

  async function markAllNotificationsRead() {
    await apiFetch("/api/notifications/read", { method: "POST" });
    await refreshState();
  }

  async function revokeAllGuardiansEmergency() {
    await apiFetch("/api/links/revoke-all", { method: "POST" });
    await refreshState();
  }

  async function sendChatMessage(promptText: string, providerOverride?: AiProviderId) {
    const prompt = promptText.trim();
    if (!prompt || aiQuickBusy) return;

    const chosenProvider = providerOverride || aiProvider;
    setAiQuickBusy(true);
    setAiQuickError(null);
    setLastFailedPrompt(null);

    const historyForApi = aiChatMessages
      .filter((m) => !m.isError)
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));

    const userMsg: UnifiedChatMessage = {
      id: `c-u-${Date.now()}`,
      role: "user",
      text: prompt,
      timestamp: Date.now(),
    };
    setAiChatMessages((prev) => [...prev, userMsg]);
    setAiQuickInput("");

    const activeContextPayload: GuardianIntelContext = intelContext || {
      activeSection: activeNavLabelForContext(tab),
      contextType: "general",
      summary: `User is currently viewing ${activeNavLabelForContext(tab)} in Guardian for Parents.`,
    };

    try {
      const res = await apiFetch<{ text: string; providerUsed?: AiProviderId }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: prompt,
          history: historyForApi,
          lang,
          voiceLang,
          provider: chosenProvider,
          guardianContext: activeContextPayload,
        }),
      });
      const replyText = (res.text || "").trim();
      if (!replyText) {
        throw new Error(
          lang === "hi"
            ? "AI से कोई उत्तर प्राप्त नहीं हुआ। कृपया पुनः प्रयास करें।"
            : "No response text was returned. Please retry your question."
        );
      }
      const aiMsg: UnifiedChatMessage = {
        id: `c-a-${Date.now() + 1}`,
        role: "assistant",
        text: replyText,
        providerUsed: res.providerUsed || chosenProvider,
        timestamp: Date.now(),
      };
      setAiChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : lang === "hi"
            ? "AI सलाहकार अभी उपलब्ध नहीं है।"
            : "Parents AI advisor is temporarily unavailable.";
      setAiQuickError(msg);
      setLastFailedPrompt(prompt);
    } finally {
      setAiQuickBusy(false);
    }
  }

  function activeNavLabelForContext(currentTab: TabKey): string {
    switch (currentTab) {
      case "scam_qr":
        return "QR & Scam Check";
      case "cyber_check":
        return "Personal Cyber Safety Check";
      case "calls_links":
        return "Phone Fraud & Link Inspector";
      case "awareness":
        return "Cyber Awareness Centre";
      case "approvals":
        return "Approvals & Bank Settings";
      case "parents_ai":
        return "Parents AI Hub";
      default:
        return "Guardian Dashboard Overview";
    }
  }

  function handleQuickAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendChatMessage(aiQuickInput);
  }

  function toggleChatMessageSpeech(msg: UnifiedChatMessage) {
    if (!isTtsSupported()) return;
    if (aiChatSpeakingId === msg.id) {
      stopSpeaking();
      setAiChatSpeakingId(null);
      return;
    }
    speakAlertText(msg.spokenText || msg.text, voiceLang, {
      onStart: () => setAiChatSpeakingId(msg.id),
      onEnd: () => setAiChatSpeakingId(null),
      onError: () => setAiChatSpeakingId(null),
    });
  }

  async function copyChatMessage(msg: UnifiedChatMessage) {
    try {
      await navigator.clipboard.writeText(msg.text);
      setAiCopiedMsgId(msg.id);
      setTimeout(() => setAiCopiedMsgId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  const navItems: { key: TabKey; label: string; shortLabel: string; Icon: typeof LayoutDashboard }[] = [
    {
      key: "overview",
      label: lang === "hi" ? "डैशबोर्ड" : "Overview",
      shortLabel: lang === "hi" ? "होम" : "Home",
      Icon: LayoutDashboard,
    },
    {
      key: "scam_qr",
      label: lang === "hi" ? "QR व संदेश जांच" : "QR & Scam Check",
      shortLabel: lang === "hi" ? "QR जांच" : "QR Scan",
      Icon: QrCode,
    },
    {
      key: "cyber_check",
      label: lang === "hi" ? "साइबर सुरक्षा जांच" : "Cyber Safety Check",
      shortLabel: lang === "hi" ? "साइबर" : "Cyber",
      Icon: ShieldCheck,
    },
    {
      key: "calls_links",
      label: lang === "hi" ? "फोन धोखाधड़ी व लिंक" : "Phone Fraud & Links",
      shortLabel: lang === "hi" ? "कॉल" : "Calls",
      Icon: PhoneCall,
    },
    {
      key: "awareness",
      label: lang === "hi" ? "साइबर जागरूकता केंद्र" : "Cyber Awareness",
      shortLabel: lang === "hi" ? "जागरूकता" : "Learn",
      Icon: BookOpen,
    },
    {
      key: "approvals",
      label: lang === "hi" ? "अनुमोदन व सेटिंग्स" : "Approvals & Settings",
      shortLabel: lang === "hi" ? "सेटिंग्स" : "Settings",
      Icon: CheckSquare,
    },
    {
      key: "parents_ai",
      label: lang === "hi" ? "पेरेंट्स AI" : "Parents AI",
      shortLabel: "AI",
      Icon: Sparkles,
    },
  ];

  const searchShortcuts: SearchShortcut[] = useMemo(() => {
    const base: SearchShortcut[] = [
      {
        id: "tool-live-qr",
        label: lang === "hi" ? "लाइव कैमरा QR स्कैनर" : "Live Camera QR Scanner",
        sublabel: lang === "hi" ? "UPI या लिंक QR स्कैन करें" : "Inspect UPI or link QR codes live",
        keywords: "qr camera scan upi payment code live",
        action: () => {
          setSearchQuery("");
          openLiveQrScanner();
        },
      },
      {
        id: "tool-voice-ai",
        label: lang === "hi" ? "गार्जियन वॉइस सहायक" : "Guardian Voice Assistant",
        sublabel: lang === "hi" ? "7 भाषाओं में बोलकर पूछें व नेविगेट करें" : "Speak in 7 Indian languages & navigate",
        keywords: "voice mic microphone speak language hindi bengali marathi telugu haryanvi bhojpuri",
        action: () => {
          setSearchQuery("");
          setSearchFocused(false);
          setVoiceModalOpen(true);
        },
      },
      {
        id: "tool-cyber-check",
        label: lang === "hi" ? "व्यक्तिगत साइबर सुरक्षा जांच" : "Personal Cyber Safety Check",
        sublabel: lang === "hi" ? "फ़ोन, ईमेल, UPI ID, बैंक खाता या लिंक जांचें" : "Verify phone, email, UPI ID, bank account or URL",
        keywords: "phone number email upi url website bank cyber check verify",
        action: () => {
          setSearchQuery("");
          navigateTab("cyber_check");
        },
      },
      {
        id: "tool-call-guard",
        label: lang === "hi" ? "फ़ोन धोखाधड़ी और कॉल सुरक्षा" : "Phone Fraud & Call Protection",
        sublabel: lang === "hi" ? "इनकमिंग कॉल स्क्रीनिंग व संदिग्ध लिंक" : "Incoming call screening & link inspection",
        keywords: "call phone fraud incoming spam device protection",
        action: () => {
          setSearchQuery("");
          navigateTab("calls_links");
        },
      },
      {
        id: "tool-family-hub",
        label: lang === "hi" ? "परिवार अभिभावक, बैंक व भुगतान लॉक" : "Family Hub, Banks & Payment Guard",
        sublabel: lang === "hi" ? "अभिभावक जोड़ें, बैंक चुनें और सहमति प्रबंधित करें" : "Manage guardians, primary bank & payment lock",
        keywords: "family guardian parent invite bank settings consent profile",
        action: () => {
          setSearchQuery("");
          navigateTab("approvals");
        },
      },
      {
        id: "tool-emergency-sos",
        label: lang === "hi" ? "आपातकालीन बैंक कॉल (SOS)" : "Emergency Call My Bank (SOS)",
        sublabel: lang === "hi" ? "सत्यापित बैंक हेल्पलाइन व 1930" : "Verified bank helpline & 1930 cybercrime",
        keywords: "emergency sos bank helpline 1930 lost stolen fraud",
        action: () => {
          setSearchQuery("");
          setSearchFocused(false);
          openEmergencyBankCall({
            source: "dashboard",
            reason: lang === "hi" ? "आपातकालीन बैंक सहायता" : "Emergency bank assistance",
          });
        },
      },
      {
        id: "tool-parents-ai",
        label: lang === "hi" ? "पेरेंट्स AI सलाहकार" : "Parents AI Advisor",
        sublabel: lang === "hi" ? "व्यक्तिगत परिवार वित्तीय व सुरक्षा मार्गदर्शन" : "Ask questions about scams, bills & safety",
        keywords: "ai assistant advisor chat help financial gemini",
        action: () => {
          setSearchQuery("");
          navigateTab("parents_ai");
        },
      },
    ];

    const topicShortcuts: SearchShortcut[] = SCAM_AWARENESS_CARDS.map((t) => ({
      id: `topic-${t.id}`,
      label: lang === "hi" ? t.titleHi : t.title,
      sublabel: lang === "hi" ? "साइबर जागरूकता मार्गदर्शिका" : "Cyber Awareness Guide",
      keywords: `${t.title} ${t.titleHi} ${t.shortDesc} scam guide learn`,
      action: () => {
        setSearchQuery("");
        openAwarenessTopic(t.id);
      },
    }));

    return [...base, ...topicShortcuts];
  }, [lang, navigateTab, openAwarenessTopic, openEmergencyBankCall, openLiveQrScanner]);

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchShortcuts.slice(0, 6);
    return searchShortcuts
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.sublabel.toLowerCase().includes(q) ||
          item.keywords.toLowerCase().includes(q)
      )
      .slice(0, 7);
  }, [searchQuery, searchShortcuts]);

  const activeNav = navItems.find((n) => n.key === tab) || navItems[0];
  const unreadNotifs = (state?.notifications || []).filter((n) => !n.read_at);
  const primarySavedBank =
    state?.userBanks?.find((b) => b.isPrimary) || state?.userBanks?.[0] || null;
  const activeVoiceLangObj = getVoiceLanguageOption(voiceLang);

  const renderSidebar = (isMobileDrawer: boolean) => {
    const compact = !isMobileDrawer && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full justify-between bg-[#071525]/92 backdrop-blur-xl text-[#F4F0E6] border-r border-[#C6A15B]/25 shadow-[4px_0_32px_rgba(3,8,18,0.65)]">
        <div>
          <div
            className={`h-16 flex items-center border-b border-[#C6A15B]/22 ${
              compact ? "justify-center px-3" : "justify-between px-4"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setTab("overview");
                setMobileNavOpen(false);
              }}
              className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
              title="Guardian AI — Guardian for Parents"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E6C98A]/25 to-[#10243A] border border-[#C6A15B]/60 shadow-[0_0_16px_rgba(198,161,91,0.28)] flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-[#E6C98A]" />
              </div>
              {!compact && (
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold tracking-tight text-[#F4F0E6] truncate">
                    Guardian AI
                  </span>
                  <span className="block text-[10px] font-medium text-[#E6C98A] truncate">
                    Guardian for Parents
                  </span>
                </div>
              )}
            </button>

            {isMobileDrawer ? (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={lang === "hi" ? "मेनू बंद करें" : "Close navigation menu"}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#AEBBC9] hover:text-[#F4F0E6] hover:bg-[#10243A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
                title={compact ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-[#AEBBC9] hover:text-[#F4F0E6] hover:bg-[#10243A] transition-colors cursor-pointer shrink-0"
              >
                {compact ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            )}
          </div>

          <nav aria-label="Main navigation" className="px-3 py-5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.Icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  title={compact ? item.label : undefined}
                  onClick={() => navigateTab(item.key)}
                  className={`w-full min-h-[44px] flex items-center ${
                    compact ? "justify-center px-2" : "gap-3 px-3.5"
                  } py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                    active
                      ? "bg-gradient-to-r from-[#2B2112]/90 via-[#10243A] to-[#252A32]/90 text-[#F4F0E6] border border-[#E6C98A]/65 shadow-[0_0_20px_-6px_rgba(230,201,138,0.4)]"
                      : "text-[#AEBBC9] hover:bg-[#10243A]/80 hover:text-[#F4F0E6] border border-transparent hover:border-[#C6A15B]/30"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? "text-[#E6C98A]" : "text-[#AEBBC9]"
                    }`}
                  />
                  {!compact && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {user && (
          <div className="p-3 border-t border-[#C6A15B]/22 space-y-2.5">
            {!compact && (
              <button
                type="button"
                onClick={() => navigateTab("approvals")}
                className="w-full px-2.5 py-2 rounded-xl bg-[#10243A]/75 hover:bg-[#252A32]/85 border border-[#C6A15B]/25 text-left transition-colors cursor-pointer flex items-center gap-2.5"
              >
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-lg object-cover border border-[#C6A15B]/55 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center text-xs font-bold text-[#E6C98A] shrink-0">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F4F0E6] truncate">{user.name}</p>
                  <p className="text-xs text-[#AEBBC9] truncate">
                    @{user.username} ·{" "}
                    {user.role === "parent"
                      ? lang === "hi"
                        ? "माता-पिता"
                        : "Parent"
                      : lang === "hi"
                        ? "अभिभावक"
                        : "Guardian"}
                  </p>
                </div>
              </button>
            )}
            <button
              type="button"
              title={compact ? (lang === "hi" ? "लॉग आउट" : "Log Out") : undefined}
              onClick={() => setSidebarLogoutConfirm(true)}
              className={`w-full min-h-[42px] inline-flex items-center justify-center ${
                compact ? "px-2" : "gap-2 px-3"
              } py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 hover:border-[#E6C98A]/65 text-xs font-medium text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]`}
            >
              <LogOut className="w-4 h-4 text-[#C6A15B] shrink-0" />
              {!compact && <span>{lang === "hi" ? "लॉग आउट" : "Log Out"}</span>}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <EmergencyCallProvider onOpen={openEmergencyBankCall}>
        <div className="relative min-h-screen flex bg-[#071525] text-[#F4F0E6] overflow-x-hidden">
          {/* Architectural Golden Matte Backdrop */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <img
              src={GOLD_HERO_BG}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-bottom opacity-22 mix-blend-lighten"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#071525]/88 via-[#0B1C30]/78 to-[#10243A]/94" />
            <div className="absolute -top-32 left-1/4 w-[520px] h-[320px] rounded-full bg-[#C6A15B]/10 blur-[115px]" />
            <div className="absolute top-1/3 right-[-120px] w-[420px] h-[420px] rounded-full bg-[#E6C98A]/8 blur-[125px]" />
          </div>

          {/* Desktop Collapsible Midnight Navy Sidebar */}
          {user && state && (
            <aside
              className={`relative z-20 hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${
                sidebarCollapsed ? "w-20" : "w-64"
              }`}
            >
              {renderSidebar(false)}
            </aside>
          )}

          {/* Mobile Drawer Sidebar */}
          {user && state && mobileNavOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div className="w-72 max-w-[85vw] h-full">{renderSidebar(true)}</div>
              <div
                className="flex-1 bg-[#071525]/80 backdrop-blur-xs"
                onClick={() => setMobileNavOpen(false)}
                aria-hidden="true"
              />
            </div>
          )}

          <div className="relative z-10 flex-1 min-w-0 flex flex-col">
            {/* Golden Matte Top Navigation Bar */}
            <header className="sticky top-0 z-30 border-b border-[#C6A15B]/25 bg-[#071525]/85 backdrop-blur-xl">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user && (
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen(true)}
                      aria-label={lang === "hi" ? "नेविगेशन खोलें" : "Open navigation menu"}
                      className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/85 text-[#F4F0E6] cursor-pointer"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                  )}

                  {!user ? (
                    <button
                      type="button"
                      onClick={() => setTab("overview")}
                      className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E6C98A]/25 to-[#10243A] border border-[#C6A15B]/60 flex items-center justify-center shadow-[0_0_16px_rgba(198,161,91,0.3)]">
                        <Shield className="w-4 h-4 text-[#E6C98A]" />
                      </div>
                      <div className="text-left">
                        <span className="block font-display text-base font-bold tracking-tight text-[#F4F0E6]">
                          Guardian AI
                        </span>
                        <span className="hidden sm:block text-[11px] text-[#AEBBC9]">
                          {lang === "hi" ? "परिवार डिजिटल सुरक्षा कवच" : "Guardian for Parents"}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="font-display text-sm sm:text-base font-bold tracking-tight text-[#F4F0E6] truncate">
                          {activeNav.label}
                        </p>
                        <p className="hidden md:block text-[11px] text-[#AEBBC9] truncate">
                          {lang === "hi" ? `नमस्ते, ${user.name}` : "Guardian for Parents"} ·{" "}
                          {user.role === "parent"
                            ? lang === "hi"
                              ? "माता-पिता कार्यक्षेत्र"
                              : "Parent Shield"
                            : lang === "hi"
                              ? "अभिभावक कंसोल"
                              : "Guardian Console"}
                        </p>
                      </div>

                      {/* Top Quick Navigation Shortcuts: Family & Devices */}
                      <div className="hidden xl:flex items-center gap-1 ml-2 pl-3 border-l border-[#C6A15B]/25">
                        <button
                          type="button"
                          onClick={() => navigateTab("approvals")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            tab === "approvals"
                              ? "bg-[#252A32] text-[#E6C98A] border border-[#C6A15B]/55"
                              : "text-[#AEBBC9] hover:text-[#F4F0E6] hover:bg-[#10243A]"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{lang === "hi" ? "परिवार" : "Family"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateTab("calls_links")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            tab === "calls_links"
                              ? "bg-[#252A32] text-[#E6C98A] border border-[#C6A15B]/55"
                              : "text-[#AEBBC9] hover:text-[#F4F0E6] hover:bg-[#10243A]"
                          }`}
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          <span>{lang === "hi" ? "डिवाइस व कॉल" : "Devices"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Working Global Quick-Jump Search Bar */}
                {user && state && (
                  <div ref={searchRef} className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#AEBBC9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onFocus={() => setSearchFocused(true)}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSearchFocused(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && filteredSearch[0]) {
                            e.preventDefault();
                            filteredSearch[0].action();
                          } else if (e.key === "Escape") {
                            setSearchFocused(false);
                          }
                        }}
                        aria-label={lang === "hi" ? "सुरक्षा उपकरण और गाइड खोजें" : "Search safety tools and scam guides"}
                        placeholder={
                          lang === "hi"
                            ? "QR, कॉल, बैंक या वॉइस खोजें..."
                            : "Search QR, call guard, bank, voice..."
                        }
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/75 backdrop-blur-md text-xs text-[#F4F0E6] placeholder:text-[#AEBBC9] focus:outline-none focus:border-[#E6C98A] transition-colors"
                      />
                    </div>

                    {searchFocused && (
                      <div className="absolute left-0 right-0 mt-2 gp-card rounded-2xl p-2 z-50 space-y-1 max-h-80 overflow-y-auto">
                        {filteredSearch.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[#AEBBC9]">
                            {lang === "hi"
                              ? "कोई मिलता-जुलता उपकरण नहीं मिला।"
                              : "No matching safety tool or guide found."}
                          </p>
                        ) : (
                          filteredSearch.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={item.action}
                              className="w-full px-3 py-2 rounded-xl hover:bg-[#252A32] text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#F4F0E6] truncate">{item.label}</p>
                                <p className="text-[11px] text-[#AEBBC9] truncate">{item.sublabel}</p>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-[#E6C98A] shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Right Utility Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Accessibility Font Size Control */}
                  <div
                    role="group"
                    aria-label={lang === "hi" ? "फ़ॉन्ट आकार नियंत्रण" : "Font size accessibility controls"}
                    className="hidden sm:inline-flex items-center rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 overflow-hidden shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => stepFontScale(-1)}
                      disabled={fontScale === "sm"}
                      aria-label={lang === "hi" ? "फ़ॉन्ट छोटा करें" : "Decrease font size"}
                      title={lang === "hi" ? "छोटा फ़ॉन्ट" : "Decrease font size"}
                      className="min-h-[38px] px-2 text-xs font-bold text-[#F4F0E6] hover:bg-[#252A32] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      A−
                    </button>
                    <button
                      type="button"
                      onClick={() => stepFontScale(0)}
                      aria-label={lang === "hi" ? "सामान्य फ़ॉन्ट आकार" : "Reset to default font size"}
                      title={lang === "hi" ? "डिफ़ॉल्ट फ़ॉन्ट" : "Default font size"}
                      className={`min-h-[38px] px-2 text-xs font-bold border-x border-[#C6A15B]/25 transition-colors cursor-pointer ${
                        fontScale === "base" ? "text-[#E6C98A]" : "text-[#F4F0E6]"
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => stepFontScale(1)}
                      disabled={fontScale === "xl"}
                      aria-label={lang === "hi" ? "फ़ॉन्ट बड़ा करें" : "Increase font size"}
                      title={lang === "hi" ? "बड़ा फ़ॉन्ट" : "Increase font size"}
                      className={`min-h-[38px] px-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                        fontScale === "lg" || fontScale === "xl"
                          ? "text-[#E6C98A]"
                          : "text-[#F4F0E6] hover:bg-[#252A32]"
                      }`}
                    >
                      A+
                    </button>
                  </div>

                  {/* 7-Language Voice & AI Selector Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => setLangModalOpen(true)}
                    aria-label={lang === "hi" ? "7 भाषाओं में से चुनें" : "Choose AI and voice language"}
                    title={`${activeVoiceLangObj.nativeName} (${activeVoiceLangObj.englishName})`}
                    className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/85 text-xs font-semibold text-[#E6C98A] hover:border-[#E6C98A] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#C6A15B] shrink-0" />
                    <span>{activeVoiceLangObj.scriptBadge}</span>
                  </button>

                  {/* UI EN / HI quick toggle */}
                  <button
                    type="button"
                    onClick={() => setLang(lang === "en" ? "hi" : "en")}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 text-xs font-medium text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {lang === "en" ? "EN / हिं" : "हिं / EN"}
                  </button>

                  {/* Authenticated Notifications, Profile Avatar & Settings */}
                  {user && state && (
                    <>
                      <div className="relative" ref={notifRef}>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen((v) => !v)}
                          aria-label={lang === "hi" ? "सूचनाएं" : "Notifications"}
                          className="relative min-w-[40px] min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 hover:border-[#E6C98A] flex items-center justify-center text-[#F4F0E6] transition-colors cursor-pointer"
                        >
                          <Bell className="w-4 h-4 text-[#E6C98A]" />
                          {unreadNotifs.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E87575] text-[#071525] text-[10px] font-mono tabular-nums font-bold flex items-center justify-center shadow-[0_0_10px_rgba(232,117,117,0.55)]">
                              {unreadNotifs.length > 9 ? "9+" : unreadNotifs.length}
                            </span>
                          )}
                        </button>

                        {notificationsOpen && (
                          <div
                            role="region"
                            aria-label={lang === "hi" ? "परिवार सूचनाएं" : "Notifications panel"}
                            className="absolute right-0 mt-2 w-80 max-w-[90vw] gp-card rounded-2xl p-4 z-50 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#C6A15B]/25">
                              <span className="text-xs font-semibold text-[#F4F0E6]">
                                {lang === "hi" ? "सूचनाएं" : "Notifications"} ({state.notifications.length})
                              </span>
                              {unreadNotifs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={markAllNotificationsRead}
                                  className="text-xs font-medium text-[#E6C98A] hover:underline cursor-pointer"
                                >
                                  {lang === "hi" ? "सभी पढ़ी हुई मानें" : "Mark all read"}
                                </button>
                              )}
                            </div>

                            {state.notifications.length === 0 ? (
                              <p className="text-xs text-[#AEBBC9] py-2">
                                {lang === "hi" ? "कोई नई सूचना नहीं है।" : "No new alerts right now."}
                              </p>
                            ) : (
                              <div className="divide-y divide-[#C6A15B]/15 max-h-64 overflow-y-auto">
                                {state.notifications.slice(0, 5).map((n) => (
                                  <div key={n.id} className="py-2.5 space-y-0.5 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <p
                                        className={`font-medium truncate ${
                                          !n.read_at ? "text-[#F4F0E6]" : "text-[#AEBBC9]"
                                        }`}
                                      >
                                        {n.title}
                                      </p>
                                      <span className="font-mono tabular-nums text-[11px] text-[#C6A15B] shrink-0">
                                        {new Date(n.created_at).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-[#AEBBC9] line-clamp-2">{n.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setNotificationsOpen(false);
                                setTab("overview");
                              }}
                              className="w-full py-2 rounded-xl bg-[#252A32] hover:bg-[#10243A] border border-[#C6A15B]/30 text-xs font-semibold text-[#F4F0E6] transition-colors cursor-pointer"
                            >
                              {lang === "hi" ? "डैशबोर्ड पर देखें" : "View All on Dashboard"}
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateTab("approvals")}
                        aria-label={lang === "hi" ? "प्रोफ़ाइल और सेटिंग्स" : "Profile and settings"}
                        title={user.name}
                        className="hidden sm:flex items-center gap-2 min-h-[40px] px-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 hover:border-[#E6C98A] transition-colors cursor-pointer"
                      >
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-[#252A32] flex items-center justify-center text-xs font-bold text-[#E6C98A]">
                            {user.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <Settings className="w-3.5 h-3.5 text-[#AEBBC9] mr-1" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setEmergencyOpen(true)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl gm-emergency-btn text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
                  >
                    {lang === "hi" ? "आपातकाल" : "Emergency SOS"}
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 ${user ? "pb-24 lg:pb-12" : ""}`}>
              {loading ? (
                <div aria-label="Loading workspace" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-8 h-56 rounded-3xl border border-[#C6A15B]/25 gm-skeleton" />
                    <div className="lg:col-span-4 h-56 rounded-3xl border border-[#C6A15B]/25 gm-skeleton" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="h-28 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                    <div className="h-28 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                    <div className="h-28 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                    <div className="h-28 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-32 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                    <div className="h-32 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                    <div className="h-32 rounded-2xl border border-[#C6A15B]/20 gm-skeleton" />
                  </div>
                </div>
              ) : !user || !state ? (
                <AuthGate
                  lang={lang}
                  onAuthenticated={async (u) => {
                    setUser(u);
                    await refreshState();
                  }}
                />
              ) : tab === "overview" ? (
                <OverviewTab
                  state={state}
                  lang={lang}
                  onNavigate={navigateTab}
                  onRefresh={refreshState}
                  onOpenLiveQr={openLiveQrScanner}
                  onOpenAwareness={openAwarenessTopic}
                />
              ) : tab === "scam_qr" ? (
                <ScamQrTab
                  state={state}
                  lang={lang}
                  voiceLang={voiceLang}
                  aiProvider={aiProvider}
                  onChangeProvider={setAiProvider}
                  onRefresh={refreshState}
                  openLiveScannerInitially={openLiveScannerInitially}
                  onLiveScannerHandled={() => setOpenLiveScannerInitially(false)}
                  onOpenAwareness={openAwarenessTopic}
                  onIntelContextChange={handleIntelContextChange}
                />
              ) : tab === "cyber_check" ? (
                <CyberCheckTab
                  lang={lang}
                  voiceLang={voiceLang}
                  aiProvider={aiProvider}
                  onChangeProvider={setAiProvider}
                  isAuthenticated={true}
                  onRefresh={refreshState}
                  onOpenAwareness={openAwarenessTopic}
                  onIntelContextChange={handleIntelContextChange}
                />
              ) : tab === "calls_links" ? (
                <CallLinkTab
                  state={state}
                  lang={lang}
                  voiceLang={voiceLang}
                  aiProvider={aiProvider}
                  onRefresh={refreshState}
                  onOpenAwareness={openAwarenessTopic}
                  onIntelContextChange={handleIntelContextChange}
                />
              ) : tab === "awareness" ? (
                <AwarenessCentreTab
                  lang={lang}
                  voiceLang={voiceLang}
                  focusedCardId={focusedAwarenessCard}
                  onClearFocus={() => setFocusedAwarenessCard(null)}
                />
              ) : tab === "approvals" ? (
                <ApprovalsPrivacyTab
                  state={state}
                  lang={lang}
                  onRefresh={refreshState}
                  onLogout={handleLogout}
                  onSignedOut={() => {
                    setMemoryAuthToken(null);
                    setUser(null);
                    setState(null);
                    setTab("overview");
                    try {
                      window.history.replaceState(null, "", window.location.pathname);
                    } catch {
                      // ignore
                    }
                  }}
                />
              ) : (
                <ParentsAiTab
                  state={state}
                  lang={lang}
                  voiceLang={voiceLang}
                  aiProvider={aiProvider}
                  onChangeProvider={setAiProvider}
                  onOpenVoiceAssistant={() => setVoiceModalOpen(true)}
                  onOpenLanguageModal={() => setLangModalOpen(true)}
                />
              )}
            </main>

            {/* Quiet Glass Footer */}
            <footer
              className={`border-t border-[#C6A15B]/20 bg-[#071525]/85 backdrop-blur-md py-5 px-6 text-xs text-[#AEBBC9] ${
                user ? "pb-24 lg:pb-5" : ""
              }`}
            >
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                <span>
                  {lang === "hi"
                    ? "Guardian AI · पारदर्शी सुरक्षा नियम, शून्य कॉल-ऑडियो रिकॉर्डिंग, सहमति-प्रथम देखरेख।"
                    : "Guardian AI · Transparent verification status, zero call-audio recording, consent-first oversight."}
                </span>
                <span className="font-mono tabular-nums text-[#E6C98A] font-medium">
                  {lang === "hi"
                    ? "राष्ट्रीय साइबर अपराध हेल्पलाइन (भारत): 1930"
                    : "National Cyber Crime Helpline (India): 1930"}
                </span>
              </div>
            </footer>
          </div>

          {/* Floating Bottom-Right Voice Mic + Parents AI Launcher */}
          {user && state && (
            <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 flex flex-col items-end gap-3">
              {aiDrawerOpen && (
                <div
                  role="dialog"
                  aria-label={lang === "hi" ? "त्वरित पेरेंट्स AI सलाहकार" : "Quick Parents AI Assistant"}
                  className="w-[360px] sm:w-[420px] max-w-[calc(100vw-2rem)] gm-glass-card rounded-2xl p-4 space-y-3 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#C6A15B]/25">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GuardianAi2D className="w-9 h-9 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#F4F0E6] truncate flex items-center gap-1.5">
                          <span>{lang === "hi" ? "पेरेंट्स AI सहायक" : "Parents AI Assistant"}</span>
                          {aiProvider === "gemini" && <GeminiSparkleIcon className="w-3.5 h-3.5 shrink-0" />}
                        </p>
                        <p className="text-[10px] text-[#43C6A5] font-medium truncate">
                          {activeVoiceLangObj.nativeName} ·{" "}
                          {aiProvider === "gemini"
                            ? "Google Gemini AI"
                            : lang === "hi"
                              ? "गार्जियन नियम सलाहकार"
                              : "Guardian Advisor"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {aiChatMessages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            stopSpeaking();
                            setAiChatSpeakingId(null);
                            setAiChatMessages([]);
                            setAiQuickError(null);
                            setLastFailedPrompt(null);
                          }}
                          title={lang === "hi" ? "चैट साफ़ करें" : "Clear chat"}
                          aria-label={lang === "hi" ? "चैट साफ़ करें" : "Clear chat"}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#AEBBC9] hover:text-[#E87575] hover:bg-[#10243A] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAiDrawerOpen(false)}
                        aria-label={lang === "hi" ? "AI पैनल बंद करें" : "Close AI assistant"}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#AEBBC9] hover:text-[#F4F0E6] hover:bg-[#10243A] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Provider Switcher + Quick Language Mode */}
                  <div className="space-y-2">
                    <AiProviderSwitcher
                      provider={aiProvider}
                      onChange={setAiProvider}
                      lang={lang}
                      compact
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {(
                          [
                            { code: "en", label: "EN" },
                            { code: "hi", label: "हिन्दी" },
                            { code: "bn", label: "বাং" },
                            { code: "ml", label: "മല" },
                            { code: "kn", label: "ಕನ್" },
                            { code: "ta", label: "தமி" },
                            { code: "te", label: "తె" },
                            { code: "hinglish", label: "HiEn" },
                          ] as { code: VoiceLangCode; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => handleSelectVoiceLang(opt.code)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                              voiceLang === opt.code
                                ? "bg-[#252A32] border-[#E6C98A] text-[#E6C98A]"
                                : "bg-[#071525]/70 border-[#C6A15B]/25 text-[#AEBBC9] hover:text-[#F4F0E6]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {intelContext?.summary && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0B2825] border border-[#43C6A5]/35 text-[10px] font-medium text-[#43C6A5] max-w-[200px]">
                          <span className="truncate">
                            {intelContext.activeSection}
                            {typeof intelContext.score === "number" ? ` (${intelContext.score}/100)` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIntelContext(null)}
                            aria-label="Clear active scan context"
                            className="hover:text-[#F4F0E6] cursor-pointer shrink-0"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversation Thread */}
                  <div className="max-h-64 min-h-[120px] overflow-y-auto space-y-2.5 pr-1">
                    {aiChatMessages.length === 0 && !aiQuickBusy ? (
                      <div className="p-3 rounded-xl bg-[#071525]/70 border border-[#C6A15B]/20 space-y-2">
                        <p className="text-xs text-[#AEBBC9] leading-relaxed">
                          {lang === "hi"
                            ? "संदिग्ध संदेश, QR स्कैन परिणाम, सुरक्षित बैंकिंग या परिवार सुरक्षा स्थिति के बारे में तुरंत पूछें।"
                            : "Ask anything about a QR scan, suspicious call, UPI link, or family safety in English, Hindi, or Hinglish."}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            lang === "hi" ? "क्या KYC OTP कॉल सुरक्षित है?" : "Is a KYC OTP call safe?",
                            lang === "hi" ? "क्या यह QR सुरक्षित है?" : "Explain my last scan",
                          ].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => void sendChatMessage(q)}
                              className="px-2.5 py-1 rounded-lg border border-[#C6A15B]/30 bg-[#10243A] hover:border-[#E6C98A] text-[10px] font-semibold text-[#E6C98A] cursor-pointer"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      aiChatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-xl text-xs border ${
                            msg.role === "user"
                              ? "bg-[#10243A] border-[#C6A15B]/30 text-[#F4F0E6] ml-7"
                              : "bg-[#071525]/90 border-[#E6C98A]/35 text-[#F4F0E6] mr-3"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-[11px] text-[#E6C98A]">
                              {msg.role === "user"
                                ? lang === "hi"
                                  ? "आप"
                                  : "You"
                                : msg.providerUsed === "guardian"
                                  ? "Guardian Advisor"
                                  : "Guardian Gemini AI"}
                            </span>
                            {msg.role === "assistant" && (
                              <div className="flex items-center gap-1">
                                {isTtsSupported() && (
                                  <button
                                    type="button"
                                    onClick={() => toggleChatMessageSpeech(msg)}
                                    aria-label={aiChatSpeakingId === msg.id ? "Stop speaking" : "Listen to reply"}
                                    className="px-1.5 py-0.5 rounded bg-[#10243A] border border-[#C6A15B]/25 text-[10px] font-semibold text-[#E6C98A] hover:border-[#E6C98A] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {aiChatSpeakingId === msg.id ? (
                                      <>
                                        <Square className="w-2.5 h-2.5 fill-current" />
                                        <span>{lang === "hi" ? "रोकें" : "Stop"}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-2.5 h-2.5" />
                                        <span>{lang === "hi" ? "सुनें" : "Speak"}</span>
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void copyChatMessage(msg)}
                                  aria-label="Copy response"
                                  className="px-1.5 py-0.5 rounded bg-[#10243A] border border-[#C6A15B]/25 text-[10px] text-[#AEBBC9] hover:text-[#F4F0E6] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {aiCopiedMsgId === msg.id ? (
                                    <Check className="w-2.5 h-2.5 text-[#43C6A5]" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                          {msg.role === "assistant" ? (
                            <SafeMarkdownText text={msg.text} className="text-xs text-[#F4F0E6]" />
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          )}
                        </div>
                      ))
                    )}

                    {aiQuickBusy && (
                      <div className="p-3 rounded-xl bg-[#071525]/90 border border-[#C6A15B]/35 mr-8 text-xs text-[#E6C98A] flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>
                          {lang === "hi"
                            ? "Guardian AI उत्तर तैयार कर रहा है..."
                            : "Guardian AI is thinking..."}
                        </span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {aiQuickError && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-xl bg-[#2E1219] border border-[#E87575]/45 text-[11px] text-[#E87575] space-y-2"
                    >
                      <p>{aiQuickError}</p>
                      <div className="flex flex-wrap gap-2">
                        {lastFailedPrompt && (
                          <button
                            type="button"
                            disabled={aiQuickBusy}
                            onClick={() => void sendChatMessage(lastFailedPrompt)}
                            className="px-2.5 py-1 rounded-lg bg-[#10243A] border border-[#C6A15B]/45 text-[#E6C98A] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {lang === "hi" ? "पुनः प्रयास करें" : "Retry"}
                          </button>
                        )}
                        {aiProvider === "gemini" && lastFailedPrompt && (
                          <button
                            type="button"
                            disabled={aiQuickBusy}
                            onClick={() => {
                              setAiProvider("guardian");
                              void sendChatMessage(lastFailedPrompt, "guardian");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#0B2825] border border-[#43C6A5]/45 text-[#43C6A5] font-semibold cursor-pointer"
                          >
                            {lang === "hi" ? "गार्जियन सलाहकार से पूछें" : "Try Guardian Advisor"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleQuickAiSubmit} className="flex items-end gap-2">
                    <textarea
                      rows={2}
                      value={aiQuickInput}
                      onChange={(e) => setAiQuickInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendChatMessage(aiQuickInput);
                        }
                      }}
                      placeholder={
                        lang === "hi"
                          ? "अपना प्रश्न लिखें... (Enter भेजने के लिए)"
                          : "Ask a safety question... (Enter to send)"
                      }
                      className="flex-1 min-w-0 rounded-xl border border-[#C6A15B]/35 bg-[#071525]/85 px-3 py-2 text-xs text-[#F4F0E6] placeholder:text-[#AEBBC9] focus:outline-none focus:border-[#E6C98A] resize-none"
                    />
                    <button
                      type="submit"
                      disabled={aiQuickBusy || !aiQuickInput.trim()}
                      aria-label={lang === "hi" ? "सवाल भेजें" : "Send question"}
                      className="h-10 px-3.5 rounded-xl gm-gold-btn font-bold text-xs inline-flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {aiQuickBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </form>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAiDrawerOpen(false);
                        setVoiceModalOpen(true);
                      }}
                      className="py-2 px-2.5 rounded-xl border border-[#C6A15B]/40 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#E6C98A] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{lang === "hi" ? "वॉइस सहायक" : "Voice Mic"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAiDrawerOpen(false);
                        navigateTab("parents_ai");
                      }}
                      className="py-2 px-2.5 rounded-xl border border-[#C6A15B]/30 bg-[#252A32]/90 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E6C98A]" />
                      <span>{lang === "hi" ? "पूर्ण कार्यक्षेत्र" : "Full AI Hub"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAiDrawerOpen(false);
                    setVoiceModalOpen(true);
                  }}
                  aria-label={lang === "hi" ? "गार्जियन वॉइस सहायक खोलें" : "Open Guardian AI Voice Assistant"}
                  title={lang === "hi" ? "वॉइस सहायक (7 भाषाएं)" : "Voice Assistant (7 Languages)"}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#10243A] to-[#252A32] border-2 border-[#C6A15B] text-[#E6C98A] shadow-[0_0_24px_rgba(198,161,91,0.42)] hover:border-[#E6C98A] hover:scale-105 transition-all flex items-center justify-center cursor-pointer active:scale-[0.96]"
                >
                  <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  type="button"
                  onClick={() => setAiDrawerOpen((v) => !v)}
                  aria-label={lang === "hi" ? "पेरेंट्स AI सहायक खोलें" : "Toggle Parents AI Assistant"}
                  title={lang === "hi" ? "पेरेंट्स AI सहायक" : "Parents AI Assistant"}
                  className="as-float-slow relative w-12 h-12 sm:w-14 sm:h-14 rounded-full p-0.5 bg-gradient-to-br from-[#E6C98A] via-[#C6A15B] to-[#8C6E36] shadow-[0_0_28px_rgba(198,161,91,0.52)] hover:shadow-[0_0_36px_rgba(230,201,138,0.72)] transition-shadow cursor-pointer active:scale-[0.96]"
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#071525] flex items-center justify-center">
                    <img
                      src={GOLD_AI_ORB}
                      alt="Parents AI"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Thumb-Zone Bottom Navigation (compact <= 15% cap) */}
          {user && state && (
            <nav
              aria-label={lang === "hi" ? "मोबाइल नेविगेशन" : "Mobile quick navigation"}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#071525]/96 backdrop-blur-xl border-t border-[#C6A15B]/30 grid grid-cols-5 items-center px-1"
            >
              <button
                type="button"
                onClick={() => navigateTab("overview")}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                  tab === "overview" ? "text-[#E6C98A] font-semibold" : "text-[#AEBBC9]"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="truncate">{lang === "hi" ? "होम" : "Home"}</span>
              </button>

              <button
                type="button"
                onClick={openLiveQrScanner}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                  tab === "scam_qr" ? "text-[#E6C98A] font-semibold" : "text-[#AEBBC9]"
                }`}
              >
                <Camera className="w-5 h-5" />
                <span className="truncate">{lang === "hi" ? "QR स्कैन" : "QR Scan"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openEmergencyBankCall({
                    source: "dashboard",
                    reason: lang === "hi" ? "तत्काल बैंक कॉल सहायता" : "Urgent bank assistance",
                  })
                }
                aria-label={lang === "hi" ? "आपातकाल में बैंक को कॉल करें" : "Emergency Call My Bank"}
                className="min-h-[46px] mx-1 rounded-xl gm-emergency-btn flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer active:scale-[0.98]"
              >
                <PhoneCall className="w-4 h-4" />
                <span className="truncate">{lang === "hi" ? "बैंक कॉल" : "Call Bank"}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTab("cyber_check")}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                  tab === "cyber_check" ? "text-[#E6C98A] font-semibold" : "text-[#AEBBC9]"
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="truncate">{lang === "hi" ? "साइबर" : "Verify"}</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                  tab === "calls_links" || tab === "awareness" || tab === "approvals" || tab === "parents_ai"
                    ? "text-[#E6C98A] font-semibold"
                    : "text-[#AEBBC9]"
                }`}
              >
                <Menu className="w-5 h-5" />
                <span className="truncate">{lang === "hi" ? "मेनू" : "More"}</span>
              </button>
            </nav>
          )}

          {/* Voice Assistant & Language Selector Modals */}
          {user && state && (
            <GuardianVoiceModal
              open={voiceModalOpen}
              uiLang={lang}
              voiceLang={voiceLang}
              onChangeVoiceLang={handleSelectVoiceLang}
              aiProvider={aiProvider}
              onChangeProvider={setAiProvider}
              onOpenLanguageModal={() => setLangModalOpen(true)}
              onNavigateTarget={handleVoiceNavigationTarget}
              intelContext={intelContext}
              sharedChatHistory={aiChatMessages}
              onAppendUnifiedExchange={appendUnifiedExchange}
              onClose={() => setVoiceModalOpen(false)}
            />
          )}

          <LanguageSelectorModal
            open={langModalOpen}
            selectedVoiceLang={voiceLang}
            uiLang={lang}
            onSelect={handleSelectVoiceLang}
            onClose={() => setLangModalOpen(false)}
          />

          {/* Emergency Help Modal */}
          {emergencyOpen && (
            <div className="fixed inset-0 z-50 bg-[#071525]/85 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="gm-glass-card rounded-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <EmergencyAssistance2D className="w-11 h-11 shrink-0" />
                    <h2 className="text-base font-bold text-[#F4F0E6]">
                      {lang === "hi" ? "आपातकालीन स्कैम व धोखाधड़ी सहायता" : "Emergency Scam & Fraud Help"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmergencyOpen(false)}
                    aria-label="Close emergency dialog"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <ol className="space-y-2 text-sm text-[#AEBBC9] list-decimal pl-5 leading-relaxed">
                  <li>
                    {lang === "hi"
                      ? "यदि कोई OTP, UPI PIN, स्क्रीन शेयरिंग मांगे या डिजिटल अरेस्ट की धमकी दे, तो तुरंत कॉल काट दें।"
                      : "Hang up immediately if anyone asks for OTP, UPI PIN, screen sharing, or threatens digital arrest."}
                  </li>
                  <li>
                    {lang === "hi" ? (
                      <>
                        संदिग्ध लेनदेन रोकने के लिए तुरंत भारत की राष्ट्रीय साइबर अपराध हेल्पलाइन{" "}
                        <strong className="font-mono tabular-nums text-[#E6C98A]">1930</strong> पर कॉल करें।
                      </>
                    ) : (
                      <>
                        Call India&apos;s National Cyber Crime Helpline on{" "}
                        <strong className="font-mono tabular-nums text-[#E6C98A]">1930</strong> immediately to freeze fraudulent transfers.
                      </>
                    )}
                  </li>
                  <li>
                    {lang === "hi"
                      ? "अपने बैंक के सत्यापित आधिकारिक नंबर पर सीधे संपर्क करें।"
                      : "Contact your bank directly using its official verified toll-free helpline."}
                  </li>
                </ol>

                <div className="flex flex-wrap gap-3 pt-2">
                  {user && state && (
                    <>
                      <EmergencyCallButton
                        compact
                        lang={lang}
                        primaryBankName={primarySavedBank?.shortCode || null}
                        onClick={() =>
                          openEmergencyBankCall({
                            source: "dashboard",
                            reason:
                              lang === "hi"
                                ? "आपातकालीन स्कैम व धोखाधड़ी सहायता"
                                : "Emergency scam or suspected financial fraud",
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          openEmergencyBankCall({
                            source: "lost_phone",
                            threatCategory: lang === "hi" ? "फ़ोन गुम या चोरी" : "Lost or Stolen Phone",
                            riskLevel: "HIGH RISK",
                            reason:
                              lang === "hi"
                                ? "फ़ोन गुम या चोरी — तुरंत SIM, UPI और बैंक कार्ड ब्लॉक करें"
                                : "Lost or stolen phone — Urgent bank card, UPI & SIM block",
                            suggestedAction:
                              lang === "hi"
                                ? "मेरा फ़ोन गुम/चोरी हो गया है। कृपया तुरंत नेटबैंकिंग, UPI और डेबिट कार्ड अस्थायी रूप से ब्लॉक करें।"
                                : "My registered phone is lost or stolen. Please immediately block NetBanking, UPI, and debit cards linked to my account.",
                          })
                        }
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#C6A15B]/45 bg-[#10243A] hover:border-[#E6C98A] text-[#F4F0E6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#E6C98A]" />
                        {lang === "hi" ? "फ़ोन गुम / चोरी आपातकाल" : "Lost or Stolen Phone"}
                      </button>
                    </>
                  )}
                  <a
                    href="https://cybercrime.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E87575]/45 text-[#E87575] hover:bg-[#2E1219] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    {lang === "hi" ? "साइबरक्राइम पोर्टल" : "Cybercrime Portal"}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {user?.role === "parent" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await revokeAllGuardiansEmergency();
                        setEmergencyOpen(false);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/80 hover:border-[#E6C98A] text-xs font-medium text-[#F4F0E6] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {lang === "hi" ? "सभी लिंक अभिभावक हटाएं" : "Revoke All Linked Guardians"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Emergency Bank Call Modal */}
          {user && state && (
            <EmergencyBankCallModal
              open={emergencyBankOpen}
              context={emergencyBankCtx}
              state={state}
              lang={lang}
              onClose={() => setEmergencyBankOpen(false)}
              onNavigate={(nextTab) => setTab(nextTab)}
              onRefresh={refreshState}
            />
          )}

          {/* Sidebar Logout Confirmation Dialog */}
          {sidebarLogoutConfirm && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sidebar-logout-title"
              className="fixed inset-0 z-50 bg-[#071525]/85 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="gm-glass-card rounded-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-[#F4F0E6]">
                    <div className="w-9 h-9 rounded-xl bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center shrink-0">
                      <LogOut className="w-4 h-4 text-[#E6C98A]" />
                    </div>
                    <h2 id="sidebar-logout-title" className="text-base font-bold">
                      {lang === "hi" ? "क्या आप वाकई लॉग आउट करना चाहते हैं?" : "Are you sure you want to log out?"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={() => setSidebarLogoutConfirm(false)}
                    aria-label="Close logout dialog"
                    className="text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-[#AEBBC9] leading-relaxed">
                  {lang === "hi"
                    ? "यह केवल आपका सक्रिय सत्र समाप्त करेगा। आपका खाता और सहेजे गए सुरक्षा लॉग सुरक्षित रहेंगे।"
                    : "This will terminate your active session and return you to the sign-in screen. Your account and saved safety reports remain preserved."}
                </p>
                <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={() => setSidebarLogoutConfirm(false)}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 text-xs font-medium text-[#F4F0E6] hover:border-[#E6C98A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {lang === "hi" ? "रद्द करें" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={async () => {
                      setLoggingOut(true);
                      try {
                        await handleLogout();
                      } finally {
                        setLoggingOut(false);
                      }
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {loggingOut
                      ? lang === "hi"
                        ? "लॉग आउट हो रहा है..."
                        : "Logging out..."
                      : lang === "hi"
                        ? "लॉग आउट"
                        : "Log Out"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </EmergencyCallProvider>
    </MotionConfig>
  );
}
