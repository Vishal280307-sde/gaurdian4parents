import React, { useState } from "react";

interface VisualAssetProps {
  src: string;
  alt: string;
  caption?: string;
  lazy?: boolean;
  className?: string;
  imgClassName?: string;
}

export const VisualAsset: React.FC<VisualAssetProps> = ({
  src,
  alt,
  caption,
  lazy = true,
  className = "",
  imgClassName = "w-full h-full object-cover",
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-[#C6A15B]/30 bg-[#10243A]/85 shadow-[0_10px_28px_-14px_rgba(198,161,91,0.32)] ${className}`}
    >
      {failed ? (
        <div
          role="img"
          aria-label={alt}
          className="w-full h-full min-h-[96px] flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#071525] via-[#10243A] to-[#252A32] text-[#E6C98A]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 48 48"
            className="w-10 h-10 text-[#E6C98A]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M24 6l14 5.5v10.5c0 9.4-6 17.5-14 20.5C16 39.5 10 31.4 10 22V11.5L24 6z" />
            <path d="M18.5 24l3.8 3.8 7.2-7.6" />
          </svg>
          <span className="mt-2 text-[11px] font-medium text-[#F4F0E6] text-center line-clamp-2">
            {alt}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={imgClassName}
        />
      )}
      {caption && (
        <figcaption className="px-3 py-1.5 text-[11px] text-[#AEBBC9] bg-[#071525]/92 border-t border-[#C6A15B]/20">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

interface EmptyStateCardProps {
  title: string;
  description: string;
  compact?: boolean;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  title,
  description,
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-[#C6A15B]/25 bg-[#10243A]/75 backdrop-blur-md ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <VisualAsset
        src="/src/assets/images/gold_family_shield_1795443534490.jpg"
        alt={title}
        lazy={true}
        className={`${compact ? "w-20" : "w-24 sm:w-28"} aspect-square shrink-0`}
      />
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-sm font-semibold text-[#F4F0E6]">{title}</p>
        <p className="mt-1 text-xs text-[#AEBBC9] leading-relaxed">{description}</p>
      </div>
    </div>
  );
};
