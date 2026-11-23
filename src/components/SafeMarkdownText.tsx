import React from "react";

interface SafeMarkdownTextProps {
  text: string;
  className?: string;
}

function renderInlineFormatting(line: string, keyPrefix: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[#F4F0E6]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="px-1 py-0.5 rounded bg-[#071525] border border-[#C6A15B]/30 font-mono text-[11px] text-[#E6C98A]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

export const SafeMarkdownText: React.FC<SafeMarkdownTextProps> = ({ text, className = "" }) => {
  const lines = String(text || "").split(/\r?\n/);

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={`sp-${idx}`} className="h-1" />;
        }
        const bulletMatch = /^[-*•]\s+(.*)$/.exec(line);
        if (bulletMatch) {
          return (
            <div key={`bl-${idx}`} className="flex items-start gap-2 pl-1">
              <span className="text-[#E6C98A] font-bold mt-0.5 shrink-0">•</span>
              <span>{renderInlineFormatting(bulletMatch[1], `bl-${idx}`)}</span>
            </div>
          );
        }
        const numMatch = /^(\d+[.)])\s+(.*)$/.exec(line);
        if (numMatch) {
          return (
            <div key={`nm-${idx}`} className="flex items-start gap-2 pl-1">
              <span className="text-[#E6C98A] font-mono font-bold shrink-0">{numMatch[1]}</span>
              <span>{renderInlineFormatting(numMatch[2], `nm-${idx}`)}</span>
            </div>
          );
        }
        return <p key={`p-${idx}`}>{renderInlineFormatting(line, `p-${idx}`)}</p>;
      })}
    </div>
  );
};
