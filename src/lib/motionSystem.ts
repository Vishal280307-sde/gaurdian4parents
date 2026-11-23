import type { Variants } from "motion/react";

export const GUARDIAN_EASE = [0.16, 1, 0.3, 1] as const;

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: GUARDIAN_EASE,
    },
  },
};

export const cardSettle: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      delay: Math.min(index * 0.03, 0.12),
      ease: GUARDIAN_EASE,
    },
  }),
};
