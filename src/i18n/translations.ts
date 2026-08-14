// src/i18n/translations.ts
// Minimal, honest translation catalog for the global ERP chrome + Settings page.
// Only the labels listed here are translated; the rest of the ERP is English
// until module-level translation catalogs are shipped. Selecting Telugu does
// NOT claim the entire ERP is translated.

export type Locale = "en" | "te";

export interface TranslationCatalog {
  appName: string;
  appSubtitle: string;
  nav: {
    dashboard: string;
    masters: string;
    operations: string;
    vehicles: string;
    staff: string;
    accounts: string;
    reports: string;
    settings: string;
  };
  settings: {
    profile: string;
    passwordSecurity: string;
    language: string;
    appearance: string;
    users: string;
    permissions: string;
    about: string;
  };
}

export const translations: Record<Locale, TranslationCatalog> = {
  en: {
    appName: "DMR Poultries",
    appSubtitle: "ERP System",
    nav: {
      dashboard: "Dashboard",
      masters: "Masters",
      operations: "Operations",
      vehicles: "Vehicles",
      staff: "Staff",
      accounts: "Accounts",
      reports: "Reports",
      settings: "Settings",
    },
    settings: {
      profile: "Profile",
      passwordSecurity: "Password & Security",
      language: "Language",
      appearance: "Appearance",
      users: "Users",
      permissions: "Permissions",
      about: "About ERP",
    },
  },
  te: {
    appName: "డి.యం.ఆర్ పౌల్ట్రీస్",
    appSubtitle: "ERP వ్యవస్థ",
    nav: {
      dashboard: "డాష్‌బోర్డ్",
      masters: "మాస్టర్స్",
      operations: "కార్యకలాపాలు",
      vehicles: "వాహనాలు",
      staff: "సిబ్బంది",
      accounts: "అకౌంట్స్",
      reports: "నివేదికలు",
      settings: "సెట్టింగ్‌లు",
    },
    settings: {
      profile: "ప్రొఫైల్",
      passwordSecurity: "పాస్‌వర్డ్ & భద్రత",
      language: "భాష",
      appearance: "రూపం",
      users: "వినియోగదారులు",
      permissions: "అనుమతులు",
      about: "ERP గురించి",
    },
  },
};
