import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ru from "./locales/ru.json";
import en from "./locales/en.json";

/**
 * i18n configuration for mspro-ltd-mspro UI.
 *
 * Phase A: navigation, sidebar, common buttons, app chrome — done.
 * Phase B: page-by-page translation of 46 pages — in progress.
 *
 * Default locale: Russian (this is an internal MSPRO tool).
 * Fallback: English (original mspro-ltd strings).
 *
 * Usage in components:
 *   import { useTranslation } from "react-i18next";
 *   const { t } = useTranslation();
 *   <span>{t("nav.dashboard")}</span>
 *
 * Plurals (Russian rules: one/few/many):
 *   {
 *     "agents_one": "{{count}} агент",
 *     "agents_few": "{{count}} агента",
 *     "agents_many": "{{count}} агентов"
 *   }
 *   t("agents", { count: n })
 *
 * Interpolation:
 *   {
 *     "greeting": "Привет, {{name}}"
 *   }
 *   t("greeting", { name: "Владимир" })
 *
 * Date formatting helpers — see ui/src/lib/i18n-format.ts
 */

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: "ru", // force Russian as default for MSPRO
    fallbackLng: "en",
    supportedLngs: ["ru", "en"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "mspro.ui.lang",
    },
    returnNull: false,
    // Enable Intl-based pluralization (i18next v23+ uses Intl.PluralRules)
    // For Russian: 1 → one, 2-4 → few, 0/5-20 → many, 11-14 → many
    pluralSeparator: "_",
    // Save missing keys (visible in dev console) so we can find untranslated strings
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: ${ns}:${key} (${lngs.join(",")})`);
        }
      : undefined,
  });

/**
 * Switch language at runtime + persist.
 * Used by language-switcher in InstanceGeneralSettings.
 */
export function changeLanguage(lng: "ru" | "en"): Promise<unknown> {
  return i18n.changeLanguage(lng);
}

export default i18n;
