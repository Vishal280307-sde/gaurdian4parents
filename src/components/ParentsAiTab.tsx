import React, { useEffect, useState } from "react";
import { Sparkles, Plus, Trash2, CheckCircle2, Mic, Globe, Volume2, Square } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { isTtsSupported, speakAlertText, stopSpeaking } from "../lib/tts";
import { getVoiceLanguageOption } from "../lib/voiceAssistant";
import { AiProviderSwitcher, GeminiSparkleIcon } from "./GeminiBadgeIcon";
import { SafeMarkdownText } from "./SafeMarkdownText";
import { FinancialProtection2D, GuardianAi2D } from "./Illustrations2D";
import type { AiProviderId, AppStatePayload, LangCode, VoiceLangCode } from "../types/guardian";

interface ParentsAiTabProps {
  state: AppStatePayload;
  lang: LangCode;
  voiceLang?: VoiceLangCode;
  aiProvider?: AiProviderId;
  onChangeProvider?: (provider: AiProviderId) => void;
  onOpenVoiceAssistant?: () => void;
  onOpenLanguageModal?: () => void;
}

interface ParentsAiState {
  ownerId: string;
  items: { id: string; tool_key: string; title: string; category: string; status: string }[];
  aaConnections: { id: string; institution_name: string; aa_handle: string; status: string; scopes: string[] }[];
  budgets: {
    id: string;
    category: string;
    monthly_limit: number;
    savings_goal_name: string | null;
    savings_target: number;
    savings_current: number;
  }[];
  accessControl: { childFinancialAccess: boolean; guardianFinancialAccess: boolean; requireGuardianAuth: boolean };
  sampleSpendSummary: { category: string; spent: number; trend: string }[];
}

export const ParentsAiTab: React.FC<ParentsAiTabProps> = ({
  state,
  lang,
  voiceLang = lang,
  aiProvider = "gemini",
  onChangeProvider,
  onOpenVoiceAssistant,
  onOpenLanguageModal,
}) => {
  const isParent = state.user.role === "parent";
  const [pai, setPai] = useState<ParentsAiState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localProvider, setLocalProvider] = useState<AiProviderId>(aiProvider);

  const activeProvider = onChangeProvider ? aiProvider : localProvider;
  const setProvider = onChangeProvider || setLocalProvider;

  const [toolKey, setToolKey] = useState("budgeting");
  const [prompt, setPrompt] = useState("Help us organize monthly medicine and grocery bills simply.");
  const [answer, setAnswer] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const [speakingAnswer, setSpeakingAnswer] = useState(false);

  const [budCategory, setBudCategory] = useState("Healthcare & Medicines");
  const [budLimit, setBudLimit] = useState("8000");

  const [itemTitle, setItemTitle] = useState("");

  async function loadState() {
    try {
      const data = await apiFetch<ParentsAiState>("/api/parents-ai/state");
      setPai(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Parents AI state.");
    }
  }

  useEffect(() => {
    loadState();
  }, [state.user.id]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAskBusy(true);
    try {
      const res = await apiFetch<{ answer: string }>("/api/parents-ai/tools/ask", {
        method: "POST",
        body: JSON.stringify({
          toolKey,
          prompt,
          lang,
          voiceLang,
          provider: activeProvider,
        }),
      });
      setAnswer(res.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parents AI assistant failed.");
    } finally {
      setAskBusy(false);
    }
  }

  async function connectDemoAa() {
    setError(null);
    try {
      await apiFetch("/api/parents-ai/bank/connect-demo", {
        method: "POST",
        body: JSON.stringify({
          institutionName: "Demo RBI Account Aggregator (Read-Only)",
          aaHandle: "kulkarni.family@anumati.demo",
        }),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
    }
  }

  async function revokeAa(id: string) {
    await apiFetch(`/api/parents-ai/bank/revoke/${id}`, { method: "POST" });
    await loadState();
  }

  async function addBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/parents-ai/budgets", {
        method: "POST",
        body: JSON.stringify({ category: budCategory, monthlyLimit: Number(budLimit) }),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budget.");
    }
  }

  async function removeBudget(id: string) {
    await apiFetch(`/api/parents-ai/budgets/${id}`, { method: "DELETE" });
    await loadState();
  }

  async function addRoutineItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim()) return;
    await apiFetch("/api/parents-ai/tools/items", {
      method: "POST",
      body: JSON.stringify({ toolKey: "routine", title: itemTitle.trim(), category: "family" }),
    });
    setItemTitle("");
    await loadState();
  }

  async function toggleItemDone(id: string, currentStatus: string) {
    await apiFetch(`/api/parents-ai/tools/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: currentStatus === "completed" ? "active" : "completed" }),
    });
    await loadState();
  }

  async function toggleFinancialAccess(key: "guardianFinancialAccess" | "childFinancialAccess", val: boolean) {
    await apiFetch("/api/parents-ai/bank/access-control", {
      method: "PUT",
      body: JSON.stringify({ [key]: val }),
    });
    await loadState();
  }

  const maxSpend = Math.max(1, ...(pai?.sampleSpendSummary || []).map((r) => r.spent));
  const barColors = [
    "bg-[#E6C98A]",
    "bg-[#C6A15B]",
    "bg-[#43C6A5]",
    "bg-[#6CC4E8]",
  ];

  const primaryBtn =
    "gm-gold-btn min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]";
  const activeVoiceLangOpt = getVoiceLanguageOption(voiceLang);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionReveal}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
    >
      {/* Left: Parents AI Advisor (#0A192E + #E6C98A) & Family Routine Items */}
      <div className="lg:col-span-6 space-y-6">
        <div className="rounded-2xl p-6 space-y-4 bg-[#0A192E]/95 border border-[#E6C98A]/40 shadow-[0_18px_40px_-14px_rgba(3,8,18,0.85)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <GuardianAi2D className="w-11 h-11 shrink-0" />
              <div className="flex items-center gap-2">
                {activeProvider === "gemini" ? (
                  <GeminiSparkleIcon className="w-4 h-4 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#E6C98A] shrink-0" />
                )}
                <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi" ? "पेरेंट्स AI परिवार सहायक" : "Parents AI Family Assistant"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenLanguageModal && (
                <button
                  type="button"
                  onClick={onOpenLanguageModal}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#E6C98A] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{activeVoiceLangOpt.nativeName}</span>
                </button>
              )}
              {onOpenVoiceAssistant && (
                <button
                  type="button"
                  onClick={onOpenVoiceAssistant}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#C6A15B]/45 bg-[#252A32] hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-[#E6C98A]" />
                  <span>{lang === "hi" ? "बोलें" : "Voice"}</span>
                </button>
              )}
            </div>
          </div>

          <AiProviderSwitcher provider={activeProvider} onChange={setProvider} lang={lang} />

          <p className="text-xs text-[#AEBBC9]">
            {lang === "hi"
              ? "घरेलू बजट, दवा/दैनिक सूची या स्कैम-सुरक्षित परिवार मार्गदर्शन पूछें। कभी बैंक पासवर्ड, PIN या OTP न लिखें।"
              : "Ask for household budgeting tips, medication/routine checklists, or scam-aware family guidance. Never enter bank passwords, PINs, or OTPs."}
          </p>

          <form onSubmit={handleAsk} className="space-y-3">
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <select
                value={toolKey}
                onChange={(e) => setToolKey(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/90 px-3 py-2 text-xs text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
              >
                <option value="budgeting">{lang === "hi" ? "घरेलू बजट" : "Household Budgeting"}</option>
                <option value="caregiving">{lang === "hi" ? "वरिष्ठ देखभाल" : "Senior Care & Routines"}</option>
                <option value="parenting">{lang === "hi" ? "परिवार समन्वय" : "Family Coordination"}</option>
              </select>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/90 px-3.5 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
              />
            </div>
            <button type="submit" disabled={askBusy} className={`${primaryBtn} text-sm`}>
              {askBusy
                ? lang === "hi"
                  ? "विचार जारी है..."
                  : "Thinking..."
                : lang === "hi"
                  ? "पेरेंट्स AI से पूछें"
                  : "Ask Parents AI"}
            </button>
          </form>

          {error && <p className="text-xs text-[#E87575]">{error}</p>}

          {answer && (
            <div className="p-4 rounded-xl bg-[#071525]/85 border border-[#C6A15B]/45 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#E6C98A]">
                  {activeProvider === "gemini" ? "Gemini Family Guidance" : "Guardian Family Guidance"}
                </span>
                {isTtsSupported() && (
                  <button
                    type="button"
                    onClick={() => {
                      if (speakingAnswer) {
                        stopSpeaking();
                        setSpeakingAnswer(false);
                        return;
                      }
                      speakAlertText(answer, voiceLang, {
                        onStart: () => setSpeakingAnswer(true),
                        onEnd: () => setSpeakingAnswer(false),
                        onError: () => setSpeakingAnswer(false),
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#10243A] border border-[#C6A15B]/35 text-[11px] font-semibold text-[#E6C98A] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {speakingAnswer ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>{lang === "hi" ? "रोकें" : "Stop"}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        <span>{lang === "hi" ? "सुनें" : "Listen"}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <SafeMarkdownText text={answer} className="text-sm text-[#F4F0E6]" />
            </div>
          )}
        </div>

        {/* Family Checklist */}
        <div className="gp-card rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-sm font-semibold text-[#F4F0E6]">
            {lang === "hi" ? "साझा परिवार देखभाल व बिल सूची" : "Shared Family Care & Bills Checklist"}
          </h3>
          <form onSubmit={addRoutineItem} className="flex gap-2">
            <input
              type="text"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder={
                lang === "hi"
                  ? "जैसे: मासिक दवाइयां या पेंशन जांच"
                  : "e.g. Monthly pharmacy refill or pension check"
              }
              className="flex-1 min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/90 px-3.5 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
            />
            <button type="submit" className={primaryBtn}>
              <span className="inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                {lang === "hi" ? "जोड़ें" : "Add"}
              </span>
            </button>
          </form>

          {!pai && !error ? (
            <div className="space-y-2.5">
              <div className="h-10 rounded-xl gm-skeleton" />
              <div className="h-10 rounded-xl gm-skeleton" />
            </div>
          ) : !pai || pai.items.length === 0 ? (
            <p className="text-xs text-[#AEBBC9] py-2">
              {lang === "hi" ? "अभी कोई साझा कार्य नहीं जोड़ा गया है।" : "No shared items added yet."}
            </p>
          ) : (
            <div className="divide-y divide-[#C6A15B]/15">
              {pai.items.map((it) => (
                <div key={it.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleItemDone(it.id, it.status)}
                    className="inline-flex items-center gap-2 text-left cursor-pointer"
                  >
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        it.status === "completed" ? "text-[#43C6A5]" : "text-[#C6A15B]/55"
                      }`}
                    />
                    <span
                      className={
                        it.status === "completed" ? "line-through text-[#AEBBC9]" : "text-[#F4F0E6]"
                      }
                    >
                      {it.title}
                    </span>
                  </button>
                  <span className="text-xs text-[#E6C98A]">{it.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Consent-First RBI Account Aggregator Insights & Budgets */}
      <div className="lg:col-span-6 space-y-6">
        <div className="gp-card rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FinancialProtection2D className="w-11 h-11 shrink-0" />
              <div>
                <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi"
                    ? "सहमति-प्रथम RBI AA वित्तीय अंतर्दृष्टि"
                    : "Consent-First RBI AA Financial Insights"}
                </h2>
              <p className="mt-1 text-xs text-[#AEBBC9]">
                {lang === "hi"
                  ? "केवल-पढ़ने योग्य नमूना Account Aggregator प्रोफ़ाइल। बैंकिंग पासवर्ड या OTP कभी नहीं मांगे जाते।"
                  : "Read-only sample Account Aggregator profile. Zero banking credentials or OTPs are ever requested or stored."}
              </p>
              </div>
            </div>
            <button type="button" onClick={connectDemoAa} className={primaryBtn}>
              {lang === "hi" ? "डेमो AA जोड़ें" : "Connect Demo AA"}
            </button>
          </div>

          {!pai && !error && (
            <div className="h-24 rounded-xl gm-skeleton" />
          )}

          {pai && pai.aaConnections.filter((c) => c.status === "active").length > 0 && (
            <div className="space-y-4 pt-3 border-t border-[#C6A15B]/20">
              {pai.aaConnections
                .filter((c) => c.status === "active")
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs bg-[#071525]/75 p-3 rounded-xl border border-[#C6A15B]/25"
                  >
                    <div>
                      <p className="font-semibold text-[#F4F0E6]">{c.institution_name}</p>
                      <p className="text-[#AEBBC9] font-mono">{c.aa_handle} · Read-only</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeAa(c.id)}
                      className="text-[#E87575] hover:underline font-medium cursor-pointer"
                    >
                      {lang === "hi" ? "हटाएं" : "Revoke"}
                    </button>
                  </div>
                ))}

              {pai.sampleSpendSummary.length > 0 && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-semibold text-[#E6C98A]">
                    {lang === "hi" ? "मासिक व्यय सारांश" : "Monthly Spend Breakdown"}
                  </p>
                  {pai.sampleSpendSummary.map((row, idx) => (
                    <div key={row.category} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F4F0E6] font-medium">{row.category}</span>
                        <span className="font-mono tabular-nums font-semibold text-[#E6C98A]">
                          ₹{row.spent.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#071525]/85 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColors[idx % barColors.length]} transition-all duration-200`}
                          style={{ width: `${Math.max(8, Math.round((row.spent / maxSpend) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isParent && pai && (
            <div className="pt-3 border-t border-[#C6A15B]/20 space-y-2 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#AEBBC9]">
                  {lang === "hi"
                    ? "जुड़े अभिभावक को बजट सारांश देखने की अनुमति दें"
                    : "Allow linked guardian to view budget summaries"}
                </span>
                <input
                  type="checkbox"
                  checked={pai.accessControl.guardianFinancialAccess}
                  onChange={(e) => toggleFinancialAccess("guardianFinancialAccess", e.target.checked)}
                  className="accent-[#C6A15B]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Household Budgets */}
        <div className="gp-card rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-sm font-semibold text-[#F4F0E6]">
            {lang === "hi" ? "मासिक घरेलू बजट" : "Monthly Household Budgets"}
          </h3>
          <form onSubmit={addBudget} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={budCategory}
              onChange={(e) => setBudCategory(e.target.value)}
              placeholder={lang === "hi" ? "श्रेणी" : "Category"}
              className="flex-1 min-w-[140px] min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/90 px-3 py-2 text-xs text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
            />
            <input
              type="number"
              min={100}
              value={budLimit}
              onChange={(e) => setBudLimit(e.target.value)}
              placeholder="Limit ₹"
              className="w-28 min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/90 px-3 py-2 text-xs font-mono tabular-nums text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
            />
            <button type="submit" className={primaryBtn}>
              {lang === "hi" ? "सहेजें" : "Save"}
            </button>
          </form>

          {!pai || pai.budgets.length === 0 ? (
            <p className="text-xs text-[#AEBBC9]">
              {lang === "hi" ? "अभी कोई मासिक बजट सेट नहीं किया गया है।" : "No monthly budgets configured yet."}
            </p>
          ) : (
            <div className="divide-y divide-[#C6A15B]/15">
              {pai.budgets.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[#F4F0E6]">{b.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums font-semibold text-[#E6C98A]">
                      ₹{b.monthly_limit.toLocaleString("en-IN")} / mo
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBudget(b.id)}
                      aria-label={`Remove ${b.category}`}
                      className="text-[#AEBBC9] hover:text-[#E87575] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
