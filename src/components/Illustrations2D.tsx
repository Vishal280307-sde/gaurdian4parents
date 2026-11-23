import React from "react";

export interface Illustration2DProps {
  className?: string;
  title?: string;
}

function a11yProps(title?: string) {
  return title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const);
}

/** 1. Family Protection — Shield encompassing senior parent + guardian figures */
export const FamilyProtection2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    <circle cx="60" cy="60" r="42" fill="#071525" stroke="#C6A15B" strokeOpacity="0.2" strokeWidth="1.5" strokeDasharray="4 4" />
    {/* Outer protective shield */}
    <path
      d="M60 18L92 30V56C92 76.5 78.4 92.6 60 100C41.6 92.6 28 76.5 28 56V30L60 18Z"
      fill="#172F4B"
      stroke="#E6C98A"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M60 24L86 34V55.5C86 72.5 74.8 86 60 92.5C45.2 86 34 72.5 34 55.5V34L60 24Z"
      fill="#071525"
      fillOpacity="0.7"
    />
    {/* Parent figure (center-left) */}
    <circle cx="51" cy="49" r="7.5" fill="#E6C98A" />
    <path d="M39 73C39 65.8 44.4 60 51 60C57.6 60 63 65.8 63 73V76H39V73Z" fill="#C6A15B" />
    {/* Guardian figure (right) */}
    <circle cx="71" cy="52" r="6" fill="#43C6A5" />
    <path d="M61 74C61 68 65.5 63.5 71 63.5C76.5 63.5 81 68 81 74V76H61V74Z" fill="#2A8F77" />
    {/* Verified pulse badge */}
    <circle cx="88" cy="84" r="11" fill="#0B2825" stroke="#43C6A5" strokeWidth="2" />
    <path d="M83.5 84L86.6 87.1L92.8 80.9" stroke="#43C6A5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 2. Cybersecurity — Multi-layer geometric shield + digital lock */
export const Cybersecurity2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Circuit accent tracks */}
    <path d="M22 44H34M22 60H30M22 76H34M98 44H86M98 60H90M98 76H86" stroke="#6CC4E8" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
    <circle cx="20" cy="44" r="2.5" fill="#6CC4E8" />
    <circle cx="20" cy="76" r="2.5" fill="#43C6A5" />
    <circle cx="100" cy="44" r="2.5" fill="#43C6A5" />
    <circle cx="100" cy="76" r="2.5" fill="#6CC4E8" />
    {/* Shield */}
    <path
      d="M60 20L88 30.5V56C88 74.5 76 89.5 60 97C44 89.5 32 74.5 32 56V30.5L60 20Z"
      fill="#071525"
      stroke="#C6A15B"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Padlock body */}
    <path d="M49 52V45C49 38.9 53.9 34 60 34C66.1 34 71 38.9 71 45V52" stroke="#E6C98A" strokeWidth="3.5" strokeLinecap="round" />
    <rect x="44" y="51" width="32" height="24" rx="6" fill="#252A32" stroke="#E6C98A" strokeWidth="2" />
    <circle cx="60" cy="61" r="3.5" fill="#43C6A5" />
    <path d="M60 64.5V69" stroke="#43C6A5" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** 3. QR Scam — Framed QR matrix with scanner sweep & threat check badge */
export const QrScam2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Viewfinder brackets */}
    <path d="M26 40V28H38M82 28H94V40M26 80V92H38M82 92H94V80" stroke="#E6C98A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {/* QR blocks */}
    <rect x="36" y="36" width="18" height="18" rx="3" stroke="#F4F0E6" strokeWidth="2.5" fill="#071525" />
    <rect x="41" y="41" width="8" height="8" rx="1.5" fill="#C6A15B" />
    <rect x="66" y="36" width="18" height="18" rx="3" stroke="#F4F0E6" strokeWidth="2.5" fill="#071525" />
    <rect x="71" y="41" width="8" height="8" rx="1.5" fill="#C6A15B" />
    <rect x="36" y="66" width="18" height="18" rx="3" stroke="#F4F0E6" strokeWidth="2.5" fill="#071525" />
    <rect x="41" y="71" width="8" height="8" rx="1.5" fill="#C6A15B" />
    {/* Data cells */}
    <rect x="66" y="66" width="7" height="7" rx="1.5" fill="#AEBBC9" />
    <rect x="77" y="66" width="7" height="7" rx="1.5" fill="#6CC4E8" />
    <rect x="66" y="77" width="7" height="7" rx="1.5" fill="#6CC4E8" />
    <rect x="77" y="77" width="7" height="7" rx="1.5" fill="#AEBBC9" />
    {/* Active laser scan bar */}
    <line x1="26" y1="60" x2="94" y2="60" stroke="#43C6A5" strokeWidth="3" strokeLinecap="round" />
    <rect x="28" y="55" width="64" height="10" rx="5" fill="#43C6A5" fillOpacity="0.18" />
  </svg>
);

/** 4. Banking Security — Classical bank facade + gold protection seal */
export const BankingSecurity2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Bank Roof Pediment */}
    <path d="M60 22L92 39H28L60 22Z" fill="#252A32" stroke="#E6C98A" strokeWidth="2.2" strokeLinejoin="round" />
    <circle cx="60" cy="33" r="3" fill="#E6C98A" />
    {/* Pillars */}
    <rect x="34" y="43" width="8" height="34" rx="2" fill="#AEBBC9" />
    <rect x="50" y="43" width="8" height="34" rx="2" fill="#AEBBC9" />
    <rect x="66" y="43" width="8" height="34" rx="2" fill="#AEBBC9" />
    {/* Base */}
    <rect x="26" y="79" width="60" height="8" rx="2" fill="#C6A15B" />
    <rect x="22" y="88" width="68" height="6" rx="2" fill="#252A32" stroke="#C6A15B" strokeOpacity="0.4" />
    {/* Verified Shield Seal */}
    <path d="M84 54L99 60V73C99 83.5 92.2 91 84 95C75.8 91 69 83.5 69 73V60L84 54Z" fill="#0B2825" stroke="#43C6A5" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M78.5 74L82.2 77.7L89.8 70.1" stroke="#43C6A5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 5. Emergency Assistance — Beacon ring + helpline shield */
export const EmergencyAssistance2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#E87575" strokeOpacity="0.4" strokeWidth="2" />
    {/* Beacon pulse rings */}
    <circle cx="60" cy="60" r="42" stroke="#E87575" strokeOpacity="0.22" strokeWidth="2" />
    <circle cx="60" cy="60" r="32" stroke="#E87575" strokeOpacity="0.45" strokeWidth="2" />
    {/* Core beacon circle */}
    <circle cx="60" cy="60" r="23" fill="#2E1219" stroke="#E87575" strokeWidth="2.5" />
    {/* Phone receiver silhouette */}
    <path
      d="M50.5 47.5C49.6 47.5 48.8 48 48.4 48.8C47.2 51.3 47.7 56.2 51.6 62C55.5 67.8 60.4 70.6 63.3 70.8C64.2 70.9 65 70.4 65.4 69.6L67.4 65.5C67.8 64.7 67.5 63.7 66.7 63.2L63.1 61C62.4 60.6 61.5 60.8 61 61.4L59.7 63C57.6 61.9 55.6 59.8 54.4 57.6L56.1 56.3C56.7 55.8 56.9 54.9 56.5 54.2L54.4 50.2C53.9 49.4 53.1 47.5 50.5 47.5Z"
      fill="#F4F0E6"
    />
    {/* Gold SOS shield accent */}
    <circle cx="88" cy="34" r="10" fill="#071525" stroke="#E6C98A" strokeWidth="2" />
    <path d="M88 29V35" stroke="#E6C98A" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="88" cy="39" r="1.4" fill="#E6C98A" />
  </svg>
);

/** 6. Guardian AI — Luminous geometric core + protective orbital ring */
export const GuardianAi2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.4" strokeWidth="2" />
    <circle cx="60" cy="60" r="38" stroke="#6CC4E8" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="5 5" />
    <circle cx="60" cy="60" r="28" fill="#071525" stroke="#C6A15B" strokeWidth="2.2" />
    {/* Four-point AI star */}
    <path
      d="M60 36C61.6 49.4 70.6 58.4 84 60C70.6 61.6 61.6 70.6 60 84C58.4 70.6 49.4 61.6 36 60C49.4 58.4 58.4 49.4 60 36Z"
      fill="#E6C98A"
    />
    <circle cx="60" cy="60" r="6" fill="#071525" />
    <circle cx="89" cy="31" r="4" fill="#43C6A5" />
    <circle cx="31" cy="89" r="3.5" fill="#6CC4E8" />
  </svg>
);

/** 7. Voice Assistant — Microphone capsule + dual acoustic waves */
export const VoiceAssistant2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.4" strokeWidth="2" />
    {/* Equalizer bars */}
    <rect x="24" y="52" width="5" height="16" rx="2.5" fill="#6CC4E8" fillOpacity="0.7" />
    <rect x="33" y="42" width="5" height="36" rx="2.5" fill="#43C6A5" />
    <rect x="82" y="42" width="5" height="36" rx="2.5" fill="#43C6A5" />
    <rect x="91" y="52" width="5" height="16" rx="2.5" fill="#6CC4E8" fillOpacity="0.7" />
    {/* Microphone capsule */}
    <rect x="49" y="28" width="22" height="36" rx="11" fill="#E6C98A" stroke="#071525" strokeWidth="2" />
    <path d="M55 40H65M55 47H65" stroke="#071525" strokeWidth="2" strokeLinecap="round" />
    {/* Mic cradle & stand */}
    <path d="M41 56C41 66.5 49.5 75 60 75C70.5 75 79 66.5 79 56" stroke="#F4F0E6" strokeWidth="3" strokeLinecap="round" />
    <path d="M60 75V88M48 88H72" stroke="#C6A15B" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** 8. Linked Guardians — Parent node safely bridged to trusted family nodes */
export const LinkedGuardians2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Connection lines */}
    <path d="M36 44L60 64L84 44M60 64V88" stroke="#43C6A5" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
    {/* Left Guardian Node */}
    <circle cx="34" cy="42" r="13" fill="#071525" stroke="#E6C98A" strokeWidth="2.2" />
    <circle cx="34" cy="39" r="4" fill="#E6C98A" />
    <path d="M26.5 49C26.5 45.8 29.8 44 34 44C38.2 44 41.5 45.8 41.5 49" stroke="#E6C98A" strokeWidth="2" strokeLinecap="round" />
    {/* Right Guardian Node */}
    <circle cx="86" cy="42" r="13" fill="#071525" stroke="#6CC4E8" strokeWidth="2.2" />
    <circle cx="86" cy="39" r="4" fill="#6CC4E8" />
    <path d="M78.5 49C78.5 45.8 81.8 44 86 44C90.2 44 93.5 45.8 93.5 49" stroke="#6CC4E8" strokeWidth="2" strokeLinecap="round" />
    {/* Center Parent Shield Node */}
    <circle cx="60" cy="68" r="16" fill="#252A32" stroke="#43C6A5" strokeWidth="2.5" />
    <path d="M53.5 68L58 72.5L67 63.5" stroke="#43C6A5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    {/* Bottom Lock badge */}
    <rect x="52" y="84" width="16" height="12" rx="3" fill="#C6A15B" />
  </svg>
);

/** 9. Cyber Awareness — Open safety handbook + verified inspection star */
export const CyberAwareness2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Open Guidebook */}
    <path d="M24 36C24 32.7 26.7 30 30 30H56C58.2 30 60 31.8 60 34V86C60 83.8 58.2 82 56 82H30C26.7 82 24 79.3 24 76V36Z" fill="#071525" stroke="#E6C98A" strokeWidth="2.2" />
    <path d="M96 36C96 32.7 93.3 30 90 30H64C61.8 30 60 31.8 60 34V86C60 83.8 61.8 82 64 82H90C93.3 82 96 79.3 96 76V36Z" fill="#071525" stroke="#E6C98A" strokeWidth="2.2" />
    {/* Text lines */}
    <path d="M33 44H50M33 53H48M33 62H51M70 44H87M70 53H85" stroke="#AEBBC9" strokeWidth="2.5" strokeLinecap="round" />
    {/* Magnifier check */}
    <circle cx="80" cy="68" r="11" fill="#0B2825" stroke="#43C6A5" strokeWidth="2.2" />
    <path d="M75.5 68L78.5 71L84.8 64.7" stroke="#43C6A5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 10. Financial Protection — Payment card guarded by golden shield */
export const FinancialProtection2D: React.FC<Illustration2DProps> = ({
  className = "w-20 h-20",
  title,
}) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} {...a11yProps(title)}>
    <rect x="6" y="6" width="108" height="108" rx="28" fill="#10243A" stroke="#C6A15B" strokeOpacity="0.35" strokeWidth="2" />
    {/* Payment Card */}
    <rect x="22" y="34" width="66" height="44" rx="8" fill="#071525" stroke="#C6A15B" strokeWidth="2.2" />
    <rect x="22" y="44" width="66" height="9" fill="#252A32" />
    <rect x="30" y="60" width="16" height="10" rx="2.5" fill="#E6C98A" />
    <path d="M52 65H72" stroke="#AEBBC9" strokeWidth="2.5" strokeLinecap="round" />
    {/* Shield Overlay */}
    <path
      d="M84 52L99 58V72C99 82.8 92.4 90.4 84 94.5C75.6 90.4 69 82.8 69 72V58L84 52Z"
      fill="#0B2825"
      stroke="#43C6A5"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M78.5 73.5L82.3 77.3L89.8 69.8" stroke="#43C6A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
