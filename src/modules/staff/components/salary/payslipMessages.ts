// src/modules/staff/components/salary/payslipMessages.ts
//
// Payslip cover messages — Email + WhatsApp, English & Telugu. Shared by the
// Send Payslips popup AND the Review & Submit auto-send so both paths deliver
// the exact same wording. {name} is replaced per recipient; {month} at seed
// time.
import type { Language } from "../../../../i18n";

export const EMAIL_TEMPLATES: Record<Language, { subject: string; body: (name: string, month: string) => string }> = {
  en: {
    subject: "Salary Payslip — {month}",
    body: (name, month) =>
      `Dear ${name},\n\nYour salary payslip for ${month} is attached.\n\nThank you for your hard work and dedication.\n\nWarm regards,\nDMR Poultries`,
  },
  te: {
    subject: "జీతం పేస్లిప్ — {month}",
    body: (name, month) =>
      `ప్రియమైన ${name},\n\n${month} నెల మీ జీతం పేస్లిప్ జతచేయబడింది. దయచేసి చూడండి.\n\nమీ కృషికి మరియు అంకితభావానికి ధన్యవాదాలు.\n\nగౌరవంతో,\nDMR Poultries`,
  },
};

export const WA_TEMPLATES: Record<Language, { body: (name: string, month: string) => string }> = {
  en: {
    body: (name, month) =>
      `Hello ${name}! 👋\n\nYour salary payslip for ${month} is attached with this message.\n\nThank you for your hard work — proud to have you on the team. 🙏\n\n— DMR Poultries`,
  },
  te: {
    body: (name, month) =>
      `నమస్కారం ${name}! 👋\n\n${month} నెల మీ జీతం పేస్లిప్ ఈ మెసేజ్‌తో జతచేయబడింది.\n\nమీ కృషికి ధన్యవాదాలు — మీరు మా టీమ్‌లో భాగమవడం మా గర్వం. 🙏\n\n— DMR Poultries`,
  },
};
