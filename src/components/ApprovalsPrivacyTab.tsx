import React, { useEffect, useState } from "react";
import { CheckSquare, KeyRound, ShieldOff, Download, Trash2, Phone, Lock, Unlock, LogOut, UserCheck, X, Smartphone, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { sectionReveal } from "../lib/motionSystem";
import { EmptyStateCard } from "./VisualAsset";
import { BankPreferencesPanel } from "./BankPreferencesPanel";
import { EmergencyCallButton } from "./EmergencyBankCallModal";
import { ProfilePictureInput } from "./ProfilePictureInput";
import { useEmergencyCall } from "../context/EmergencyCallContext";
import type { AppStatePayload, LangCode, UserGender } from "../types/guardian";

interface ApprovalsPrivacyTabProps {
  state: AppStatePayload;
  lang: LangCode;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSignedOut: () => void;
}

interface EppDashboard {
  activeLock: { id: string; duration_option: string; expires_at: number; os_enforcement_mode: string } | null;
  banks: {
    id: string;
    bank_name: string;
    short_code: string;
    support_phone: string;
    fraud_phone?: string | null;
    official_website?: string | null;
    source_url?: string | null;
    last_verified_date?: string | null;
    upi_block_url: string | null;
    notes: string | null;
  }[];
}

export const ApprovalsPrivacyTab: React.FC<ApprovalsPrivacyTabProps> = ({
  state,
  lang,
  onRefresh,
  onLogout,
  onSignedOut,
}) => {
  const { openEmergencyCall } = useEmergencyCall();
  const isParent = state.user.role === "parent";
  const primaryBank = (state.userBanks || []).find((b) => b.isPrimary) || (state.userBanks || [])[0] || null;

  const [amount, setAmount] = useState("18500");
  const [beneficiary, setBeneficiary] = useState("kyc-update@okaxis");
  const [knownPayee, setKnownPayee] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [callbackChecked, setCallbackChecked] = useState<Record<string, boolean>>({});
  const [resubmitNotes, setResubmitNotes] = useState<Record<string, string>>({});

  const [safeWordInput, setSafeWordInput] = useState("");
  const [safeWordMsg, setSafeWordMsg] = useState<string | null>(null);

  const [inviteOut, setInviteOut] = useState<string | null>(null);
  const [acceptCode, setAcceptCode] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [consentMsg, setConsentMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [epp, setEpp] = useState<EppDashboard | null>(null);
  const [lockDuration, setLockDuration] = useState("1h");
  const [lockConsent, setLockConsent] = useState(false);
  const [eppMsg, setEppMsg] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(state.user.name);
  const [profileGender, setProfileGender] = useState<"" | UserGender>(state.user.gender || "");
  const [profilePicture, setProfilePicture] = useState<string | null>(state.user.profilePicture ?? null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(state.user.name);
    setProfileGender(state.user.gender || "");
    setProfilePicture(state.user.profilePicture ?? null);
  }, [state.user.name, state.user.gender, state.user.profilePicture]);

  useEffect(() => {
    apiFetch<EppDashboard>("/api/epp/dashboard")
      .then(setEpp)
      .catch(() => {});
  }, [state.user.id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profileName.trim(),
          gender: profileGender || null,
          profilePicture: profilePicture ?? null,
        }),
      });
      await onRefresh();
      setEditingProfile(false);
      setProfileMsg(lang === "hi" ? "प्रोफ़ाइल सहेजी गई।" : "Profile saved.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitPaymentForReview(e: React.FormEvent) {
    e.preventDefault();
    setPayNotice(null);
    const numAmt = Number(amount);
    if (!Number.isFinite(numAmt) || numAmt <= 0 || !beneficiary.trim()) {
      setPayNotice("Enter a valid positive amount and payee.");
      return;
    }
    const signals: string[] = [];
    let score = 0;
    const limit = state.consent?.limit || 10000;
    if (numAmt >= limit) {
      score += 35;
      signals.push(`Exceeds family threshold (₹${limit.toLocaleString("en-IN")})`);
    }
    if (!knownPayee) {
      score += 25;
      signals.push("New or unverified beneficiary");
    }
    if (/(kyc|refund|urgent|prize|claim)/i.test(beneficiary)) {
      score += 30;
      signals.push("Beneficiary handle contains high-risk keywords");
    }
    const level = score >= 70 ? "CRITICAL" : score >= 45 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

    try {
      const assess = await apiFetch<{ id: string }>("/api/payments/assess", {
        method: "POST",
        body: JSON.stringify({
          amt: numAmt,
          ben: beneficiary,
          knownDeclared: knownPayee,
          score,
          level,
          sig: signals,
        }),
      });
      if (state.consent?.gapprove) {
        await apiFetch("/api/requests", {
          method: "POST",
          body: JSON.stringify({
            amt: numAmt,
            ben: beneficiary,
            level,
            sig: signals,
            assessmentId: assess.id,
          }),
        });
        setPayNotice(
          `Payment assessed (${level}) and sent to your linked guardian for 15-minute single-use review.`
        );
      } else {
        setPayNotice(`Payment assessed (${level}). Enable Guardian Approval in Privacy to route requests.`);
      }
      await onRefresh();
    } catch (err) {
      setPayNotice(err instanceof Error ? err.message : "Could not submit payment check.");
    }
  }

  async function guardianDecide(reqId: string, decision: "approved" | "rejected" | "verification_requested") {
    setPayNotice(null);
    try {
      await apiFetch(`/api/requests/${reqId}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          verifiedCallback: Boolean(callbackChecked[reqId]),
          note: decision === "verification_requested" ? "Please call me on my saved number to confirm." : undefined,
        }),
      });
      await onRefresh();
    } catch (err) {
      setPayNotice(err instanceof Error ? err.message : "Decision failed.");
    }
  }

  async function parentReqAction(reqId: string, action: "consume" | "cancel" | "escalate" | "resubmit") {
    setPayNotice(null);
    try {
      await apiFetch(`/api/requests/${reqId}/${action}`, {
        method: "POST",
        body: action === "resubmit" ? JSON.stringify({ note: resubmitNotes[reqId] || "Confirmed payee in person" }) : "{}",
      });
      setPayNotice(`Request ${reqId} updated (${action}).`);
      await onRefresh();
    } catch (err) {
      setPayNotice(err instanceof Error ? err.message : "Request update failed.");
    }
  }

  async function handleSafeWord(action: "set" | "verify") {
    setSafeWordMsg(null);
    try {
      const res = await apiFetch<{ message?: string }>(`/api/safeword/${action}`, {
        method: "POST",
        body: JSON.stringify({ safeWord: safeWordInput }),
      });
      setSafeWordMsg(res.message || "Safe word saved (salted scrypt hash only).");
      setSafeWordInput("");
      await onRefresh();
    } catch (err) {
      setSafeWordMsg(err instanceof Error ? err.message : "Safe word check failed.");
    }
  }

  async function createInvite(isSecondary: boolean) {
    setLinkMsg(null);
    try {
      const res = await apiFetch<{ inviteCode: string }>("/api/links/invite", {
        method: "POST",
        body: JSON.stringify({ isSecondary }),
      });
      setInviteOut(res.inviteCode);
      await onRefresh();
    } catch (err) {
      setLinkMsg(err instanceof Error ? err.message : "Failed to create invite.");
    }
  }

  async function acceptInvite(e: React.FormEvent) {
    e.preventDefault();
    setLinkMsg(null);
    try {
      await apiFetch("/api/links/accept", {
        method: "POST",
        body: JSON.stringify({ inviteCode: acceptCode }),
      });
      setAcceptCode("");
      setLinkMsg("Linked to parent account.");
      await onRefresh();
    } catch (err) {
      setLinkMsg(err instanceof Error ? err.message : "Invalid invite code.");
    }
  }

  async function revokeLink(id: string) {
    await apiFetch(`/api/links/${id}/revoke`, { method: "POST" });
    await onRefresh();
  }

  async function toggleConsent(field: "text" | "galerts" | "gapprove" | "calls" | "paused", val: boolean) {
    if (!state.consent) return;
    setConsentMsg(null);
    await apiFetch("/api/privacy/consents", {
      method: "PUT",
      body: JSON.stringify({ ...state.consent, [field]: val }),
    });
    setConsentMsg("Consent settings updated.");
    await onRefresh();
  }

  async function exportMyData() {
    const data = await apiFetch<Record<string, unknown>>("/api/privacy/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guardian-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAllMyData() {
    await apiFetch("/api/privacy/data", { method: "DELETE" });
    onSignedOut();
  }

  async function activateLock() {
    setEppMsg(null);
    try {
      await apiFetch("/api/epp/lock/activate", {
        method: "POST",
        body: JSON.stringify({
          selectedPackages: ["UPI Apps", "NetBanking"],
          durationOption: lockDuration,
          explicitConsent: lockConsent,
        }),
      });
      setEpp(await apiFetch<EppDashboard>("/api/epp/dashboard"));
      setEppMsg("Emergency Payment Lock activated.");
    } catch (err) {
      setEppMsg(err instanceof Error ? err.message : "Could not activate lock.");
    }
  }

  async function unlockPaymentLock() {
    await apiFetch("/api/epp/lock/unlock", { method: "POST", body: "{}" });
    setEpp(await apiFetch<EppDashboard>("/api/epp/dashboard"));
    setEppMsg("Emergency Payment Lock unlocked.");
  }

  async function logBankAction(bankId: string) {
    await apiFetch("/api/epp/bank-action", {
      method: "POST",
      body: JSON.stringify({ bankId, serviceType: "upi_and_card_block" }),
    });
    setEppMsg("Bank helpline action recorded in audit trail.");
  }

  const inputCls =
    "w-full min-h-[42px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3.5 py-2 text-sm text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]";
  const primaryBtn =
    "gm-gold-btn min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 active:scale-[0.98]";
  const secondaryBtn =
    "min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/85 text-xs font-semibold text-[#AEBBC9] hover:border-[#E6C98A] hover:text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap shrink-0";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionReveal}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Payment Assessment & Approval Queue */}
        <div className="lg:col-span-7 space-y-6">
          {isParent && (
            <div className="gm-glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <CheckSquare className="w-5 h-5 text-[#E6C98A]" />
                <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight">
                  {lang === "hi"
                    ? "भुगतान सुरक्षा व अभिभावक अनुमोदन जांच"
                    : "Payment Safety & Guardian Approval Check"}
                </h2>
              </div>

              <form onSubmit={submitPaymentForReview} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-[#E6C98A] mb-1">
                    {lang === "hi" ? "राशि (₹)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`${inputCls} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#E6C98A] mb-1">
                    {lang === "hi" ? "लाभार्थी / UPI ID" : "Beneficiary / UPI ID"}
                  </label>
                  <input
                    type="text"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <button type="submit" className={`${primaryBtn} py-2.5`}>
                  {lang === "hi" ? "जांचें व भेजें" : "Assess & Request"}
                </button>
              </form>

              <label className="mt-3 inline-flex items-center gap-2 text-xs text-[#AEBBC9] cursor-pointer">
                <input
                  type="checkbox"
                  checked={knownPayee}
                  onChange={(e) => setKnownPayee(e.target.checked)}
                  className="rounded border-[#C6A15B]/40 accent-[#C6A15B]"
                />
                {lang === "hi"
                  ? "मैंने इस व्यक्ति/व्यापारी को पहले सुरक्षित रूप से भुगतान किया है"
                  : "I have paid this person/merchant safely before"}
              </label>

              {payNotice && (
                <p className="mt-3 text-xs font-medium text-[#E6C98A]">{payNotice}</p>
              )}
            </div>
          )}

          {/* Approval Queue */}
          <div className="gp-card rounded-2xl p-6">
            <h2 className="font-display text-base font-bold text-[#F4F0E6] tracking-tight mb-1">
              {lang === "hi" ? "एकल-उपयोग अभिभावक अनुमोदन कतार" : "Single-Use Guardian Approval Queue"}
            </h2>
            <p className="text-xs text-[#AEBBC9] mb-4">
              {lang === "hi"
                ? "अनुरोध 15 मिनट में समाप्त हो जाते हैं और केवल एक बार उपयोग किए जा सकते हैं।"
                : "Requests expire in 15 minutes and can only be consumed once."}
            </p>

            {state.reqs.length === 0 ? (
              <EmptyStateCard
                compact
                title={lang === "hi" ? "कोई लंबित अनुमोदन नहीं" : "No Payment Review Requests"}
                description={
                  lang === "hi"
                    ? "उच्च-जोखिम भुगतान जांच और अभिभावक अनुमोदन अनुरोध यहां दिखेंगे।"
                    : "High-risk payment checks and guardian review requests will appear here."
                }
              />
            ) : (
              <div className="divide-y divide-[#C6A15B]/15">
                {state.reqs.slice(0, 8).map((r) => (
                  <div key={r.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#F4F0E6] font-mono tabular-nums">
                          ₹{r.amt.toLocaleString("en-IN")} · {r.ben}
                        </p>
                        <p className="text-xs text-[#AEBBC9]">
                          {r.parentName ? `${r.parentName} · ` : ""}
                          {r.level} · Status: {r.st}
                          {r.escalatedToSecondary ? " · Escalated" : ""}
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#E6C98A]">
                        {r.st === "pending"
                          ? `Expires ${new Date(r.exp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : r.id}
                      </span>
                    </div>

                    {r.sig.length > 0 && (
                      <p className="text-xs text-[#AEBBC9]">{r.sig.join(" · ")}</p>
                    )}

                    {/* Guardian Controls */}
                    {!isParent && r.st === "pending" && (
                      <div className="pt-1 space-y-2">
                        {r.level !== "LOW" && (
                          <label className="flex items-center gap-2 text-xs text-[#AEBBC9] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(callbackChecked[r.id])}
                              onChange={(e) => setCallbackChecked((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                              className="accent-[#C6A15B]"
                            />
                            {lang === "hi"
                              ? "मैंने माता-पिता को उनके सहेजे गए नंबर पर कॉल करके पुष्टि कर ली है"
                              : "I called the parent on their saved number and confirmed this payment"}
                          </label>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => guardianDecide(r.id, "approved")}
                            className="gm-gold-btn min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {lang === "hi" ? "स्वीकृत करें" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => guardianDecide(r.id, "verification_requested")}
                            className={secondaryBtn}
                          >
                            {lang === "hi" ? "सत्यापन मांगें" : "Request Verification"}
                          </button>
                          <button
                            type="button"
                            onClick={() => guardianDecide(r.id, "rejected")}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#E87575]/45 bg-[#2E1219] text-xs font-semibold text-[#E87575] hover:border-[#E87575] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {lang === "hi" ? "अस्वीकार करें" : "Reject"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Parent Controls */}
                    {isParent && (
                      <div className="flex flex-wrap items-center gap-2">
                        {r.st === "approved" && (
                          <button
                            type="button"
                            onClick={() => parentReqAction(r.id, "consume")}
                            className={primaryBtn}
                          >
                            {lang === "hi"
                              ? "आगे बढ़ें (एकल-उपयोग टोकन उपयोग)"
                              : "Proceed (Consume Single-Use Token)"}
                          </button>
                        )}
                        {r.st === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => parentReqAction(r.id, "escalate")}
                              className={secondaryBtn}
                            >
                              {lang === "hi" ? "द्वितीयक को भेजें" : "Escalate to Secondary"}
                            </button>
                            <button
                              type="button"
                              onClick={() => parentReqAction(r.id, "cancel")}
                              className={secondaryBtn}
                            >
                              {lang === "hi" ? "रद्द करें" : "Cancel"}
                            </button>
                          </>
                        )}
                        {r.st === "verification_requested" && (
                          <div className="flex w-full gap-2 mt-1">
                            <input
                              type="text"
                              value={resubmitNotes[r.id] || ""}
                              onChange={(e) => setResubmitNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                              placeholder="Verification note (e.g. Spoke with Ananya)"
                              className="flex-1 rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3 py-1.5 text-xs text-[#F4F0E6] placeholder:text-[#AEBBC9]/60 focus:outline-none focus:border-[#E6C98A]"
                            />
                            <button
                              type="button"
                              onClick={() => parentReqAction(r.id, "resubmit")}
                              className={primaryBtn}
                            >
                              {lang === "hi" ? "पुनः भेजें" : "Resubmit"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Account & Security, Safe Word, Family Links, Privacy Consents, EPP */}
        <div className="lg:col-span-5 space-y-6">
          {/* Account & Security (Profile & Settings Logout Section) */}
          <div className="gp-card rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {state.user.profilePicture ? (
                  <img
                    src={state.user.profilePicture}
                    alt={state.user.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-xl object-cover border border-[#C6A15B]/60 shrink-0 shadow-[0_0_16px_-4px_rgba(198,161,91,0.4)]"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-[#E6C98A]" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
                    {lang === "hi" ? "खाता और प्रोफ़ाइल" : "Account & Profile"}
                  </h2>
                  <p className="text-xs text-[#AEBBC9] truncate">
                    {state.user.name} · @{state.user.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile((v) => !v);
                  setProfileMsg(null);
                }}
                className={secondaryBtn}
              >
                {editingProfile
                  ? lang === "hi"
                    ? "बंद करें"
                    : "Cancel"
                  : lang === "hi"
                    ? "प्रोफ़ाइल संपादित करें"
                    : "Edit Profile"}
              </button>
            </div>

            {editingProfile && (
              <form
                onSubmit={saveProfile}
                className="p-4 rounded-xl border border-[#C6A15B]/25 bg-[#071525]/70 space-y-3"
              >
                <div>
                  <label
                    htmlFor="profile-edit-name"
                    className="block text-xs font-semibold text-[#E6C98A] mb-1"
                  >
                    {lang === "hi" ? "पूरा नाम" : "Full Name"}
                  </label>
                  <input
                    id="profile-edit-name"
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-edit-gender"
                    className="block text-xs font-semibold text-[#E6C98A] mb-1"
                  >
                    {lang === "hi" ? "लिंग (वैकल्पिक)" : "Gender (Optional)"}
                  </label>
                  <select
                    id="profile-edit-gender"
                    value={profileGender}
                    onChange={(e) => setProfileGender(e.target.value as "" | UserGender)}
                    className={inputCls}
                  >
                    <option value="">
                      {lang === "hi" ? "-- चुना नहीं गया --" : "-- Not specified --"}
                    </option>
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
                  fallbackName={profileName || state.user.name}
                />
                <button type="submit" disabled={profileSaving} className={`${primaryBtn} w-full`}>
                  {profileSaving
                    ? lang === "hi"
                      ? "सहेजा जा रहा है..."
                      : "Saving..."
                    : lang === "hi"
                      ? "प्रोफ़ाइल सहेजें"
                      : "Save Profile"}
                </button>
              </form>
            )}

            {profileMsg && (
              <p className="text-xs font-medium text-[#43C6A5]">{profileMsg}</p>
            )}

            <p className="text-xs text-[#AEBBC9] leading-relaxed">
              {lang === "hi"
                ? "लॉग आउट करने से केवल आपका वर्तमान सत्र सुरक्षित रूप से समाप्त होता है। आपका खाता, परिवार लिंक और सहेजी गई रिपोर्ट डेटाबेस में सुरक्षित रहती हैं।"
                : "Logging out securely ends your current session only. Your account, family links, and saved safety reports stay preserved."}
            </p>

            <button
              type="button"
              onClick={() => setLogoutDialogOpen(true)}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#10243A] hover:bg-[#252A32] text-[#F4F0E6] border border-[#C6A15B]/35 hover:border-[#E6C98A] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4 text-[#E6C98A]" />
              {lang === "hi" ? "लॉग आउट करें" : "Log Out"}
            </button>
          </div>

          {/* Saved Banks & Emergency Helpline Preferences */}
          <BankPreferencesPanel state={state} lang={lang} onRefresh={onRefresh} />

          {/* Family Safe Word */}
          {isParent && (
            <div className="gp-card rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#E6C98A]" />
                <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
                  {lang === "hi"
                    ? `परिवार सेफ़ वर्ड (${state.hasSafeWord ? "सेट है" : "सेट नहीं"})`
                    : `Family Safe Word (${state.hasSafeWord ? "Configured" : "Not Set"})`}
                </h2>
              </div>
              <p className="text-xs text-[#AEBBC9]">
                {lang === "hi"
                  ? "संदिग्ध वॉइस-क्लोन या आपातकालीन परिवार कॉल की पुष्टि करें। केवल हैश रूप में सुरक्षित।"
                  : "Verify unexpected voice-cloning or urgent family calls. Stored only as a salted scrypt hash."}
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={safeWordInput}
                  onChange={(e) => setSafeWordInput(e.target.value)}
                  placeholder={lang === "hi" ? "6+ अक्षर" : "6+ chars with letters"}
                  className={inputCls}
                />
                <button type="button" onClick={() => handleSafeWord("set")} className={secondaryBtn}>
                  {lang === "hi" ? "सहेजें" : "Save"}
                </button>
                <button type="button" onClick={() => handleSafeWord("verify")} className={primaryBtn}>
                  {lang === "hi" ? "सत्यापित करें" : "Verify"}
                </button>
              </div>
              {safeWordMsg && (
                <p className="text-xs font-medium text-[#E6C98A]">{safeWordMsg}</p>
              )}
            </div>
          )}

          {/* Guardian Linking */}
          <div className="gp-card rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
              {isParent
                ? lang === "hi"
                  ? "अभिभावक आमंत्रण व लिंक"
                  : "Guardian Invite & Access Links"
                : lang === "hi"
                  ? "माता-पिता आमंत्रण स्वीकारें"
                  : "Accept Parent Invitation"}
            </h2>
            {isParent ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => createInvite(false)} className={primaryBtn}>
                    {lang === "hi" ? "प्राथमिक आमंत्रण बनाएं" : "Create Primary Invite"}
                  </button>
                  <button type="button" onClick={() => createInvite(true)} className={secondaryBtn}>
                    {lang === "hi" ? "द्वितीयक आमंत्रण बनाएं" : "Create Secondary Invite"}
                  </button>
                </div>
                {inviteOut && (
                  <p className="text-xs font-mono bg-[#071525]/85 p-3 rounded-xl border border-[#C6A15B]/45 text-[#F4F0E6]">
                    Share invite code: <strong className="text-[#E6C98A]">{inviteOut}</strong>
                  </p>
                )}
                <div className="divide-y divide-[#C6A15B]/15">
                  {(state.links || []).map((l) => (
                    <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="text-[#AEBBC9]">
                        <span className="font-mono text-[#F4F0E6]">{l.invite_code}</span> ·{" "}
                        {l.guardian_name || "Pending"} ({l.status})
                      </div>
                      {l.status !== "revoked" && (
                        <button
                          type="button"
                          onClick={() => revokeLink(l.id)}
                          className="text-[#E87575] hover:underline font-medium cursor-pointer"
                        >
                          {lang === "hi" ? "हटाएं" : "Revoke"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={acceptInvite} className="flex gap-2">
                <input
                  type="text"
                  value={acceptCode}
                  onChange={(e) => setAcceptCode(e.target.value)}
                  placeholder="Enter invite code (INV-XXXXXX)"
                  className={`${inputCls} font-mono text-xs`}
                />
                <button type="submit" className={primaryBtn}>
                  {lang === "hi" ? "जोड़ें" : "Link"}
                </button>
              </form>
            )}
            {linkMsg && <p className="text-xs font-medium text-[#E6C98A]">{linkMsg}</p>}
          </div>

          {/* Privacy & Consent Controls */}
          {isParent && state.consent && (
            <div className="gp-card rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
                {lang === "hi" ? "गोपनीयता व डेटा नियंत्रण" : "Privacy & Data Controls"}
              </h2>
              <div className="space-y-2 text-xs">
                {(
                  [
                    [
                      "text",
                      lang === "hi"
                        ? "स्कैम संकेतों के लिए संदेश पाठ की जांच करें"
                        : "Analyze message text for scam signals",
                    ],
                    [
                      "galerts",
                      lang === "hi"
                        ? "जुड़े अभिभावकों के साथ उच्च-जोखिम अलर्ट साझा करें"
                        : "Share high-risk alerts with linked guardians",
                    ],
                    [
                      "gapprove",
                      lang === "hi"
                        ? "जोखिम भरे भुगतान के लिए अभिभावक अनुमोदन आवश्यक करें"
                        : "Require guardian approval for risky payments",
                    ],
                    [
                      "calls",
                      lang === "hi"
                        ? "कॉल-भुगतान समय सुरक्षा सक्षम करें (कोई ऑडियो नहीं)"
                        : "Enable call-payment timing watch (no audio)",
                    ],
                    [
                      "paused",
                      lang === "hi"
                        ? "सभी निगरानी अस्थायी रूप से रोकें"
                        : "Pause all monitoring temporarily",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                    <span className="text-[#AEBBC9]">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(state.consent?.[key])}
                      onChange={(e) => toggleConsent(key, e.target.checked)}
                      className="accent-[#C6A15B]"
                    />
                  </label>
                ))}
              </div>
              {consentMsg && (
                <p className="text-xs font-medium text-[#43C6A5]">{consentMsg}</p>
              )}

              <div className="pt-3 border-t border-[#C6A15B]/20 flex flex-wrap gap-2">
                <button type="button" onClick={exportMyData} className={secondaryBtn}>
                  <Download className="w-3.5 h-3.5 text-[#E6C98A]" />
                  {lang === "hi" ? "JSON निर्यात करें" : "Export JSON"}
                </button>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E87575]/45 bg-[#2E1219] text-xs font-semibold text-[#E87575] hover:border-[#E87575] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {lang === "hi" ? "सभी डेटा हटाएं" : "Delete All Data"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={deleteAllMyData}
                    className="gm-emergency-btn min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {lang === "hi" ? "स्थायी विलोपन की पुष्टि करें" : "Confirm Permanent Delete"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Emergency Payment Lock & Bank Directory */}
          <div className="gp-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldOff className="w-4 h-4 text-[#E87575]" />
                <h2 className="font-display text-sm font-semibold text-[#F4F0E6]">
                  {lang === "hi" ? "आपातकालीन भुगतान सुरक्षा" : "Emergency Payment Protection"}
                </h2>
              </div>
              <span
                className={`text-xs font-semibold ${
                  epp?.activeLock ? "text-[#E87575]" : "text-[#43C6A5]"
                }`}
              >
                {epp?.activeLock
                  ? lang === "hi"
                    ? "लॉक सक्रिय"
                    : "Lock Active"
                  : lang === "hi"
                    ? "अनलॉक"
                    : "Unlocked"}
              </span>
            </div>

            {epp?.activeLock ? (
              <div className="p-3.5 rounded-xl bg-[#2E1219] border border-[#E87575]/45 text-xs space-y-2.5">
                <p className="font-medium text-[#E87575]">
                  Emergency payment guard active ({epp.activeLock.duration_option}) until{" "}
                  {new Date(epp.activeLock.expires_at).toLocaleTimeString()}.
                </p>
                <button
                  type="button"
                  onClick={unlockPaymentLock}
                  className={primaryBtn}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5" />
                    {lang === "hi" ? "भुगतान गार्ड अनलॉक करें" : "Unlock Payment Guard"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <select
                    value={lockDuration}
                    onChange={(e) => setLockDuration(e.target.value)}
                    className="min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3 py-1.5 text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
                  >
                    <option value="30m">30 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="24h">24 hours</option>
                  </select>
                  <button
                    type="button"
                    onClick={activateLock}
                    className="gm-emergency-btn min-h-[40px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {lang === "hi" ? "लॉक सक्रिय करें" : "Activate Lock"}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[#AEBBC9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockConsent}
                    onChange={(e) => setLockConsent(e.target.checked)}
                    className="accent-[#E87575]"
                  />
                  {lang === "hi"
                    ? "पुष्टि करें कि संदिग्ध स्कैम के दौरान भुगतान रोकना है"
                    : "Confirm I want to pause payment actions during a suspected scam"}
                </label>
              </div>
            )}

            {eppMsg && <p className="text-xs font-medium text-[#E6C98A]">{eppMsg}</p>}

            {/* Emergency Bank Call & Lost Phone Quick Triggers */}
            <div className="pt-3 border-t border-[#C6A15B]/20 flex flex-col gap-2">
              <EmergencyCallButton
                compact
                lang={lang}
                primaryBankName={primaryBank?.shortCode || null}
                className="w-full"
                onClick={() =>
                  openEmergencyCall({
                    source: "epp",
                    reason:
                      lang === "hi"
                        ? "आपातकालीन वित्तीय सुरक्षा — बैंक से तुरंत सहायता"
                        : "Emergency financial protection — immediate bank verification & account freeze",
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  openEmergencyCall({
                    source: "lost_phone",
                    threatCategory: "Lost / Stolen Phone",
                    riskLevel: "HIGH RISK",
                    reason:
                      lang === "hi"
                        ? "फ़ोन गुम या चोरी — बैंक कार्ड, UPI और सिम तुरंत सुरक्षित करें"
                        : "Phone lost or stolen — immediately block UPI, debit cards, and IMEI",
                    suggestedAction:
                      "My registered mobile phone was lost or stolen. Please freeze UPI, mobile banking, and ATM/debit cards immediately.",
                    suggestedActionHi:
                      "मेरा पंजीकृत मोबाइल फ़ोन गुम या चोरी हो गया है। कृपया तुरंत UPI, मोबाइल बैंकिंग और डेबिट कार्ड ब्लॉक करें।",
                  })
                }
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E87575]/45 bg-[#2E1219] text-xs font-semibold text-[#E87575] hover:border-[#E87575] transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                {lang === "hi" ? "गुम या चोरी फ़ोन आपातकाल" : "Lost or Stolen Phone Emergency"}
              </button>
            </div>

            <div className="pt-3 border-t border-[#C6A15B]/20 space-y-2">
              <p className="text-xs font-semibold text-[#E6C98A]">
                {lang === "hi" ? "आधिकारिक बैंक ब्लॉक हेल्पलाइन" : "Official Bank Blocking Helplines"}
              </p>
              {(epp?.banks || []).slice(0, 6).map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <div className="min-w-0">
                    <p className="font-medium text-[#F4F0E6] truncate">{b.bank_name}</p>
                    <p className="text-[#AEBBC9] font-mono tabular-nums text-[11px]">
                      {b.fraud_phone ? `Fraud: ${b.fraud_phone} · ` : ""}Care: {b.support_phone}
                      {b.last_verified_date ? ` · ${b.last_verified_date}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(b.upi_block_url || b.official_website) && (
                      <a
                        href={b.upi_block_url || b.official_website || "https://cybercrime.gov.in/"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => logBankAction(b.id)}
                        className={secondaryBtn}
                      >
                        <Phone className="w-3 h-3 text-[#E6C98A]" />
                        {lang === "hi" ? "पोर्टल" : "Portal"}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {logoutDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className="fixed inset-0 z-50 bg-[#071525]/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="gm-glass-card rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 text-[#F4F0E6]">
                <div className="w-9 h-9 rounded-xl bg-[#252A32] border border-[#C6A15B]/45 flex items-center justify-center shrink-0">
                  <LogOut className="w-4 h-4 text-[#E6C98A]" />
                </div>
                <h2 id="logout-confirm-title" className="font-display text-base font-bold">
                  {lang === "hi" ? "क्या आप वाकई लॉग आउट करना चाहते हैं?" : "Are you sure you want to log out?"}
                </h2>
              </div>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutDialogOpen(false)}
                aria-label={lang === "hi" ? "संवाद बंद करें" : "Close logout dialog"}
                className="text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#AEBBC9] leading-relaxed">
              {lang === "hi"
                ? "यह केवल आपका सक्रिय सत्र समाप्त करेगा और आपको साइन-इन पृष्ठ पर वापस ले जाएगा। आपका खाता और सहेजे गए सुरक्षा लॉग सुरक्षित रहेंगे।"
                : "This will terminate your active session and return you to the sign-in screen. Your account and saved safety reports remain untouched."}
            </p>

            <div className="flex flex-wrap justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutDialogOpen(false)}
                className={secondaryBtn}
              >
                {lang === "hi" ? "रद्द करें" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  try {
                    await onLogout();
                  } finally {
                    setLoggingOut(false);
                    setLogoutDialogOpen(false);
                  }
                }}
                className={primaryBtn}
              >
                <span className="inline-flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  {loggingOut
                    ? lang === "hi"
                      ? "लॉग आउट हो रहा है..."
                      : "Logging out..."
                    : lang === "hi"
                      ? "लॉग आउट"
                      : "Log Out"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
