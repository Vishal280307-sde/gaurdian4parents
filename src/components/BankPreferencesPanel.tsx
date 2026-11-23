import React, { useState } from "react";
import { Plus, Star, Trash2, ExternalLink, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "../lib/api";
import { BankCrestBadge, EmergencyCallButton } from "./EmergencyBankCallModal";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import { BankingSecurity2D } from "./Illustrations2D";
import type { AppStatePayload, LangCode } from "../types/guardian";

interface BankPreferencesPanelProps {
  state: AppStatePayload;
  lang: LangCode;
  onRefresh: () => Promise<void>;
}

function safeHttps(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export const BankPreferencesPanel: React.FC<BankPreferencesPanelProps> = ({ state, lang, onRefresh }) => {
  const { openEmergencyCall } = useEmergencyCall();
  const savedBanks = state.userBanks || [];
  const directory = state.bankDirectory || [];

  const [selectedBankId, setSelectedBankId] = useState<string>(directory[0]?.id || "");
  const [nickname, setNickname] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [makePrimary, setMakePrimary] = useState(savedBanks.length === 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);

  const primaryBank = savedBanks.find((b) => b.isPrimary) || savedBanks[0] || null;

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    const bankToSave = selectedBankId || directory[0]?.id;
    if (!bankToSave) {
      setError(lang === "hi" ? "कृपया सूची से एक बैंक चुनें।" : "Please select a bank from the verified directory.");
      return;
    }
    if (lastFour.trim() && !/^\d{4}$/.test(lastFour.trim())) {
      setError(
        lang === "hi"
          ? "अंतिम 4 अंक (वैकल्पिक) केवल 4 संख्यात्मक अंक होने चाहिए।"
          : "Optional last 4 digits must be exactly 4 numbers."
      );
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/api/user/banks", {
        method: "POST",
        body: JSON.stringify({
          bankId: bankToSave,
          accountNickname: nickname.trim() || null,
          lastFourDigits: lastFour.trim() || null,
          isPrimary: makePrimary || savedBanks.length === 0,
        }),
      });
      setNickname("");
      setLastFour("");
      setMakePrimary(false);
      setNotice(
        lang === "hi"
          ? "बैंक आपकी आपातकालीन कॉल प्रोफ़ाइल में सहेज लिया गया है।"
          : "Bank saved to your Guardian emergency call profile."
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bank.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPrimary(accountId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await apiFetch(`/api/user/banks/${accountId}/primary`, { method: "PUT" });
      setNotice(lang === "hi" ? "प्राथमिक बैंक अपडेट किया गया।" : "Primary emergency bank updated.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update primary bank.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveBank(accountId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await apiFetch(`/api/user/banks/${accountId}`, { method: "DELETE" });
      setNotice(lang === "hi" ? "सहेजा गया बैंक हटा दिया गया।" : "Saved bank removed from profile.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove bank.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full min-h-[40px] rounded-xl border border-[#C6A15B]/28 bg-[#071525]/90 px-3 py-2 text-xs text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]";

  return (
    <div id="bank-preferences-settings" className="gp-card rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <BankingSecurity2D className="w-11 h-11 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
              {lang === "hi" ? "मेरे सहेजे गए बैंक और आपातकालीन हेल्पलाइन" : "My Saved Banks & Emergency Helplines"}
            </h2>
            <p className="mt-0.5 text-xs text-[#AEBBC9]">
              {lang === "hi"
                ? "एक या अधिक बैंक खाते सहेजें और आपातकालीन कॉल के लिए अपना प्राथमिक बैंक चुनें।"
                : "Save one or more banks and choose a primary bank for one-tap emergency calling. Guardian never guesses your bank from your phone number."}
            </p>
          </div>
        </div>

        <EmergencyCallButton
          compact
          lang={lang}
          primaryBankName={primaryBank?.shortCode || null}
          onClick={() =>
            openEmergencyCall({
              source: "epp",
              reason: lang === "hi" ? "संदिग्ध वित्तीय धोखाधड़ी सहायता" : "Suspected financial fraud assistance",
            })
          }
        />
      </div>

      {/* Saved User Banks List */}
      {savedBanks.length === 0 ? (
        <div className="p-3.5 rounded-xl bg-[#071525]/70 border border-[#C6A15B]/28 text-xs text-[#AEBBC9]">
          {lang === "hi"
            ? "अभी कोई बैंक सहेजा नहीं गया है। नीचे से अपना बैंक जोड़ें ताकि आपातकाल में तुरंत आधिकारिक नंबर मिले।"
            : "No banks saved yet. Add your primary bank below so one-tap emergency calling identifies your official helpline automatically."}
        </div>
      ) : (
        <div className="divide-y divide-[#C6A15B]/15 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/70">
          {savedBanks.map((b) => {
            const officialSite = safeHttps(b.officialWebsite);
            const sourceSite = safeHttps(b.sourceUrl);
            return (
              <div key={b.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3 min-w-0">
                  <BankCrestBadge shortCode={b.shortCode} size="sm" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#F4F0E6]">
                        {b.bankName}
                      </span>
                      {b.isPrimary && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#E6C98A]">
                          <Star className="w-3 h-3 fill-current" />
                          {lang === "hi" ? "प्राथमिक बैंक" : "Primary Bank"}
                        </span>
                      )}
                    </div>
                    {(b.accountNickname || b.lastFourDigits) && (
                      <p className="text-[#AEBBC9]">
                        {[b.accountNickname, b.lastFourDigits ? `Ending ••••${b.lastFourDigits}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono tabular-nums text-[11px] text-[#AEBBC9]">
                      {b.fraudPhone ? (
                        <span>
                          <strong className="text-[#E87575]">Fraud Line:</strong> {b.fraudPhone}
                        </span>
                      ) : null}
                      <span>
                        <strong className="text-[#F4F0E6]">Care:</strong> {b.supportPhone}
                      </span>
                      {b.lastVerifiedDate && <span>Verified {b.lastVerifiedDate}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      {officialSite && (
                        <a
                          href={officialSite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#E6C98A] hover:underline"
                        >
                          {lang === "hi" ? "वेबसाइट" : "Website"} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {sourceSite && (
                        <a
                          href={sourceSite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#C6A15B] hover:text-[#E6C98A] hover:underline"
                        >
                          {lang === "hi" ? "स्रोत" : "Source"} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!b.isPrimary && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSetPrimary(b.id)}
                      className="px-3 py-1.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A]/90 text-xs font-semibold text-[#E6C98A] hover:border-[#E6C98A] cursor-pointer whitespace-nowrap active:scale-[0.98]"
                    >
                      {lang === "hi" ? "प्राथमिक बनाएं" : "Set Primary"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemoveBank(b.id)}
                    aria-label={`Remove ${b.bankName}`}
                    className="p-2 rounded-xl border border-[#C6A15B]/25 text-[#AEBBC9] hover:text-[#E87575] hover:border-[#E87575]/45 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Another Bank Form */}
      <form onSubmit={handleAddBank} className="pt-3 border-t border-[#C6A15B]/20 space-y-3">
        <p className="text-xs font-semibold text-[#F4F0E6]">
          {lang === "hi" ? "बैंक खाता जोड़ें या बदलें" : "Add Bank Account to Profile"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5">
            <select
              value={selectedBankId || directory[0]?.id || ""}
              onChange={(e) => setSelectedBankId(e.target.value)}
              aria-label={lang === "hi" ? "बैंक चुनें" : "Choose bank"}
              className={inputCls}
            >
              {directory.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.bank_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={lang === "hi" ? "उपनाम (जैसे: पेंशन खाता)" : "Nickname (e.g. Pension)"}
              maxLength={48}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={lang === "hi" ? "अंतिम 4 अंक (वैकल्पिक)" : "Last 4 digits (opt)"}
              className={`${inputCls} font-mono tabular-nums`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-[#AEBBC9] cursor-pointer">
            <input
              type="checkbox"
              checked={makePrimary || savedBanks.length === 0}
              onChange={(e) => setMakePrimary(e.target.checked)}
              className="accent-[#C6A15B]"
            />
            <span>{lang === "hi" ? "इसे प्राथमिक आपातकालीन बैंक बनाएं" : "Set as primary emergency bank"}</span>
          </label>

          <button
            type="submit"
            disabled={busy || directory.length === 0}
            className="gm-gold-btn min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            {busy ? (lang === "hi" ? "सहेजा जा रहा है..." : "Saving...") : lang === "hi" ? "बैंक सहेजें" : "Save Bank"}
          </button>
        </div>
      </form>

      {notice && (
        <p className="text-xs font-medium text-[#43C6A5] flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{notice}</span>
        </p>
      )}
      {error && <p className="text-xs font-medium text-[#E87575]">{error}</p>}

      {/* Full Verified Indian Bank Directory Toggle */}
      <div className="pt-3 border-t border-[#C6A15B]/20">
        <button
          type="button"
          onClick={() => setShowDirectory((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E6C98A] hover:underline cursor-pointer"
        >
          <span>
            {lang === "hi"
              ? `सत्यापित भारतीय बैंक हेल्पलाइन निर्देशिका देखें (${directory.length} बैंक)`
              : `View Verified Indian Bank Helpline Directory (${directory.length} Banks)`}
          </span>
          {showDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDirectory && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#C6A15B]/25">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#C6A15B]/20 bg-[#10243A] text-[#AEBBC9]">
                  <th className="py-2 px-3 font-semibold">{lang === "hi" ? "बैंक" : "Bank"}</th>
                  <th className="py-2 px-3 font-semibold">{lang === "hi" ? "धोखाधड़ी हेल्पलाइन" : "Fraud Line"}</th>
                  <th className="py-2 px-3 font-semibold">{lang === "hi" ? "ग्राहक सेवा" : "Customer Care"}</th>
                  <th className="py-2 px-3 font-semibold">{lang === "hi" ? "सत्यापित" : "Verified"}</th>
                  <th className="py-2 px-3 font-semibold text-right">{lang === "hi" ? "स्रोत" : "Source"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C6A15B]/15 bg-[#071525]/85">
                {directory.map((d) => {
                  const srcUrl = safeHttps(d.source_url);
                  return (
                    <tr key={d.id}>
                      <td className="py-2 px-3 font-medium text-[#F4F0E6] whitespace-nowrap">
                        {d.bank_name}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[#E87575] whitespace-nowrap">
                        {d.fraud_phone || "Uses 24x7 Care"}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[#F4F0E6] whitespace-nowrap">
                        {d.support_phone}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[#AEBBC9] whitespace-nowrap">
                        {d.last_verified_date || "2026-11-22"}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {srcUrl ? (
                          <a
                            href={srcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#E6C98A] hover:underline"
                          >
                            {lang === "hi" ? "स्रोत" : "Official"} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
