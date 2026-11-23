export type ScamAwarenessId =
  | "qr_scam"
  | "upi_scam"
  | "customer_care"
  | "otp_scam"
  | "screen_share"
  | "phishing"
  | "fake_bank_call"
  | "impersonation"
  | "remote_access";

export interface OfficialResourceItem {
  id: "portal" | "suspect_search" | "report_suspect" | "rbi_cfr";
  title: string;
  titleHi: string;
  url: string;
  badge: string;
  badgeHi: string;
  purpose: string;
  purposeHi: string;
  highlights: string[];
  highlightsHi: string[];
  importantNote?: string;
  importantNoteHi?: string;
  actionLabel: string;
  actionLabelHi: string;
  isEducationalOnly?: boolean;
}

export interface ScamVisualStep {
  stepNumber: number;
  label: string;
  labelHi: string;
  visualType: "scan" | "alert" | "stop" | "phone" | "lock" | "link" | "shield";
}

export interface ScamAwarenessCardData {
  id: ScamAwarenessId;
  title: string;
  titleHi: string;
  shortDesc: string;
  shortDescHi: string;
  example: string;
  exampleHi: string;
  warningSigns: string[];
  warningSignsHi: string[];
  doAction: string;
  doActionHi: string;
  dontAction: string;
  dontActionHi: string;
  actionLabel: "STOP" | "VERIFY" | "DON'T PAY" | "REPORT";
  actionLabelHi: string;
  steps: ScamVisualStep[];
  resourceUrl: string;
  resourceLabel: string;
  resourceLabelHi: string;
}

export function validateExternalHttpsUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return "https://cybercrime.gov.in/";
}

export const OFFICIAL_RESOURCES: OfficialResourceItem[] = [
  {
    id: "portal",
    title: "National Cyber Crime Reporting Portal",
    titleHi: "राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल",
    url: "https://cybercrime.gov.in",
    badge: "Government of India · Helpline 1930",
    badgeHi: "भारत सरकार · हेल्पलाइन 1930",
    purpose: "File official cybercrime complaints, freeze fraudulent transfers early, and access citizen safety tools.",
    purposeHi: "आधिकारिक साइबर अपराध शिकायत दर्ज करें, धोखाधड़ी के पैसे रोकें और सुरक्षा सहायता पाएं।",
    highlights: [
      "Official cybercrime complaint reporting",
      "Access cybercrime awareness resources",
      "Direct access to suspect search & reporting",
    ],
    highlightsHi: [
      "आधिकारिक साइबर अपराध शिकायत दर्ज करें",
      "साइबर सुरक्षा जागरूकता सामग्री देखें",
      "संदिग्ध खोज व रिपोर्ट पोर्टल तक पहुंच",
    ],
    actionLabel: "Open Official Portal",
    actionLabelHi: "आधिकारिक पोर्टल खोलें",
  },
  {
    id: "suspect_search",
    title: "Suspect Search Repository",
    titleHi: "संदिग्ध खोज भंडार (Suspect Search)",
    url: "https://cybercrime.gov.in/webform/suspect_search_repository.aspx",
    badge: "Official I4C / MHA Check",
    badgeHi: "आधिकारिक सरकारी जांच",
    purpose: "Manually check if a mobile number, email, bank account, or URL appears in reported complaints.",
    purposeHi: "मोबाइल नंबर, ईमेल, बैंक खाता या वेबसाइट URL की शिकायत स्थिति स्वयं जांचें।",
    highlights: [
      "Check mobile numbers & email addresses",
      "Check bank account numbers & website URLs",
    ],
    highlightsHi: [
      "मोबाइल नंबर और ईमेल पते जांचें",
      "बैंक खाता नंबर और वेबसाइट URL जांचें",
    ],
    importantNote:
      "Note: Results show reported complaint records only and do NOT independently prove someone is a criminal.",
    importantNoteHi:
      "नोट: परिणाम केवल दर्ज शिकायतों की जानकारी दिखाते हैं — यह किसी के दोषी होने का स्वतंत्र प्रमाण नहीं है।",
    actionLabel: "Search Suspect Repository",
    actionLabelHi: "संदिग्ध रिपॉजिटरी में खोजें",
  },
  {
    id: "report_suspect",
    title: "Report a Suspect",
    titleHi: "संदिग्ध की रिपोर्ट करें",
    url: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
    badge: "Official Suspect Reporting",
    badgeHi: "आधिकारिक संदिग्ध रिपोर्ट",
    purpose: "Report suspicious phone numbers, websites, WhatsApp/Telegram handles, emails, or social accounts.",
    purposeHi: "संदिग्ध वेबसाइट, मोबाइल, WhatsApp, Telegram, ईमेल, SMS या सोशल मीडिया खाते की रिपोर्ट करें।",
    highlights: [
      "Websites, mobile numbers & SMS headers",
      "WhatsApp, Telegram, email & social handles",
    ],
    highlightsHi: [
      "वेबसाइट, मोबाइल नंबर और SMS हेडर",
      "WhatsApp, Telegram, ईमेल और सोशल खाते",
    ],
    actionLabel: "Report a Suspect",
    actionLabelHi: "संदिग्ध की रिपोर्ट करें",
  },
  {
    id: "rbi_cfr",
    title: "RBI Central Fraud Registry (CFR)",
    titleHi: "RBI केंद्रीय धोखाधड़ी रजिस्ट्री (CFR)",
    url: "https://rbidocs.rbi.org.in",
    badge: "Educational Reference · RBI",
    badgeHi: "शैक्षिक जानकारी · भारतीय रिज़र्व बैंक",
    purpose: "Learn how the Reserve Bank of India helps regulated banks track financial fraud patterns.",
    purposeHi: "जानें कि RBI विनियमित बैंकों को वित्तीय धोखाधड़ी के पैटर्न ट्रैक करने में कैसे मदद करता है।",
    highlights: [
      "Used by regulated banks & financial institutions",
      "Not a public searchable lookup for individuals",
    ],
    highlightsHi: [
      "विनियमित बैंकों और वित्तीय संस्थानों द्वारा उपयोग",
      "यह आम नागरिकों के लिए खोजने योग्य डेटाबेस नहीं है",
    ],
    importantNote:
      "Important: RBI Central Fraud Registry is used by regulated banks and financial institutions — it is NOT a public searchable database for individuals.",
    importantNoteHi:
      "महत्वपूर्ण: RBI केंद्रीय धोखाधड़ी रजिस्ट्री केवल बैंकों और वित्तीय संस्थानों के लिए है — यह आम लोगों के लिए सार्वजनिक खोज डेटाबेस नहीं है।",
    actionLabel: "Read RBI Resources",
    actionLabelHi: "RBI संसाधन देखें",
    isEducationalOnly: true,
  },
];

export const SCAM_AWARENESS_CARDS: ScamAwarenessCardData[] = [
  {
    id: "qr_scam",
    title: "QR Code Payment Scams",
    titleHi: "QR कोड भुगतान घोटाला",
    shortDesc: "Scanning a QR code only SENDS money — you never scan a QR to receive money.",
    shortDescHi: "QR कोड स्कैन करने से पैसे हमेशा कटते हैं — पैसे पाने के लिए कभी QR स्कैन नहीं होता।",
    example: "A buyer on an online marketplace sends a QR claiming you will receive ₹5,000 when you scan it.",
    exampleHi: "कोई खरीदार कहता है कि QR स्कैन करने पर आपके खाते में ₹5,000 आ जाएंगे।",
    warningSigns: ["Says 'Scan to Receive Prize or Refund'", "Preset high payment amount inside QR", "Urgency to enter UPI PIN quickly"],
    warningSignsHi: ["'पैसे पाने के लिए स्कैन करें' लिखा हो", "QR में पहले से बड़ी राशि भरी हो", "जल्दी UPI PIN डालने का दबाव"],
    doAction: "STOP and close the payment app if someone asks you to scan a QR to receive money.",
    doActionHi: "रुकें! पैसे मिलने के नाम पर कभी QR स्कैन न करें।",
    dontAction: "Never enter your UPI PIN to receive a refund, prize, or deposit.",
    dontActionHi: "पैसे पाने के लिए कभी भी अपना UPI PIN न डालें।",
    actionLabel: "DON'T PAY",
    actionLabelHi: "भुगतान न करें",
    steps: [
      { stepNumber: 1, label: "Stranger sends QR code", labelHi: "अनजान व्यक्ति QR भेजता है", visualType: "scan" },
      { stepNumber: 2, label: "Guardian shows DANGER alert", labelHi: "गार्जियन खतरा चेतावनी दिखाता है", visualType: "alert" },
      { stepNumber: 3, label: "STOP — never enter UPI PIN", labelHi: "रुकें — कभी UPI PIN न डालें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in",
    resourceLabel: "Report QR Fraud",
    resourceLabelHi: "QR धोखाधड़ी रिपोर्ट करें",
  },
  {
    id: "upi_scam",
    title: "Fake UPI Payment Requests",
    titleHi: "नकली UPI भुगतान अनुरोध",
    shortDesc: "Scammers send 'Collect Requests' disguised as refunds or cashbacks.",
    shortDescHi: "ठग रिफंड या कैशबैक के नाम पर 'Collect Request' (पैसे मांगने का लिंक) भेजते हैं।",
    example: "You get a notification: 'Approve ₹4,999 to claim cashback reward.' Approving deducts your money.",
    exampleHi: "सूचना आती है: 'कैशबैक पाने के लिए ₹4,999 स्वीकार करें।' मंजूरी देने पर आपके पैसे कट जाते हैं।",
    warningSigns: ["Shows 'Pay' or asks for UPI PIN", "Unknown handle like cashback@...", "Calls while request pops up"],
    warningSignsHi: ["ऐप 'Pay' दिखाए या UPI PIN मांगे", "अनजान नाम जैसे cashback@...", "कॉल पर रहते हुए तुरंत मंजूरी मांगे"],
    doAction: "Decline unknown collect requests and verify inside your official bank statement.",
    doActionHi: "अनजान भुगतान अनुरोध अस्वीकार करें और बैंक स्टेटमेंट जांचें।",
    dontAction: "Never approve a UPI request expecting money to arrive in your account.",
    dontActionHi: "पैसे आने की उम्मीद में कोई भी UPI अनुरोध स्वीकार न करें।",
    actionLabel: "DON'T PAY",
    actionLabelHi: "भुगतान न करें",
    steps: [
      { stepNumber: 1, label: "Fake cashback request arrives", labelHi: "नकली कैशबैक अनुरोध आता है", visualType: "alert" },
      { stepNumber: 2, label: "Check if it asks for PIN", labelHi: "देखें कि क्या PIN मांग रहा है", visualType: "lock" },
      { stepNumber: 3, label: "Decline & block caller", labelHi: "अस्वीकार करें और ब्लॉक करें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
    resourceLabel: "Report Fake UPI ID",
    resourceLabelHi: "नकली UPI ID रिपोर्ट करें",
  },
  {
    id: "customer_care",
    title: "Fake Customer-Care Numbers",
    titleHi: "नकली कस्टमर केयर नंबर",
    shortDesc: "Scammers post fake helpline numbers on search engines and maps.",
    shortDescHi: "ठग गूगल सर्च और मैप्स पर बैंकों या कंपनियों के नकली हेल्पलाइन नंबर डाल देते हैं।",
    example: "Searching 'courier helpline' leads to a fake agent who asks for a ₹5 'verification transfer'.",
    exampleHi: "कूरियर या बैंक नंबर खोजने पर नकली एजेंट ₹5 का 'सत्यापन भुगतान' करने को कहता है।",
    warningSigns: ["Number starts like regular personal mobile", "Asks to click an APK or pay ₹1–₹10", "Rushes you for card or PIN details"],
    warningSignsHi: ["सामान्य मोबाइल नंबर जैसा दिखना", "₹1–₹10 भेजने या APK डाउनलोड को कहना", "कार्ड या PIN विवरण जल्दी मांगना"],
    doAction: "Use ONLY the official helpline printed on your bank card, passbook, or Guardian Bank Directory.",
    doActionHi: "केवल बैंक कार्ड, पासबुक या Guardian बैंक डायरेक्टरी के नंबर का उपयोग करें।",
    dontAction: "Never trust customer care numbers from random search ads or social comments.",
    dontActionHi: "अनजान विज्ञापन या कमेंट में मिले हेल्पलाइन नंबर पर भरोसा न करें।",
    actionLabel: "VERIFY",
    actionLabelHi: "सत्यापित करें",
    steps: [
      { stepNumber: 1, label: "Find number on official card", labelHi: "आधिकारिक कार्ड पर नंबर देखें", visualType: "shield" },
      { stepNumber: 2, label: "Check unknown number first", labelHi: "पहले नंबर की जांच करें", visualType: "phone" },
      { stepNumber: 3, label: "Report fake helplines", labelHi: "नकली हेल्पलाइन रिपोर्ट करें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in/webform/suspect_search_repository.aspx",
    resourceLabel: "Check Number in Repository",
    resourceLabelHi: "नंबर जांचें",
  },
  {
    id: "otp_scam",
    title: "OTP Scams",
    titleHi: "OTP धोखाधड़ी",
    shortDesc: "Your bank NEVER asks for an OTP over phone, SMS, or WhatsApp.",
    shortDescHi: "आपका बैंक कभी भी फ़ोन, SMS या WhatsApp पर OTP नहीं मांगता।",
    example: "A caller says your SIM or KYC expires tonight and asks for the 6-digit OTP to keep it active.",
    exampleHi: "कॉलर कहता है आज KYC बंद हो जाएगी और चालू रखने के लिए 6-अंकीय OTP मांगता है।",
    warningSigns: ["Caller asks for 4 or 6 digit code", "Threatens account block or SIM shutoff", "Claims OTP is to 'cancel' a charge"],
    warningSignsHi: ["4 या 6 अंकों का कोड मांगे", "खाता या सिम बंद करने की धमकी दे", "'भुगतान रद्द करने' के लिए OTP मांगे"],
    doAction: "Hang up immediately. Call your bank directly from Guardian's Emergency Bank Call.",
    doActionHi: "तुरंत कॉल काट दें और Guardian से अपने आधिकारिक बैंक को कॉल करें।",
    dontAction: "NEVER read out or forward any OTP or banking PIN to anyone.",
    dontActionHi: "किसी को भी अपना OTP या बैंकिंग PIN न बताएं और न फॉरवर्ड करें।",
    actionLabel: "STOP",
    actionLabelHi: "रुकें",
    steps: [
      { stepNumber: 1, label: "Caller asks for OTP", labelHi: "कॉलर OTP मांगता है", visualType: "phone" },
      { stepNumber: 2, label: "Guardian warns: STOP", labelHi: "गार्जियन चेतावनी: रुकें", visualType: "alert" },
      { stepNumber: 3, label: "Hang up & keep OTP secret", labelHi: "कॉल काटें, OTP गुप्त रखें", visualType: "lock" },
    ],
    resourceUrl: "https://cybercrime.gov.in",
    resourceLabel: "Report OTP Attempt",
    resourceLabelHi: "OTP ठगी रिपोर्ट करें",
  },
  {
    id: "screen_share",
    title: "Screen-Sharing Scams",
    titleHi: "स्क्रीन-शेयरिंग घोटाला",
    shortDesc: "Sharing your phone screen lets scammers watch your OTPs, PINs, and bank balance.",
    shortDescHi: "स्क्रीन शेयर करने से ठग आपके फोन के OTP, पासवर्ड और बैंक ऐप देख सकते हैं।",
    example: "Caller tells you to turn on video screen share or enter a code so they can 'fix your KYC'.",
    exampleHi: "कॉलर 'KYC ठीक करने' के लिए स्क्रीन शेयर चालू करने को कहता है।",
    warningSigns: ["Asks to share screen on WhatsApp/video", "Asks you to open banking app while watching", "Promises instant refund or KYC fix"],
    warningSignsHi: ["WhatsApp/वीडियो पर स्क्रीन शेयर कहे", "देखते समय बैंक ऐप खोलने को कहे", "तुरंत रिफंड या KYC का वादा करे"],
    doAction: "End screen sharing and lock your phone immediately if an unknown caller requests it.",
    doActionHi: "अनजान व्यक्ति के कहने पर तुरंत स्क्रीन शेयरिंग बंद करें।",
    dontAction: "Never open banking, UPI, or SMS apps while sharing your screen.",
    dontActionHi: "स्क्रीन शेयर करते समय कभी भी बैंक, UPI या SMS ऐप न खोलें।",
    actionLabel: "STOP",
    actionLabelHi: "रुकें",
    steps: [
      { stepNumber: 1, label: "Caller asks to share screen", labelHi: "कॉलर स्क्रीन शेयर करने को कहे", visualType: "phone" },
      { stepNumber: 2, label: "Risk: OTPs become visible", labelHi: "खतरा: OTP और बैंक ऐप दिख जाएंगे", visualType: "alert" },
      { stepNumber: 3, label: "Disconnect & call family", labelHi: "कॉल काटें और परिवार से पूछें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
    resourceLabel: "Report Caller Handle",
    resourceLabelHi: "कॉलर की रिपोर्ट करें",
  },
  {
    id: "phishing",
    title: "Phishing Websites",
    titleHi: "नकली (फ़िशिंग) वेबसाइटें",
    shortDesc: "Fake web links copy bank logos to steal your login ID, password, and card PIN.",
    shortDescHi: "नकली वेबसाइटें बैंक जैसा रूप बनाकर आपका लॉगिन, पासवर्ड और कार्ड पिन चुराती हैं।",
    example: "An SMS link 'sbi-kyc-update.xyz' opens a page asking for your NetBanking password and ATM PIN.",
    exampleHi: "SMS में मिला लिंक 'sbi-kyc-update.xyz' बैंक लॉगिन और ATM PIN मांगता है।",
    warningSigns: ["Strange web ending (.xyz, .top, IP digits)", "Spelling mistakes in bank name", "Asks for ATM PIN or CVV online"],
    warningSignsHi: ["अजीब वेबसाइट नाम (.xyz, .top या नंबर)", "बैंक के नाम की गलत वर्तनी", "वेबसाइट पर ATM PIN या CVV मांगे"],
    doAction: "Check every unfamiliar link in Guardian's Link Inspector before tapping.",
    doActionHi: "किसी भी अनजान लिंक को खोलने से पहले Guardian में जांचें।",
    dontAction: "Never type bank passwords or card PINs on links received in SMS or WhatsApp.",
    dontActionHi: "SMS या WhatsApp में आए लिंक पर कभी बैंक पासवर्ड न डालें।",
    actionLabel: "VERIFY",
    actionLabelHi: "जांचें",
    steps: [
      { stepNumber: 1, label: "Strange SMS link arrives", labelHi: "अजीब SMS लिंक आता है", visualType: "link" },
      { stepNumber: 2, label: "Inspect link inside Guardian", labelHi: "Guardian में लिंक की जांच करें", visualType: "shield" },
      { stepNumber: 3, label: "Do NOT open suspicious URL", labelHi: "संदिग्ध लिंक कभी न खोलें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
    resourceLabel: "Report Phishing URL",
    resourceLabelHi: "नकली वेबसाइट रिपोर्ट करें",
  },
  {
    id: "fake_bank_call",
    title: "Fake Bank Calls",
    titleHi: "नकली बैंक कॉल",
    shortDesc: "Real banks never threaten instant account closure or ask you to transfer money to 'safe accounts'.",
    shortDescHi: "असली बैंक कभी खाता बंद करने की धमकी नहीं देते और न ही पैसे 'सुरक्षित खाते' में भेजने को कहते हैं।",
    example: "Caller claims your debit card is blocked and asks for card number + CVV to reactivate it.",
    exampleHi: "कॉलर कहता है आपका डेबिट कार्ड बंद हो रहा है, चालू रखने के लिए कार्ड नंबर व CVV बताएं।",
    warningSigns: ["Creates fear of blocked account/pension", "Uses regular 10-digit mobile number", "Asks to transfer money for verification"],
    warningSignsHi: ["खाता या पेंशन बंद होने का डर दिखाए", "साधारण 10-अंकीय नंबर से कॉल करे", "सत्यापन के लिए पैसे ट्रांसफर कहे"],
    doAction: "Hang up and tap 'Call My Bank' inside Guardian to reach your bank's official number.",
    doActionHi: "कॉल काटें और Guardian के 'मेरे बैंक को कॉल करें' बटन से संपर्क करें।",
    dontAction: "Never share CVV, card expiry, or transfer funds on an incoming call.",
    dontActionHi: "इनकमिंग कॉल पर कभी CVV न बताएं और न पैसे भेजें।",
    actionLabel: "STOP",
    actionLabelHi: "रुकें",
    steps: [
      { stepNumber: 1, label: "Urgent bank threat call", labelHi: "खाता बंद होने का धमकी भरा कॉल", visualType: "phone" },
      { stepNumber: 2, label: "Hang up immediately", labelHi: "तुरंत फ़ोन काट दें", visualType: "stop" },
      { stepNumber: 3, label: "Use Guardian 'Call My Bank'", labelHi: "Guardian से 'Call My Bank' दबाएं", visualType: "shield" },
    ],
    resourceUrl: "https://cybercrime.gov.in/webform/suspect_search_repository.aspx",
    resourceLabel: "Check Caller Number",
    resourceLabelHi: "कॉलर नंबर जांचें",
  },
  {
    id: "impersonation",
    title: "Impersonation & 'Digital Arrest' Scams",
    titleHi: "नकली अधिकारी / 'डिजिटल अरेस्ट' ठगी",
    shortDesc: "Police, CBI, Customs, or RBI NEVER conduct 'digital arrest' or demand bail money on video calls.",
    shortDescHi: "पुलिस, CBI, कस्टम या RBI कभी वीडियो कॉल पर 'डिजिटल अरेस्ट' नहीं करते और न पैसे मांगते हैं।",
    example: "Video caller in fake police uniform claims an illegal parcel is in your name and demands money.",
    exampleHi: "नकली पुलिस वर्दी में वीडियो कॉल पर पार्सल केस की धमकी देकर पैसे मांगे जाते हैं।",
    warningSigns: ["Threatens immediate arrest on video call", "Orders you not to tell family members", "Demands money transfer to 'clear case'"],
    warningSignsHi: ["वीडियो कॉल पर गिरफ्तारी की धमकी", "परिवार को न बताने का दबाव", "'केस सुलझाने' के लिए पैसे की मांग"],
    doAction: "Disconnect the call right away, tell your family, and call 1930 or 112.",
    doActionHi: "तुरंत कॉल काटें, परिवार को बताएं और 1930 या 112 पर कॉल करें।",
    dontAction: "Never stay on a forced video call or transfer money under intimidation.",
    dontActionHi: "डरकर वीडियो कॉल पर बने न रहें और कभी पैसे न भेजें।",
    actionLabel: "REPORT",
    actionLabelHi: "रिपोर्ट करें",
    steps: [
      { stepNumber: 1, label: "Threatening video/audio call", labelHi: "धमकी भरा वीडियो या फ़ोन कॉल", visualType: "phone" },
      { stepNumber: 2, label: "Remember: No Digital Arrest exists", labelHi: "याद रखें: डिजिटल अरेस्ट कानून में नहीं है", visualType: "alert" },
      { stepNumber: 3, label: "Hang up & call family / 1930", labelHi: "कॉल काटें, परिवार या 1930 को बताएं", visualType: "shield" },
    ],
    resourceUrl: "https://cybercrime.gov.in",
    resourceLabel: "Report Impersonation",
    resourceLabelHi: "ठगी की रिपोर्ट करें",
  },
  {
    id: "remote_access",
    title: "Remote Access App Scams",
    titleHi: "रिमोट एक्सेस ऐप घोटाला",
    shortDesc: "Apps like AnyDesk, TeamViewer, or QuickSupport give strangers full control over your phone.",
    shortDescHi: "AnyDesk, TeamViewer या QuickSupport जैसे ऐप्स अनजान लोगों को आपके फोन का पूरा नियंत्रण दे देते हैं।",
    example: "Scammer asks you to install a 'Bank Support App' from Play Store and share the 9-digit session code.",
    exampleHi: "ठग 'बैंक सपोर्ट ऐप' डाउनलोड कराकर 9-अंकीय कोड मांगता है।",
    warningSigns: ["Asks to install AnyDesk / TeamViewer / APK", "Asks for a 6–9 digit pairing code", "Asks to enter UPI PIN after connecting"],
    warningSignsHi: ["AnyDesk / TeamViewer / APK इंस्टॉल कहे", "6–9 अंकों का कनेक्शन कोड मांगे", "जोड़ने के बाद UPI PIN डालने को कहे"],
    doAction: "Uninstall the remote app immediately and turn off Wi-Fi/mobile data if already connected.",
    doActionHi: "रिमोट ऐप तुरंत हटाएं और शक होने पर इंटरनेट बंद कर बैंक को कॉल करें।",
    dontAction: "NEVER install remote access apps or unknown APK files for a stranger.",
    dontActionHi: "अनजान व्यक्ति के कहने पर कभी भी रिमोट एक्सेस ऐप या APK इंस्टॉल न करें।",
    actionLabel: "STOP",
    actionLabelHi: "रुकें",
    steps: [
      { stepNumber: 1, label: "Caller asks to install AnyDesk/APK", labelHi: "कॉलर AnyDesk या APK डाउनलोड कहे", visualType: "alert" },
      { stepNumber: 2, label: "Remote app exposes your bank", labelHi: "यह ऐप आपके बैंक का नियंत्रण दे देता है", visualType: "lock" },
      { stepNumber: 3, label: "Refuse & uninstall immediately", labelHi: "मना करें और तुरंत अनइंस्टॉल करें", visualType: "stop" },
    ],
    resourceUrl: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
    resourceLabel: "Report Remote Scam",
    resourceLabelHi: "रिमोट ऐप ठगी रिपोर्ट करें",
  },
];
