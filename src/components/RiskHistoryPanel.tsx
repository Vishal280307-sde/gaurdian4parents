import React, { useState } from "react";
import { History, X, ChevronRight } from "lucide-react";
import type { LangCode, RiskHistoryRecord } from "../types/guardian";
import { SuspicionScoreCard } from "./SuspicionScoreCard";
import { SourceTransparencyPanel } from "./SourceTransparencyPanel";
import { EmptyStateCard } from "./VisualAsset";

interface RiskHistoryPanelProps {
  history: RiskHistoryRecord[];
  lang: LangCode;
  isParent: boolean;
}

export const RiskHistoryPanel: React.FC<RiskHistoryPanelProps> = ({ history, lang, isParent }) => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<RiskHistoryRecord | null>(null);

  const filtered = history.filter((item) => filterCategory === "all" || item.category === filterCategory);

  function getRiskTextClass(level: RiskHistoryRecord["riskLevel"]) {
    if (level === "HIGH") return "text-[#E87575]";
    if (level === "MODERATE") return "text-[#E6C98A]";
    return "text-[#43C6A5]";
  }

  return (
    <div className="gp-card rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-[#E6C98A]" />
          <div>
            <h2 className="text-sm font-semibold text-[#F4F0E6]">
              {lang === "hi" ? "जोखिम स्कोर इतिहास (सभी जांच)" : "Unified Risk History"}
            </h2>
            <p className="text-xs text-[#AEBBC9]">
              {isParent
                ? lang === "hi"
                  ? "QR, फ़ोन कॉल, साइबर सुरक्षा और URL जांच का पूर्ण संदेह स्कोर रिकॉर्ड।"
                  : "Persistent 0–100 suspicion scores across QR, phone calls, cyber safety checks, and URLs."
                : lang === "hi"
                  ? "जुड़े माता-पिता खातों की साझा जोखिम जांच (सहमति के अधीन)।"
                  : "Shared risk assessments for linked parent accounts (subject to consent)."}
            </p>
          </div>
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label={lang === "hi" ? "श्रेणी फ़िल्टर" : "Filter risk history by category"}
          className="rounded-xl border border-[#C6A15B]/30 bg-[#071525]/85 px-3 py-2 text-xs text-[#F4F0E6] focus:outline-none focus:border-[#E6C98A]"
        >
          <option value="all">{lang === "hi" ? "सभी श्रेणियां" : "All Categories"}</option>
          <option value="QR Intelligence">QR Intelligence</option>
          <option value="Phone Fraud Detection">Phone Fraud Detection</option>
          <option value="Personal Cyber Safety Check">Personal Cyber Safety Check</option>
          <option value="Website and URL Analysis">Website & URL Analysis</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyStateCard
          compact
          title={lang === "hi" ? "अभी कोई जोखिम इतिहास नहीं" : "No Risk History Recorded Yet"}
          description={
            lang === "hi"
              ? "QR, कॉल, साइबर सुरक्षा या लिंक जांच चलाने पर 0–100 स्कोर और साक्ष्य विवरण यहां सहेजे जाएंगे।"
              : "Run a QR inspection, phone screening, cyber check, or URL scan to view scored history here."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#C6A15B]/20 text-[#AEBBC9]">
                <th className="py-2.5 pr-3 font-semibold">{lang === "hi" ? "स्कोर व स्तर" : "Score & Risk"}</th>
                <th className="py-2.5 pr-3 font-semibold">{lang === "hi" ? "श्रेणी व पहचान" : "Category & Identifier"}</th>
                <th className="py-2.5 pr-3 font-semibold">{lang === "hi" ? "मुख्य कारण" : "Primary Reason"}</th>
                <th className="py-2.5 pr-3 font-semibold whitespace-nowrap">{lang === "hi" ? "समय" : "Time"}</th>
                <th className="py-2.5 text-right font-semibold">{lang === "hi" ? "विवरण" : "Details"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C6A15B]/15">
              {filtered.slice(0, 10).map((item) => (
                <tr key={item.id} className="hover:bg-[#10243A]/65 transition-colors">
                  <td className="py-3 pr-3 whitespace-nowrap">
                    <span className={`font-mono tabular-nums font-bold ${getRiskTextClass(item.riskLevel)}`}>
                      {item.score}/100 · {item.riskLevel}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-[#F4F0E6]">
                      {item.parentName ? `${item.parentName} · ` : ""}
                      {item.category}
                    </p>
                    <p className="font-mono text-[11px] text-[#AEBBC9] truncate max-w-[180px]">
                      {item.maskedIdentifier}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-[#AEBBC9] max-w-xs truncate">{item.mainReason}</td>
                  <td className="py-3 pr-3 font-mono tabular-nums text-[11px] text-[#E6C98A] whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(item)}
                      className="inline-flex items-center gap-1 font-semibold text-[#E6C98A] hover:underline cursor-pointer"
                    >
                      {lang === "hi" ? "समीक्षा करें" : "Review"}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071525]/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lang === "hi" ? "जोखिम स्कोर विवरण" : "Risk Assessment Details"}
        >
          <div className="gm-glass-card w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-[#C6A15B]/20 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#F4F0E6]">
                  {lang === "hi" ? "विस्तृत जोखिम विश्लेषण" : "Detailed Risk Assessment"}
                </h3>
                <p className="text-xs font-mono tabular-nums text-[#AEBBC9]">
                  {new Date(selectedEntry.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                aria-label={lang === "hi" ? "बंद करें" : "Close modal"}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-[#C6A15B]/30 text-[#AEBBC9] hover:border-[#E6C98A] hover:text-[#F4F0E6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedEntry.assessment ? (
              <>
                <SuspicionScoreCard assessment={selectedEntry.assessment} lang={lang} />
                <SourceTransparencyPanel sources={selectedEntry.assessment.sourcesChecked} lang={lang} />
              </>
            ) : (
              <p className="text-sm text-[#AEBBC9]">{selectedEntry.mainReason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
