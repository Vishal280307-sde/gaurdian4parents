import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeableCardDeckProps {
  children: React.ReactNode[];
  ariaLabel: string;
  itemClassName?: string;
  desktopGridClassName?: string;
}

export const SwipeableCardDeck: React.FC<SwipeableCardDeckProps> = ({
  children,
  ariaLabel,
  itemClassName = "w-[84vw] max-w-[330px] shrink-0 snap-center",
  desktopGridClassName = "md:grid md:grid-cols-3 md:gap-4",
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = React.Children.count(children);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const childNodes = Array.from(el.children) as HTMLElement[];
      if (childNodes.length === 0) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let closestIdx = 0;
      let minDist = Infinity;
      childNodes.forEach((node, idx) => {
        const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
        const dist = Math.abs(nodeCenter - center);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });
      setActiveIndex(closestIdx);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [total]);

  function scrollToIndex(idx: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(total - 1, idx));
    const target = el.children[clamped] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setActiveIndex(clamped);
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Android touch-friendly swipe row below md, normal grid on md+ */}
      <div
        ref={scrollerRef}
        role="region"
        aria-label={ariaLabel}
        style={{ touchAction: "pan-x pan-y" }}
        className={`flex md:block overflow-x-auto snap-x snap-mandatory gap-3.5 pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible no-scrollbar ${desktopGridClassName}`}
      >
        {React.Children.map(children, (child, idx) => (
          <div key={idx} className={`${itemClassName} md:w-auto md:max-w-none`}>
            {child}
          </div>
        ))}
      </div>

      {/* Pagination dots + prev/next tap affordance (visible on mobile/tablet swipe) */}
      {total > 1 && (
        <div className="flex md:hidden items-center justify-center gap-3 pt-0.5">
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous card"
            className="min-w-[36px] min-h-[36px] rounded-full border border-[#C6A15B]/30 bg-[#10243A]/85 text-[#E6C98A] flex items-center justify-center disabled:opacity-35 cursor-pointer active:scale-[0.95]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: total }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === activeIndex
                    ? "w-6 bg-[#E6C98A]"
                    : "w-2 bg-[#C6A15B]/35 hover:bg-[#C6A15B]/60"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex >= total - 1}
            aria-label="Next card"
            className="min-w-[36px] min-h-[36px] rounded-full border border-[#C6A15B]/30 bg-[#10243A]/85 text-[#E6C98A] flex items-center justify-center disabled:opacity-35 cursor-pointer active:scale-[0.95]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
